import pg from 'pg';
const { Pool } = pg;

// We expect DATABASE_URL or POSTGRES_URL to be set in environment variables
function getPool() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/clienteloop';
  const needsSsl = connectionString.includes('sslmode') || connectionString.includes('supabase.co');

  return new Pool({
    connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}

let poolInstance: pg.Pool | null = null;
const db = {
  connect: async () => {
    if (!poolInstance) poolInstance = getPool();
    return poolInstance.connect();
  },
  query: async (text: string, params?: any[]) => {
    if (!poolInstance) poolInstance = getPool();
    return poolInstance.query(text, params);
  },
  getPool: () => {
    if (!poolInstance) poolInstance = getPool();
    return poolInstance;
  }
}

export async function initDb() {
  const client = await db.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id          SERIAL PRIMARY KEY,
        supabase_user_id TEXT,
        name        TEXT    NOT NULL,
        nicho       TEXT    NOT NULL DEFAULT 'salon',
        owner_name  TEXT    NOT NULL DEFAULT 'Dueño',
        email       TEXT,
        phone       TEXT,
        working_hours TEXT  DEFAULT '{"weekdays":"9:00-18:00","saturday":"9:00-14:00","sunday":"cerrado"}',
        ai_context  TEXT   DEFAULT '',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id              SERIAL PRIMARY KEY,
        business_id     INTEGER NOT NULL REFERENCES businesses(id),
        name            TEXT    NOT NULL,
        phone           TEXT,
        email           TEXT,
        channel         TEXT    DEFAULT 'whatsapp',
        pipeline_stage  TEXT    DEFAULT 'new',
        status          TEXT    DEFAULT 'open',
        tags            TEXT    DEFAULT '[]',
        notes           TEXT    DEFAULT '',
        last_contact_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id              SERIAL PRIMARY KEY,
        business_id     INTEGER NOT NULL REFERENCES businesses(id),
        contact_id      INTEGER NOT NULL REFERENCES contacts(id),
        channel         TEXT    NOT NULL DEFAULT 'whatsapp',
        status          TEXT    DEFAULT 'open',
        assigned_to     TEXT,
        last_message    TEXT    DEFAULT '',
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unread_count    INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id              SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id),
        content         TEXT    NOT NULL,
        sender          TEXT    NOT NULL DEFAULT 'client',
        is_ai_generated INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        contact_id  INTEGER REFERENCES contacts(id),
        title       TEXT    NOT NULL,
        due_time    TEXT,
        status      TEXT    DEFAULT 'pending',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pipeline_deals (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        contact_id  INTEGER NOT NULL REFERENCES contacts(id),
        title       TEXT    NOT NULL,
        stage       TEXT    DEFAULT 'new',
        value       REAL    DEFAULT 0,
        notes       TEXT    DEFAULT '',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quick_replies (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        title       TEXT    NOT NULL,
        content     TEXT    NOT NULL,
        category    TEXT    DEFAULT 'general',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_logs (
        id              SERIAL PRIMARY KEY,
        business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
        nicho           TEXT,
        input_tokens    INTEGER DEFAULT 0,
        output_tokens   INTEGER DEFAULT 0,
        latency_ms      INTEGER DEFAULT 0,
        escalated       INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Performance indexes (idempotent — IF NOT EXISTS is PostgreSQL 9.5+)
      CREATE INDEX IF NOT EXISTS idx_contacts_business_id       ON contacts(business_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_business_id  ON conversations(business_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_contact_id   ON conversations(contact_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id   ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_business_id          ON tasks(business_id);
      CREATE INDEX IF NOT EXISTS idx_pipeline_deals_business_id ON pipeline_deals(business_id);
      CREATE INDEX IF NOT EXISTS idx_quick_replies_business_id  ON quick_replies(business_id);
      CREATE INDEX IF NOT EXISTS idx_ai_logs_business_created   ON ai_logs(business_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone_biz  ON contacts(phone, business_id) WHERE phone IS NOT NULL;

      -- Channel numbers: maps WhatsApp/SMS/Email identifiers to businesses
      CREATE TABLE IF NOT EXISTS channel_numbers (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        channel     TEXT    NOT NULL,
        identifier  TEXT    NOT NULL,
        label       TEXT    DEFAULT '',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel, identifier)
      );
      CREATE INDEX IF NOT EXISTS idx_channel_numbers_lookup ON channel_numbers(channel, identifier);

      -- Message delivery status tracking
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';

      -- Agentic plan: per-business plan tier
      ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';

      -- Agentic memory: per-business AI memories that persist across conversations
      CREATE TABLE IF NOT EXISTS business_memories (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        type        TEXT NOT NULL, -- 'style' | 'faq' | 'pattern' | 'client_insight'
        content     TEXT NOT NULL,
        source      TEXT DEFAULT 'manual', -- 'auto_learned' | 'manual'
        relevance   INTEGER DEFAULT 5,     -- 1-10, higher = more important
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_business_memories_business_id ON business_memories(business_id);
      CREATE INDEX IF NOT EXISTS idx_business_memories_type        ON business_memories(type);

      -- Contact notes: multiple timestamped notes per contact
      CREATE TABLE IF NOT EXISTS contact_notes (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        content     TEXT    NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);

      -- Activity log: key CRM events per business/contact
      CREATE TABLE IF NOT EXISTS activity_log (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        contact_id  INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        type        TEXT    NOT NULL,
        description TEXT    NOT NULL,
        metadata    TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_activity_log_business_id ON activity_log(business_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_log_contact_id  ON activity_log(contact_id, created_at DESC);

      -- Services catalog: predefined service types with duration per business
      CREATE TABLE IF NOT EXISTS services (
        id               SERIAL PRIMARY KEY,
        business_id      INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name             TEXT    NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        price            DECIMAL(10,2),
        active           BOOLEAN DEFAULT true,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);

      -- Appointments: time-blocked events with conflict detection
      CREATE TABLE IF NOT EXISTS appointments (
        id               SERIAL PRIMARY KEY,
        business_id      INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        contact_id       INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        service_id       INTEGER REFERENCES services(id) ON DELETE SET NULL,
        title            TEXT    NOT NULL,
        start_time       TIMESTAMP NOT NULL,
        end_time         TIMESTAMP NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        status           TEXT    DEFAULT 'confirmed',
        notes            TEXT,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_business_time ON appointments(business_id, start_time);
      CREATE INDEX IF NOT EXISTS idx_appointments_contact       ON appointments(contact_id);

      -- Appointment reminders: track when 24h WhatsApp reminder was sent
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;
    `);
    console.log('[DB] PostgreSQL connected and schema initialized.');
  } catch (err) {
    console.error('[DB] Failed to initialize schema:', err);
  } finally {
    client.release();
  }
}

export default db;
