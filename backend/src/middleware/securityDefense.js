import { query } from '../config/db.js';

// In-memory cache for fast IP blacklist lookup (refreshed periodically or on ban/unban)
export const blockedIpsCache = new Set();
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 10000; // 10 seconds

// In-memory attack tracker for automated intrusion defense
const ipThreatTracker = new Map(); // ip -> { count: number, firstSeen: number, lastThreat: string }

/**
 * Refresh the in-memory blocked IPs cache
 */
export async function refreshBlockedIpsCache() {
  try {
    const rows = await query(`
      SELECT ip_address 
      FROM blocked_ips 
      WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())
    `);
    blockedIpsCache.clear();
    rows.forEach(r => {
      if (r.ip_address) blockedIpsCache.add(r.ip_address.trim());
    });
    lastCacheRefresh = Date.now();
  } catch (err) {
    console.error('Failed to refresh blocked IPs cache:', err.message);
  }
}

/**
 * Extract client IP address accurately (handles proxies, ipv6 localhost, etc.)
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const remote = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  if (remote === '::1' || remote === '::ffff:127.0.0.1') return '127.0.0.1';
  return remote.replace(/^::ffff:/, '');
}

/**
 * Sanitize request body / query parameters to remove sensitive tokens and passwords
 */
function sanitizePayload(data) {
  if (!data || typeof data !== 'object') return data;
  const sensitiveKeys = ['password', 'password_hash', 'token', 'jwt', 'secret', 'authorization', 'credit_card'];
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED_FOR_SECURITY]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizePayload(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Inspect request string for SQL injection, XSS, and traversal attack patterns
 */
function detectThreat(rawString) {
  if (!rawString || typeof rawString !== 'string') return null;

  // 1. SQL Injection signatures
  const sqliPatterns = [
    /(\%27)|(\')\s*(or|and)\s*[\(\)\w\d]/i,
    /\bunion\s+(all\s+)?select\b/i,
    /\bselect\s+.+\s+from\s+information_schema/i,
    /\b(exec|execute)\s*\(.+\)/i,
    /;\s*(drop|alter|truncate|delete)\s+table/i,
    /\b(sleep|benchmark)\s*\(\s*\d+\s*\)/i,
    /\/\*.*\*\/|--\s*$/i
  ];

  for (const pattern of sqliPatterns) {
    if (pattern.test(rawString)) {
      return { level: 'CRITICAL', reason: 'SQL Injection signature detected in payload/query' };
    }
  }

  // 2. Cross-Site Scripting (XSS) signatures
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /javascript\s*:\s*[^\s]/i,
    /\bon(error|load|click|mouseover|focus|blur)\s*=\s*['"][^'"]*['"]/i,
    /<img\s+[^>]*src\s*=\s*["']?javascript:/i
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(rawString)) {
      return { level: 'HIGH', reason: 'Cross-Site Scripting (XSS) script tag or attribute detected' };
    }
  }

  // 3. Path Traversal signatures
  const traversalPatterns = [
    /(\.\.\/|\.\.\\){2,}/,
    /%2e%2e(%2f|%5c)/i,
    /etc\/(passwd|shadow)/i
  ];

  for (const pattern of traversalPatterns) {
    if (pattern.test(rawString)) {
      return { level: 'HIGH', reason: 'Directory path traversal attempt detected' };
    }
  }

  return null;
}

/**
 * Security Defense Middleware
 * 1. Enforces IP firewall (rejects blocked IPs immediately)
 * 2. Scans requests for hacking attempts (SQLi, XSS, Brute force)
 * 3. Logs every single access & operation with IP, status, duration, error details
 */
export const securityDefenseMiddleware = async (req, res, next) => {
  const startTime = Date.now();
  const clientIp = getClientIp(req);

  // Periodic refresh of blocked IPs cache
  if (Date.now() - lastCacheRefresh > CACHE_TTL_MS) {
    refreshBlockedIpsCache().catch(() => {});
  }

  // 1. IP Firewall Check
  if (blockedIpsCache.has(clientIp)) {
    console.warn(`[SECURITY FIREWALL] Blocked request from quarantined IP: ${clientIp} on ${req.method} ${req.originalUrl}`);
    
    // Log the blocked attempt asynchronously
    query(`
      INSERT INTO system_access_logs 
      (ip_address, method, endpoint, status_code, duration_ms, user_agent, threat_level, threat_reason, created_at)
      VALUES (?, ?, ?, 403, 0, ?, 'CRITICAL', 'QUARANTINED_IP_ATTEMPTED_ACCESS', NOW())
    `, [clientIp, req.method, req.originalUrl.slice(0, 255), req.headers['user-agent']?.slice(0, 255) || null])
    .catch(() => {});

    return res.status(403).json({
      success: false,
      blocked: true,
      message: 'ACCESS QUARANTINED: Your IP address has been isolated by Institutional Cyber Defense. Contact Super Administrator to appeal.'
    });
  }

  // 2. Threat Pattern Detection across URL, Query, and Body
  let threatInfo = null;
  const testString = `${req.originalUrl} ${JSON.stringify(req.query || {})} ${JSON.stringify(req.body || {})}`;
  threatInfo = detectThreat(testString);

  // If a threat was detected, track for automated defense
  if (threatInfo) {
    console.warn(`[THREAT DEFENSE ALERT] Threat ${threatInfo.level} from ${clientIp}: ${threatInfo.reason}`);
    
    const now = Date.now();
    const existing = ipThreatTracker.get(clientIp) || { count: 0, firstSeen: now, lastThreat: threatInfo.reason };
    existing.count += 1;
    existing.lastThreat = threatInfo.reason;
    ipThreatTracker.set(clientIp, existing);

    // If an IP triggers 4+ malicious attacks within 5 minutes, auto-quarantine it
    if (existing.count >= 4 && (now - existing.firstSeen < 5 * 60 * 1000)) {
      try {
        await query(`
          INSERT INTO blocked_ips (ip_address, reason, threat_type, is_active, created_at)
          VALUES (?, ?, 'AUTOMATED_INTRUSION_DEFENSE', 1, NOW())
          ON DUPLICATE KEY UPDATE is_active = 1, reason = VALUES(reason)
        `, [clientIp, `Automated Defense: Triggered ${existing.count} cyber attack probes (${threatInfo.reason})`]);
        
        blockedIpsCache.add(clientIp);
        console.error(`[AUTO-DEFENSE LOCKDOWN] IP ${clientIp} was automatically banned after repeated attack attempts!`);
      } catch (banErr) {
        console.error('Failed to auto-ban malicious IP:', banErr);
      }
    }
  }

  // Store error details if thrown
  let capturedError = null;
  req._recordError = (err) => {
    capturedError = err;
  };

  // 3. Complete logging on response finish
  res.on('finish', async () => {
    try {
      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const userId = req.user?.id || null;
      const userName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : null;
      const userRole = req.user?.role || null;
      const userAgent = req.headers['user-agent']?.slice(0, 255) || null;

      // Determine final threat level
      let finalThreatLevel = threatInfo ? threatInfo.level : 'NONE';
      let finalThreatReason = threatInfo ? threatInfo.reason : null;

      if (!finalThreatReason && statusCode === 401 && req.originalUrl.includes('/auth/login')) {
        finalThreatLevel = 'SUSPICIOUS';
        finalThreatReason = 'FAILED_AUTHENTICATION_ATTEMPT';
      } else if (!finalThreatReason && statusCode >= 500) {
        finalThreatLevel = 'HIGH';
        finalThreatReason = 'INTERNAL_SYSTEM_EXCEPTION';
      }

      // Format error details for debugging
      let errorDetailsStr = null;
      if (capturedError) {
        errorDetailsStr = JSON.stringify({
          message: capturedError.message || String(capturedError),
          stack: capturedError.stack || null,
          statusCode
        });
      } else if (statusCode >= 400 && res.locals?.errorMessage) {
        errorDetailsStr = JSON.stringify({
          message: res.locals.errorMessage,
          statusCode
        });
      }

      // Safe sanitized payload
      const safeBody = req.method !== 'GET' ? sanitizePayload(req.body) : null;
      const safePayload = safeBody ? JSON.stringify(safeBody).slice(0, 2000) : null;

      await query(`
        INSERT INTO system_access_logs 
        (user_id, user_name, user_role, ip_address, method, endpoint, status_code, duration_ms, user_agent, threat_level, threat_reason, request_payload, error_details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        userId,
        userName,
        userRole,
        clientIp,
        req.method,
        req.originalUrl.slice(0, 255),
        statusCode,
        durationMs,
        userAgent,
        finalThreatLevel,
        finalThreatReason,
        safePayload,
        errorDetailsStr
      ]);
    } catch (logErr) {
      // Background logger should not crash application
      console.error('System access logging error:', logErr.message);
    }
  });

  next();
};
