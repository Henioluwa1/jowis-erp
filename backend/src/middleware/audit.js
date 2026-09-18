import { query } from '../config/db.js';

/**
 * Strip sensitive security fields before audit logging
 */
function sanitizeAuditPayload(data) {
  if (!data || typeof data !== 'object') return data;
  const sensitiveKeys = ['password', 'password_hash', 'token', 'jwt', 'secret', 'authorization'];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeAuditPayload(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Record an action to the audit_logs table (Gates 8, 11)
 */
export const recordAuditLog = async (userId, action, entityType, entityId, oldValue, newValue, req, reason = null, status = 'SUCCESS') => {
  try {
    const ip = req ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null) : null;
    const userAgent = req ? (req.headers['user-agent']?.slice(0, 255) || null) : null;
    const resolvedReason = reason || (newValue && typeof newValue === 'object' ? newValue.reason || newValue.justification : null) || null;

    const safeOld = sanitizeAuditPayload(oldValue);
    const safeNew = sanitizeAuditPayload(newValue);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, reason, status, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        entityType,
        entityId || null,
        safeOld ? JSON.stringify(safeOld) : null,
        safeNew ? JSON.stringify(safeNew) : null,
        resolvedReason ? String(resolvedReason).slice(0, 255) : null,
        status || 'SUCCESS',
        ip,
        userAgent
      ]
    );
  } catch (err) {
    console.error('Audit Logging Error:', err.message);
  }
};
