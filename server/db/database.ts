import pg from 'pg';
const { Pool } = pg;

// We expect DATABASE_URL or POSTGRES_URL to be set in environment variables
function getPool() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/clienteloop';
  const needsSsl = connectionString.includes('sslmode') || connectionString.includes('supabase.co') || connectionString.includes('supabase.com');

  const pool = new Pool({
    connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  // Required: without this, idle client errors (e.g. ENETUNREACH) crash the process
  pool.on('error', (err) => {
    console.error('[DB Pool] Idle client error:', err.message);
  });

  return pool;
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

      -- Embedded Signup: per-business WA access token + WABA ID
      ALTER TABLE channel_numbers ADD COLUMN IF NOT EXISTS access_token TEXT;
      ALTER TABLE channel_numbers ADD COLUMN IF NOT EXISTS waba_id      TEXT;

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

      -- Public booking slug: unique URL path per business (e.g. /book/mi-salon)
      ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_slug TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_booking_slug ON businesses(booking_slug) WHERE booking_slug IS NOT NULL;

      -- Broadcasts: mass WhatsApp message campaigns
      CREATE TABLE IF NOT EXISTS broadcasts (
        id              SERIAL PRIMARY KEY,
        business_id     INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name            TEXT    NOT NULL,
        message         TEXT    NOT NULL,
        status          TEXT    DEFAULT 'draft',  -- draft | sending | completed | failed
        recipient_count INTEGER DEFAULT 0,
        sent_count      INTEGER DEFAULT 0,
        failed_count    INTEGER DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at         TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS broadcast_recipients (
        id           SERIAL PRIMARY KEY,
        broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
        contact_id   INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        phone        TEXT    NOT NULL,
        name         TEXT    NOT NULL,
        status       TEXT    DEFAULT 'pending',  -- pending | sent | failed
        error        TEXT,
        sent_at      TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_broadcasts_business_id          ON broadcasts(business_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast  ON broadcast_recipients(broadcast_id);

      -- Billing: Stripe subscription tracking
      ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
      ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
      ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

      -- Team members: additional collaborators per business (agents / admins)
      CREATE TABLE IF NOT EXISTS business_members (
        id               SERIAL PRIMARY KEY,
        business_id      INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        supabase_user_id TEXT    NOT NULL,
        email            TEXT    NOT NULL DEFAULT '',
        role             TEXT    NOT NULL DEFAULT 'agent', -- 'admin' | 'agent'
        invited_by       TEXT,
        joined_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(business_id, supabase_user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_business_members_business ON business_members(business_id);
      CREATE INDEX IF NOT EXISTS idx_business_members_user     ON business_members(supabase_user_id);

      -- F19: Lead intent label on conversations
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS intent_label VARCHAR(100);

      -- Team invitations: invite-link tokens
      CREATE TABLE IF NOT EXISTS business_invitations (
        id          SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        email       TEXT,
        role        TEXT    NOT NULL DEFAULT 'agent',
        token       TEXT    NOT NULL UNIQUE,
        invited_by  TEXT    NOT NULL,
        expires_at  TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP,
        accepted_by TEXT,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_business_invitations_token ON business_invitations(token);

      -- WhatsApp retry queue: persistent queue for failed Meta API sends
      CREATE TABLE IF NOT EXISTS wa_retry_queue (
        id              SERIAL PRIMARY KEY,
        business_id     INT          NOT NULL,
        conversation_id INT,
        to_phone        VARCHAR(30)  NOT NULL,
        content         TEXT         NOT NULL,
        message_id      INT,
        attempt_count   INT          DEFAULT 0,
        max_attempts    INT          DEFAULT 3,
        next_retry_at   TIMESTAMPTZ  DEFAULT NOW(),
        last_error      TEXT,
        status          VARCHAR(20)  DEFAULT 'pending',
        created_at      TIMESTAMPTZ  DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wa_retry_pending
        ON wa_retry_queue (status, next_retry_at)
        WHERE status = 'pending';

      -- Media support: store WhatsApp images, documents, audio, video, location
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type    TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url     TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_mime    TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_name    TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_caption TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS location_lat  DOUBLE PRECISION;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS location_lng  DOUBLE PRECISION;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS location_name TEXT;
    `);
    console.log('[DB] PostgreSQL connected and schema initialized.');
  } catch (err) {
    console.error('[DB] Failed to initialize schema:', err);
  } finally {
    client.release();
  }
}

export default db;
