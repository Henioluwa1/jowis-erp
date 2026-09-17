import { query } from '../config/db.js';

/**
 * Record an action to the audit_logs table
 */
export const recordAuditLog = async (userId, action, entityType, entityId, oldValue, newValue, req) => {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null) : null;
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        entityType,
        entityId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ip
      ]
    );
  } catch (err) {
    console.error('Audit Logging Error:', err.message);
  }
};
