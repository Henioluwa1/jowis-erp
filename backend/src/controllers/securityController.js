import { query } from '../config/db.js';
import { blockedIpsCache, refreshBlockedIpsCache, getClientIp } from '../middleware/securityDefense.js';
import { recordAuditLog } from '../middleware/audit.js';

/**
 * Get Comprehensive System Access & Operational Logs (Super Admin Only)
 */
export const getSystemLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 30,
      search,
      threatLevel,
      statusCode,
      method,
      ipAddress,
      userId,
      onlyErrors,
      startDate,
      endDate
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    let where = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where.push('(sal.endpoint LIKE ? OR sal.ip_address LIKE ? OR sal.user_name LIKE ? OR sal.threat_reason LIKE ? OR sal.error_details LIKE ?)');
      params.push(q, q, q, q, q);
    }

    if (threatLevel && threatLevel !== 'all') {
      where.push('sal.threat_level = ?');
      params.push(threatLevel);
    }

    if (method && method !== 'all') {
      where.push('sal.method = ?');
      params.push(method.toUpperCase());
    }

    if (statusCode && statusCode !== 'all') {
      if (statusCode === '5xx') {
        where.push('sal.status_code >= 500');
      } else if (statusCode === '4xx') {
        where.push('sal.status_code >= 400 AND sal.status_code < 500');
      } else if (statusCode === '2xx') {
        where.push('sal.status_code >= 200 AND sal.status_code < 300');
      } else {
        where.push('sal.status_code = ?');
        params.push(parseInt(statusCode, 10));
      }
    }

    if (ipAddress && ipAddress.trim()) {
      where.push('sal.ip_address LIKE ?');
      params.push(`%${ipAddress.trim()}%`);
    }

    if (userId) {
      where.push('sal.user_id = ?');
      params.push(parseInt(userId, 10));
    }

    if (onlyErrors === 'true') {
      where.push('(sal.status_code >= 400 OR sal.error_details IS NOT NULL)');
    }

    if (startDate) {
      where.push('sal.created_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      where.push('sal.created_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }

    const whereSql = where.join(' AND ');

    const [countResult] = await query(`
      SELECT COUNT(*) as total
      FROM system_access_logs sal
      WHERE ${whereSql}
    `, params);

    const total = countResult?.total || 0;

    const logs = await query(`
      SELECT sal.id, sal.user_id, sal.user_name, sal.user_role,
             sal.ip_address, sal.method, sal.endpoint, sal.status_code,
             sal.duration_ms, sal.user_agent, sal.threat_level,
             sal.threat_reason, sal.request_payload, sal.error_details,
             sal.created_at
      FROM system_access_logs sal
      WHERE ${whereSql}
      ORDER BY sal.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('getSystemLogs error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving system access logs.' });
  }
};

/**
 * Get Real-time Security Defense & Diagnostics Stats
 */
export const getSecurityStats = async (req, res) => {
  try {
    const [todayStats] = await query(`
      SELECT 
        COUNT(*) as total_requests_today,
        COUNT(DISTINCT ip_address) as unique_ips_today,
        SUM(CASE WHEN threat_level IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END) as active_threats_today,
        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as server_errors_today,
        SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as client_errors_today
      FROM system_access_logs
      WHERE created_at >= CURDATE()
    `);

    const [blockedCount] = await query(`
      SELECT COUNT(*) as count 
      FROM blocked_ips 
      WHERE is_active = 1
    `);

    // Top 5 active threat alerts
    const recentThreats = await query(`
      SELECT id, ip_address, method, endpoint, threat_level, threat_reason, created_at, user_name
      FROM system_access_logs
      WHERE threat_level IN ('SUSPICIOUS', 'HIGH', 'CRITICAL')
      ORDER BY created_at DESC
      LIMIT 8
    `);

    // Top 5 most active visiting IPs
    const topIps = await query(`
      SELECT ip_address, COUNT(*) as request_count,
             MAX(created_at) as last_seen,
             SUM(CASE WHEN threat_level != 'NONE' THEN 1 ELSE 0 END) as threat_count
      FROM system_access_logs
      WHERE created_at >= NOW() - INTERVAL 24 HOUR
      GROUP BY ip_address
      ORDER BY request_count DESC
      LIMIT 6
    `);

    res.json({
      success: true,
      stats: {
        totalRequestsToday: Number(todayStats?.total_requests_today || 0),
        uniqueIpsToday: Number(todayStats?.unique_ips_today || 0),
        activeThreatsToday: Number(todayStats?.active_threats_today || 0),
        serverErrorsToday: Number(todayStats?.server_errors_today || 0),
        clientErrorsToday: Number(todayStats?.client_errors_today || 0),
        totalBlockedIps: Number(blockedCount?.count || 0)
      },
      recentThreats,
      topIps
    });
  } catch (error) {
    console.error('getSecurityStats error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving security statistics.' });
  }
};

/**
 * Get Specific Debug Log Technical Inspection
 */
export const getDebugLogDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [log] = await query(`
      SELECT sal.*, u.email as user_email
      FROM system_access_logs sal
      LEFT JOIN users u ON sal.user_id = u.id
      WHERE sal.id = ?
    `, [Number(id)]);

    if (!log) {
      return res.status(404).json({ success: false, message: 'System log entry not found.' });
    }

    // Parse JSON fields if available
    let parsedPayload = null;
    let parsedError = null;

    try {
      if (log.request_payload) parsedPayload = JSON.parse(log.request_payload);
    } catch (e) {
      parsedPayload = log.request_payload;
    }

    try {
      if (log.error_details) parsedError = JSON.parse(log.error_details);
    } catch (e) {
      parsedError = log.error_details;
    }

    res.json({
      success: true,
      data: {
        ...log,
        requestPayloadParsed: parsedPayload,
        errorDetailsParsed: parsedError
      }
    });
  } catch (error) {
    console.error('getDebugLogDetails error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving log inspection details.' });
  }
};

/**
 * Get IP Firewall Blocklist
 */
export const getBlockedIps = async (req, res) => {
  try {
    const list = await query(`
      SELECT bi.id, bi.ip_address, bi.reason, bi.threat_type, bi.is_active,
             bi.created_at, bi.expires_at,
             u.first_name as blocked_by_first, u.last_name as blocked_by_last
      FROM blocked_ips bi
      LEFT JOIN users u ON bi.blocked_by = u.id
      ORDER BY bi.is_active DESC, bi.created_at DESC
    `);

    res.json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('getBlockedIps error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving blocked IPs list.' });
  }
};

/**
 * Super Admin Action: Block / Ban an IP Address (Immediate Firewall Enforcement)
 */
export const blockIpAddress = async (req, res) => {
  try {
    const { ipAddress, reason, threatType = 'MANUAL_SUPERADMIN_BAN', durationHours } = req.body;

    if (!ipAddress || !reason) {
      return res.status(400).json({ success: false, message: 'ipAddress and reason are required.' });
    }

    const cleanIp = ipAddress.trim();
    const expiresAt = durationHours ? new Date(Date.now() + Number(durationHours) * 3600 * 1000) : null;

    await query(`
      INSERT INTO blocked_ips (ip_address, reason, threat_type, blocked_by, is_active, created_at, expires_at)
      VALUES (?, ?, ?, ?, 1, NOW(), ?)
      ON DUPLICATE KEY UPDATE 
        reason = VALUES(reason),
        threat_type = VALUES(threat_type),
        blocked_by = VALUES(blocked_by),
        is_active = 1,
        expires_at = VALUES(expires_at),
        created_at = NOW()
    `, [cleanIp, reason.trim(), threatType, req.user.id, expiresAt]);

    blockedIpsCache.add(cleanIp);

    await recordAuditLog(
      req.user.id,
      'FIREWALL_BLOCK_IP',
      'blocked_ips',
      null,
      null,
      { ipAddress: cleanIp, reason, threatType, expiresAt },
      req,
      `Super admin quarantined IP address: ${cleanIp}`
    );

    res.json({
      success: true,
      message: `IP address ${cleanIp} has been successfully quarantined and blocked from accessing the system.`,
      ipAddress: cleanIp
    });
  } catch (error) {
    console.error('blockIpAddress error:', error);
    res.status(500).json({ success: false, message: 'Server error blocking IP address.' });
  }
};

/**
 * Super Admin Action: Unblock / Release an IP Address
 */
export const unblockIpAddress = async (req, res) => {
  try {
    const { ipAddress } = req.body;

    if (!ipAddress) {
      return res.status(400).json({ success: false, message: 'ipAddress is required.' });
    }

    const cleanIp = ipAddress.trim();

    await query(`
      UPDATE blocked_ips
      SET is_active = 0
      WHERE ip_address = ?
    `, [cleanIp]);

    blockedIpsCache.delete(cleanIp);

    await recordAuditLog(
      req.user.id,
      'FIREWALL_UNBLOCK_IP',
      'blocked_ips',
      null,
      { ipAddress: cleanIp },
      { ipAddress: cleanIp, status: 'unblocked' },
      req,
      `Super admin released quarantine on IP address: ${cleanIp}`
    );

    res.json({
      success: true,
      message: `IP address ${cleanIp} has been released from quarantine.`
    });
  } catch (error) {
    console.error('unblockIpAddress error:', error);
    res.status(500).json({ success: false, message: 'Server error unblocking IP address.' });
  }
};
