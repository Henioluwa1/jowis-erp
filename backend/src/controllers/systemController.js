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

/**
 * Get digital ID card configurations for all roles
 * Accessible by all authenticated users so cards render with institutional branding
 */
export const getIdCardConfig = async (req, res) => {
  try {
    const [setting] = await query('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['id_card_config']);
    let config = {};
    if (setting && setting.setting_value) {
      try {
        config = typeof setting.setting_value === 'string' ? JSON.parse(setting.setting_value) : setting.setting_value;
      } catch (err) {
        console.error('Error parsing id_card_config:', err);
      }
    }
    res.json({ success: true, data: config || {} });
  } catch (error) {
    console.error('getIdCardConfig error:', error);
    res.status(500).json({ success: false, message: 'Failed to load ID card configurations.' });
  }
};

/**
 * Update digital ID card configuration (Admins & Super Admins)
 */
export const updateIdCardConfig = async (req, res) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ success: false, message: 'Valid configuration object is required.' });
    }

    const [existing] = await query('SELECT * FROM system_settings WHERE setting_key = ?', ['id_card_config']);
    const stringValue = JSON.stringify(config);

    if (existing) {
      await query(
        'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
        [stringValue, req.user?.id || null, 'id_card_config']
      );
      await recordAuditLog(req.user.id, 'UPDATE_ID_CARD_CONFIG', 'system_settings', existing.id, existing, { value: stringValue }, req);
    } else {
      await query(
        `INSERT INTO system_settings (setting_key, setting_value, value_type, category, is_public, description, updated_by)
         VALUES ('id_card_config', ?, 'json', 'general', 1, 'Official digital ID card custom designs and templates', ?)`,
        [stringValue, req.user?.id || null]
      );
    }

    res.json({ success: true, message: 'ID card designs updated successfully for all users.', data: config });
  } catch (error) {
    console.error('updateIdCardConfig error:', error);
    res.status(500).json({ success: false, message: 'Failed to save ID card designs.' });
  }
};

/**
 * Public Verification Endpoint for Institutional ID Cards (Scanned via QR Code)
 */
export const verifyIdCardPublic = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }

    const cleanCode = code.trim();

    // 1. Check in intern_profiles
    const interns = await query(`
      SELECT ip.id as intern_profile_id, ip.intern_code, ip.status as intern_status,
             ip.start_date, ip.expected_end_date,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url, u.is_active,
             r.name as role_name,
             t.name as track_name,
             c.name as cohort_name
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN tracks t ON ip.track_id = t.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ip.intern_code = ? OR ip.id = ? OR u.id = ?
      LIMIT 1
    `, [cleanCode, cleanCode, cleanCode]);

    if (interns && interns.length > 0) {
      const it = interns[0];
      return res.json({
        success: true,
        verified: true,
        data: {
          idType: 'intern',
          institutionalId: it.intern_code,
          fullName: `${it.first_name} ${it.last_name}`,
          firstName: it.first_name,
          lastName: it.last_name,
          role: it.role_name,
          title: 'ENGINEERING INTERN',
          department: it.track_name || 'Technology Engineering Track',
          cohort: it.cohort_name || 'Standard Cohort',
          status: it.is_active && it.intern_status === 'active' ? 'ACTIVE' : it.intern_status?.toUpperCase() || 'ACTIVE',
          isActive: Boolean(it.is_active),
          avatarUrl: it.avatar_url,
          issuedAt: it.start_date || '2026-01-15',
          expiresAt: it.expected_end_date || '2026-12-31',
          institution: 'Jowis Studio — Enterprise Internship Hub',
          verifiedAt: new Date().toISOString()
        }
      });
    }

    // 2. Check in general users (Mentors, Admins, Super Admins)
    // Support formats like JOWIS-ADM-001, JOWIS-MTR-001 or raw user ID
    let rawUserId = null;
    const match = cleanCode.match(/^JOWIS-(?:ADM|MTR)-0*(\d+)$/i);
    if (match) {
      rawUserId = parseInt(match[1], 10);
    } else if (/^\d+$/.test(cleanCode)) {
      rawUserId = parseInt(cleanCode, 10);
    }

    if (rawUserId) {
      const users = await query(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url, u.is_active, u.created_at,
               r.name as role_name,
               m.specialization as mentor_specialization
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN mentors m ON u.id = m.user_id
        WHERE u.id = ?
        LIMIT 1
      `, [rawUserId]);

      if (users && users.length > 0) {
        const u = users[0];
        const role = u.role_name;
        const institutionalId = role === 'mentor'
          ? `JOWIS-MTR-${String(u.id).padStart(3, '0')}`
          : `JOWIS-ADM-${String(u.id).padStart(3, '0')}`;

        const title = role === 'super_admin'
          ? 'SUPER ADMINISTRATOR'
          : role === 'admin'
          ? 'ADMINISTRATOR'
          : 'FACULTY MENTOR';

        const department = role === 'mentor'
          ? (u.mentor_specialization || 'Instructional Faculty & Product Mentorship')
          : (role === 'super_admin' ? 'Supreme Governance & Security' : 'Operations Administration');

        return res.json({
          success: true,
          verified: true,
          data: {
            idType: role,
            institutionalId,
            fullName: `${u.first_name} ${u.last_name}`,
            firstName: u.first_name,
            lastName: u.last_name,
            role: u.role_name,
            title,
            department,
            status: u.is_active ? 'ACTIVE' : 'INACTIVE',
            isActive: Boolean(u.is_active),
            avatarUrl: u.avatar_url,
            issuedAt: u.created_at?.toISOString()?.split('T')[0] || '2026-01-01',
            expiresAt: '2026-12-31',
            institution: 'Jowis Studio — Enterprise Internship Hub',
            verifiedAt: new Date().toISOString()
          }
        });
      }
    }

    return res.status(404).json({
      success: false,
      verified: false,
      message: 'Official ID credential could not be verified in the Jowis Studio Institutional Registry.'
    });
  } catch (error) {
    console.error('verifyIdCardPublic error:', error);
    res.status(500).json({ success: false, message: 'Server error verifying institutional ID.' });
  }
};

