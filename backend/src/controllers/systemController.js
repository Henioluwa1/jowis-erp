import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';

export const getSettings = async (req, res) => {
  try {
    const settings = await query('SELECT * FROM system_settings ORDER BY category, setting_key');
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve system settings.' });
  }
};

export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const [existing] = await query('SELECT * FROM system_settings WHERE setting_key = ?', [key]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Setting not found.' });
    }

    const stringValue = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
    await query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [stringValue, key]);
    await recordAuditLog(req.user.id, 'UPDATE_SETTING', 'system_settings', existing.id, existing, { value: stringValue }, req);

    res.json({ success: true, message: `Setting "${key}" updated successfully.` });
  } catch (error) {
    console.error('updateSetting error:', error);
    res.status(500).json({ success: false, message: 'Failed to update setting.' });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const logs = await query(`
      SELECT al.*,
             u.first_name, u.last_name, u.email,
             r.name as role_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit, 10), offset]);

    const [count] = await query('SELECT COUNT(*) as total FROM audit_logs');

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count.total,
        pages: Math.ceil(count.total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
  }
};
