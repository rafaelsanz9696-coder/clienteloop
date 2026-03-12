import db from '../db/database.js';

/** Log a CRM event. Non-critical — errors are swallowed so they never break the main flow. */
export async function logActivity(
  businessId: number,
  contactId: number | null,
  type: string,
  description: string,
): Promise<void> {
  try {
    await db.query(
      'INSERT INTO activity_log (business_id, contact_id, type, description) VALUES ($1, $2, $3, $4)',
      [businessId, contactId, type, description],
    );
  } catch (err) {
    console.error('[Activity] Log failed (non-critical):', err);
  }
}
