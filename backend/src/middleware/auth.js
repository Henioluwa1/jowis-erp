import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'jowis_studio_erp_jwt_secret_key_2026_super_secure';

export const revokedTokens = new Set();

// Production JWT security check (V-07)
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'jowis_studio_erp_jwt_secret_key_2026_super_secure')) {
  console.warn('⚠️ SECURITY WARNING: Insecure default JWT_SECRET is active in production!');
}

/**
 * Verify JWT Token and attach user + role to req.user
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && (req.query.token || req.query.auth_token)) {
      token = req.query.token || req.query.auth_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No Bearer token provided.'
      });
    }

    // Check token revocation denylist (V-06)
    if (revokedTokens.has(token)) {
      return res.status(401).json({
        success: false,
        message: 'Session has been invalidated. Please log in again.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token. Please log in again.'
      });
    }

    // Fetch fresh user details from database
    const users = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.is_active, u.must_change_password,
              r.name as role_name, r.id as role_id,
              ip.id as intern_profile_id, ip.intern_code, ip.track_id as intern_track_id, ip.cohort_id as intern_cohort_id,
              m.id as mentor_id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN intern_profiles ip ON u.id = ip.user_id
       LEFT JOIN mentors m ON u.id = m.user_id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or has been deactivated.'
      });
    }

    const user = users[0];
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role_name,
      roleId: user.role_id,
      internProfileId: user.intern_profile_id,
      internCode: user.intern_code,
      trackId: user.intern_track_id,
      cohortId: user.intern_cohort_id,
      mentorId: user.mentor_id,
      mustChangePassword: Boolean(user.must_change_password)
    };

    // Strict Enforcement Barrier: Must change temporary password before accessing operational APIs (Part 9)
    // Permitted onboarding paths: user profile, password change, logout, and mandatory first-login setup (attendance schedule & onboarding profiles)
    if (req.user.mustChangePassword) {
      const allowedPaths = [
        '/auth/me',
        '/auth/change-password',
        '/auth/logout',
        '/auth/intern-onboarding',
        '/auth/mentor-onboarding',
        '/auth/upload-credential',
        '/attendance/schedule'
      ];
      const rawPath = (req.baseUrl + req.path).replace(/^\/api/, '');
      const normalizedPath = rawPath.replace(/\/+$/, '') || '/';
      const isPermitted = allowedPaths.some(p => normalizedPath === p || normalizedPath.startsWith(p + '/'));
      if (!isPermitted) {
        return res.status(403).json({
          success: false,
          code: 'MUST_CHANGE_PASSWORD',
          message: 'Security Notice: You must change your temporary password before accessing ERP operations.'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
  }
};

/**
 * Authorize specified roles (e.g. 'super_admin', 'admin', 'mentor')
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]. Your role is ${req.user.role}.`
      });
    }

    next();
  };
};

/**
 * Verify that an intern only accesses their own intern record
 */
export const verifyInternOwnership = (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.role === 'admin' || req.user.role === 'mentor') {
    return next();
  }

  const requestedId = parseInt(req.params.internId || req.params.id, 10);
  if (req.user.role === 'intern' && req.user.internProfileId !== requestedId) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: You are not authorized to view or access another intern's records."
    });
  }

  next();
};

/**
 * Authorize specified permission slug (e.g. 'users:read', 'settings:update') (Gate 4)
 */
export const authorizePermission = (permissionSlug) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      // super_admin always bypasses with full institutional authorization
      if (req.user.role === 'super_admin') {
        return next();
      }

      const rows = await query(`
        SELECT p.id
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = ? AND p.slug = ?
        LIMIT 1
      `, [req.user.roleId, permissionSlug]);

      if (rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Missing required permission [${permissionSlug}].`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ success: false, message: 'Internal server error validating permissions.' });
    }
  };
};
