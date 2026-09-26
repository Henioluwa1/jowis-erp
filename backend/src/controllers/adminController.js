import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';
import { getLagosNow } from '../utils/timezone.js';
import { generateSecureTemporaryPassword } from '../utils/passwordGenerator.js';
import notificationService from '../services/notificationService.js';

// ============================================================================
// 1. GOVERNANCE & ADMINISTRATIVE OVERVIEW DASHBOARD (Gate 5)
// ============================================================================

export const getGovernanceOverview = async (req, res) => {
  try {
    // 1. Active users by role
    const usersByRole = await query(`
      SELECT r.name as role, COUNT(u.id) as total,
             SUM(CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END) as active_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id, r.name
    `);

    // 2. Active domain counts
    const [internStats] = await query(`
      SELECT COUNT(*) as total_interns,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_interns,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_interns
      FROM intern_profiles
    `);

    const [mentorStats] = await query(`SELECT COUNT(*) as total_mentors FROM mentors`);
    const [cohortStats] = await query(`
      SELECT COUNT(*) as total_cohorts,
             SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_cohorts
      FROM cohorts
    `);
    const [trackStats] = await query(`
      SELECT COUNT(*) as total_tracks,
             SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_tracks
      FROM tracks
    `);

    // 3. Recent administrative & security activity (last 12 events)
    const recentActivity = await query(`
      SELECT al.id, al.action, al.entity_type, al.entity_id, al.reason, al.status,
             al.ip_address, al.user_agent, al.created_at,
             u.id as user_id, u.first_name, u.last_name, u.email,
             r.name as role_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY al.created_at DESC
      LIMIT 12
    `);

    // 4. Security summary (recent deactivations, role modifications, and admin actions)
    const [securityStats] = await query(`
      SELECT 
        SUM(CASE WHEN action IN ('DEACTIVATE_USER', 'ACTIVATE_USER') THEN 1 ELSE 0 END) as status_changes_count,
        SUM(CASE WHEN action = 'CHANGE_ROLE' THEN 1 ELSE 0 END) as role_changes_count,
        SUM(CASE WHEN action = 'RESET_PASSWORD' THEN 1 ELSE 0 END) as password_resets_count,
        SUM(CASE WHEN action LIKE '%SETTING%' THEN 1 ELSE 0 END) as settings_updates_count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // 5. System Health & Environment Metrics
    const lagosNow = getLagosNow();
    const [dbVersion] = await query(`SELECT VERSION() as version, DATABASE() as db_name`);

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers: usersByRole.reduce((acc, curr) => acc + Number(curr.total || 0), 0),
          activeUsers: usersByRole.reduce((acc, curr) => acc + Number(curr.active_count || 0), 0),
          activeInterns: Number(internStats?.active_interns || 0),
          totalInterns: Number(internStats?.total_interns || 0),
          activeMentors: Number(mentorStats?.total_mentors || 0),
          activeCohorts: Number(cohortStats?.active_cohorts || 0),
          activeTracks: Number(trackStats?.active_tracks || 0)
        },
        usersByRole,
        securitySummary: {
          statusChangesLast30Days: Number(securityStats?.status_changes_count || 0),
          roleChangesLast30Days: Number(securityStats?.role_changes_count || 0),
          passwordResetsLast30Days: Number(securityStats?.password_resets_count || 0),
          settingsUpdatesLast30Days: Number(securityStats?.settings_updates_count || 0)
        },
        systemHealth: {
          status: 'healthy',
          database: dbVersion?.db_name || 'jowis_studio_erp',
          engineVersion: dbVersion?.version || 'MySQL / MariaDB',
          serverTimeLagos: `${lagosNow.lagosDate} ${lagosNow.lagosTime}`,
          timezone: 'Africa/Lagos (UTC+1)',
          nodeUptimeSeconds: Math.floor(process.uptime())
        },
        recentActivity
      }
    });
  } catch (error) {
    console.error('getGovernanceOverview error:', error);
    res.status(500).json({ success: false, message: 'Failed to load governance overview metrics.' });
  }
};

// ============================================================================
// 2. USER ADMINISTRATION (Gate 2, 3, 11, 13, 15)
// ============================================================================

/**
 * List users with pagination, role filter, status filter, and search
 */
export const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      role = 'all',
      status = 'all',
      search = ''
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 15));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = ['1=1'];
    const params = [];

    if (role && role !== 'all') {
      whereConditions.push('r.name = ?');
      params.push(role);
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        whereConditions.push('u.is_active = 1');
      } else if (status === 'inactive') {
        whereConditions.push('u.is_active = 0');
      }
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR ip.intern_code LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereSql = whereConditions.join(' AND ');

    // Total Count
    const [countResult] = await query(`
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN intern_profiles ip ON u.id = ip.user_id
      WHERE ${whereSql}
    `, params);

    const totalUsers = countResult?.total || 0;

    // Paginated users without ever exposing password hashes
    const users = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url,
             u.is_active, u.deactivation_reason, u.last_login, u.created_at, u.updated_at,
             r.id as role_id, r.name as role_name, r.description as role_description,
             ip.id as intern_profile_id, ip.intern_code, ip.status as intern_status,
             t.name as track_name, c.name as cohort_name,
             m.id as mentor_id, m.specialization as mentor_specialization
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN intern_profiles ip ON u.id = ip.user_id
      LEFT JOIN tracks t ON ip.track_id = t.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON u.id = m.user_id
      WHERE ${whereSql}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limitNum)
      }
    });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve administrative users.' });
  }
};

/**
 * Get detailed profile for a single user
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url,
             u.is_active, u.deactivation_reason, u.last_login, u.created_at, u.updated_at,
             r.id as role_id, r.name as role_name, r.description as role_description,
             ip.id as intern_profile_id, ip.intern_code, ip.status as intern_status,
             t.id as track_id, t.name as track_name,
             c.id as cohort_id, c.name as cohort_name,
             m.id as mentor_id, m.specialization as mentor_specialization, m.bio as mentor_bio
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN intern_profiles ip ON u.id = ip.user_id
      LEFT JOIN tracks t ON ip.track_id = t.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON u.id = m.user_id
      WHERE u.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];

    // Recent activity related to this user
    const userAudit = await query(`
      SELECT action, entity_type, entity_id, reason, status, created_at
      FROM audit_logs
      WHERE user_id = ? OR (entity_type = 'users' AND entity_id = ?)
      ORDER BY created_at DESC
      LIMIT 8
    `, [id, id]);

    res.json({
      success: true,
      data: {
        ...user,
        recentActivity: userAudit
      }
    });
  } catch (error) {
    console.error('getUserById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user details.' });
  }
};

/**
 * Create a new user with secure password hashing and privilege escalation guards
 */
export const createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      roleId,
      roleName,
      phone,
      avatarUrl
    } = req.body;

    if (!firstName || !firstName.trim() || !lastName || !lastName.trim() || !email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and institutional email are required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Automatically generate a cryptographically secure temporary password (Part 3)
    const tempPassword = (password && password.trim().length >= 8)
      ? password.trim()
      : generateSecureTemporaryPassword(14);

    // Resolve target role
    let targetRole;
    if (roleId) {
      const [r] = await query('SELECT * FROM roles WHERE id = ?', [roleId]);
      targetRole = r;
    } else if (roleName) {
      const [r] = await query('SELECT * FROM roles WHERE name = ?', [roleName]);
      targetRole = r;
    } else {
      const [r] = await query('SELECT * FROM roles WHERE name = ?', ['intern']);
      targetRole = r;
    }

    if (!targetRole) {
      return res.status(400).json({ success: false, message: 'Specified role is invalid.' });
    }

    // Privilege Escalation Guard (Gate 3, 13)
    // Only super_admin can create super_admin accounts
    if (targetRole.name === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Super Administrators can provision super_admin accounts.'
      });
    }

    // Check duplicate email
    const [existingUser] = await query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `A user account with email "${email.trim()}" already exists.`
      });
    }

    // Hash temporary password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    // Insert user with must_change_password = 1 (Part 4)
    const result = await query(`
      INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone, avatar_url, is_active, must_change_password, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, NOW())
    `, [
      targetRole.id,
      email.trim().toLowerCase(),
      passwordHash,
      firstName.trim(),
      lastName.trim(),
      phone ? phone.trim() : null,
      avatarUrl ? avatarUrl.trim() : null
    ]);

    const newUserId = result.insertId;

    // If role is mentor, provision mentors row if requested
    if (targetRole.name === 'mentor') {
      await query(`
        INSERT INTO mentors (user_id, specialization, bio, created_at)
        VALUES (?, 'General Instructor', 'Faculty member at Jowis Studio', NOW())
        ON DUPLICATE KEY UPDATE user_id = user_id
      `, [newUserId]);
    }

    // Seed default notification preferences
    await query(`
      INSERT IGNORE INTO notification_preferences (user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications)
      VALUES (?, 1, 1, 1, 1, 1, 0)
    `, [newUserId]);

    // Send Welcome Notification (Part 10)
    await notificationService.createNotification({
      userId: newUserId,
      type: 'system',
      title: 'Welcome to Jowis Studio ERP',
      message: 'Welcome to Jowis Studio ERP. Your account has been created successfully. For security, please change your temporary password to a password of your choice.',
      link: '/profile'
    });

    // Record Audit Log (Part 25: Never log password or plaintext credentials)
    await recordAuditLog(
      req.user.id,
      'CREATE_USER',
      'users',
      newUserId,
      null,
      { email: email.trim().toLowerCase(), firstName: firstName.trim(), lastName: lastName.trim(), role: targetRole.name },
      req,
      `User account provisioned with role ${targetRole.name} and temporary credentials`
    );

    // Return credentials once for administrator display (Part 5)
    res.status(201).json({
      success: true,
      message: 'User account created successfully.',
      data: {
        id: newUserId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        username: email.trim().toLowerCase(),
        roleName: targetRole.name,
        roleId: targetRole.id,
        isActive: 1,
        mustChangePassword: true,
        temporaryPassword: tempPassword,
        user: {
          id: newUserId,
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          roleName: targetRole.name,
          roleId: targetRole.id,
          isActive: 1,
          mustChangePassword: true
        }
      }
    });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user account.' });
  }
};

/**
 * Update allowed user profile fields
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, avatarUrl } = req.body;

    const [existing] = await query('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updatedFirstName = firstName !== undefined ? firstName.trim() : existing.first_name;
    const updatedLastName = lastName !== undefined ? lastName.trim() : existing.last_name;
    const updatedPhone = phone !== undefined ? phone.trim() : existing.phone;
    const updatedAvatar = avatarUrl !== undefined ? avatarUrl.trim() : existing.avatar_url;

    await query(`
      UPDATE users
      SET first_name = ?, last_name = ?, phone = ?, avatar_url = ?
      WHERE id = ?
    `, [updatedFirstName, updatedLastName, updatedPhone, updatedAvatar, id]);

    await recordAuditLog(
      req.user.id,
      'UPDATE_USER',
      'users',
      id,
      { first_name: existing.first_name, last_name: existing.last_name, phone: existing.phone },
      { first_name: updatedFirstName, last_name: updatedLastName, phone: updatedPhone },
      req,
      'Administrative update of user profile fields'
    );

    res.json({
      success: true,
      message: 'User profile updated successfully.',
      data: {
        id: Number(id),
        firstName: updatedFirstName,
        lastName: updatedLastName,
        phone: updatedPhone,
        avatarUrl: updatedAvatar
      }
    });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user profile.' });
  }
};

/**
 * Activate or deactivate a user account with mandatory reason (Gate 2, 11, 12)
 */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = req.body;

    if (isActive === undefined || typeof isActive !== 'boolean' && isActive !== 0 && isActive !== 1) {
      return res.status(400).json({ success: false, message: 'isActive (boolean) is required.' });
    }

    if (!reason || !reason.trim() || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A formal justification reason (minimum 5 characters) is required for account status changes.'
      });
    }

    const [targetUser] = await query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [id]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Protection: User cannot deactivate themselves
    if (Number(req.user.id) === Number(id)) {
      return res.status(400).json({
        success: false,
        message: 'Safety violation: You cannot deactivate your own administrative account.'
      });
    }

    // Protection: Admins cannot deactivate super_admin
    if (targetUser.role_name === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only Super Administrators can modify Super Admin accounts.'
      });
    }

    const newStatus = isActive ? 1 : 0;
    const cleanReason = reason.trim();

    await query(`
      UPDATE users 
      SET is_active = ?, deactivation_reason = ? 
      WHERE id = ?
    `, [newStatus, newStatus === 0 ? cleanReason : null, id]);

    const actionName = newStatus === 1 ? 'ACTIVATE_USER' : 'DEACTIVATE_USER';
    await recordAuditLog(
      req.user.id,
      actionName,
      'users',
      id,
      { is_active: targetUser.is_active, role: targetUser.role_name },
      { is_active: newStatus, deactivation_reason: cleanReason },
      req,
      cleanReason
    );

    res.json({
      success: true,
      message: `User account has been ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
      data: {
        id: Number(id),
        isActive: newStatus,
        deactivationReason: newStatus === 0 ? cleanReason : null
      }
    });
  } catch (error) {
    console.error('toggleUserStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update account status.' });
  }
};

/**
 * Change a user's role with strict privilege escalation prevention (Gate 3, 11, 13)
 */
export const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, roleName, reason } = req.body;

    if (!reason || !reason.trim() || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'A formal justification reason (minimum 5 characters) is required for role changes.'
      });
    }

    const [targetUser] = await query(`
      SELECT u.*, r.name as current_role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [id]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Safety Violation: User cannot change their own role
    if (Number(req.user.id) === Number(id)) {
      return res.status(400).json({
        success: false,
        message: 'Safety violation: Self-privilege modification is prohibited. You cannot change your own role.'
      });
    }

    // Resolve requested role
    let requestedRole;
    if (roleId) {
      const [r] = await query('SELECT * FROM roles WHERE id = ?', [roleId]);
      requestedRole = r;
    } else if (roleName) {
      const [r] = await query('SELECT * FROM roles WHERE name = ?', [roleName]);
      requestedRole = r;
    }

    if (!requestedRole) {
      return res.status(400).json({ success: false, message: 'Target role is invalid.' });
    }

    // Privilege Escalation Prevention (Gate 3, 13)
    // 1. Intern/Mentor can never change roles (guarded by route middleware)
    // 2. Admin CANNOT escalate anyone to super_admin
    if (requestedRole.name === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Operational Admins cannot promote accounts to Super Administrator. Institutional super_admin authorization required.'
      });
    }

    // 3. Admin CANNOT modify an existing super_admin's role
    if (targetUser.current_role_name === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Operational Admins cannot modify Super Administrator accounts.'
      });
    }

    await query('UPDATE users SET role_id = ? WHERE id = ?', [requestedRole.id, id]);

    const cleanReason = reason.trim();
    await recordAuditLog(
      req.user.id,
      'CHANGE_ROLE',
      'users',
      id,
      { role_id: targetUser.role_id, role_name: targetUser.current_role_name },
      { role_id: requestedRole.id, role_name: requestedRole.name },
      req,
      cleanReason
    );

    res.json({
      success: true,
      message: `User role changed from ${targetUser.current_role_name} to ${requestedRole.name}.`,
      data: {
        id: Number(id),
        previousRole: targetUser.current_role_name,
        newRole: requestedRole.name,
        roleId: requestedRole.id
      }
    });
  } catch (error) {
    console.error('changeUserRole error:', error);
    res.status(500).json({ success: false, message: 'Failed to change user role.' });
  }
};

/**
 * Administratively reset a user password (Gate 2, 11, 13)
 */
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, reason } = req.body;

    const [targetUser] = await query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [id]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Admin cannot reset super_admin password
    if (targetUser.role_name === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Operational Admins cannot reset Super Administrator passwords.'
      });
    }

    // Generate secure temporary password if not explicitly supplied (Part 13)
    const tempPassword = (newPassword && newPassword.trim().length >= 8)
      ? newPassword.trim()
      : generateSecureTemporaryPassword(14);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    // Update password and flag must_change_password = 1
    await query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [passwordHash, id]);

    // Send reset notification
    await notificationService.createNotification({
      userId: Number(id),
      type: 'system',
      title: 'Security Notice: Password Reset',
      message: 'Your password has been administratively reset with temporary credentials. You will be required to change your password upon your next login.',
      link: '/profile'
    });

    const cleanReason = reason ? reason.trim() : 'Administrative password reset initiated by administrator';
    await recordAuditLog(
      req.user.id,
      'RESET_PASSWORD',
      'users',
      id,
      null,
      { targetEmail: targetUser.email, targetRole: targetUser.role_name },
      req,
      cleanReason
    );

    res.json({
      success: true,
      message: `Password reset successfully for user ${targetUser.email}. Temporary credentials generated.`,
      data: {
        id: Number(id),
        email: targetUser.email,
        username: targetUser.email,
        temporaryPassword: tempPassword,
        mustChangePassword: true
      }
    });
  } catch (error) {
    console.error('resetUserPassword error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset user password.' });
  }
};

// ============================================================================
// 3. ROLES & PERMISSIONS GOVERNANCE (Gate 3, 4)
// ============================================================================

/**
 * Get all roles and user counts
 */
export const getRoles = async (req, res) => {
  try {
    const roles = await query(`
      SELECT r.id, r.name, r.description, r.created_at,
             COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id, r.name, r.description, r.created_at
      ORDER BY r.id ASC
    `);

    res.json({ success: true, data: roles });
  } catch (error) {
    console.error('getRoles error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve system roles.' });
  }
};

/**
 * Get centralized permission matrix mapping roles to permissions
 */
export const getPermissionsMatrix = async (req, res) => {
  try {
    const roles = await query('SELECT id, name, description FROM roles ORDER BY id ASC');
    const permissions = await query('SELECT id, module, action, slug, description FROM permissions ORDER BY module, action');
    const rolePermissions = await query('SELECT role_id, permission_id FROM role_permissions');

    const rolePermSet = new Set(rolePermissions.map(rp => `${rp.role_id}:${rp.permission_id}`));

    // Build matrix
    const matrix = permissions.map(p => {
      const row = {
        permissionId: p.id,
        module: p.module,
        action: p.action,
        slug: p.slug,
        description: p.description,
        roles: {}
      };
      roles.forEach(r => {
        row.roles[r.name] = rolePermSet.has(`${r.id}:${p.id}`);
      });
      return row;
    });

    res.json({
      success: true,
      data: {
        roles,
        permissions,
        matrix
      }
    });
  } catch (error) {
    console.error('getPermissionsMatrix error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve permissions matrix.' });
  }
};

// ============================================================================
// 4. ORGANIZATION & SYSTEM SETTINGS (Gate 6, 7)
// ============================================================================

/**
 * Get all settings grouped by category
 */
export const getAdminSettings = async (req, res) => {
  try {
    const settings = await query(`
      SELECT s.*, u.first_name as updater_first_name, u.last_name as updater_last_name
      FROM system_settings s
      LEFT JOIN users u ON s.updated_by = u.id
      ORDER BY s.category, s.setting_key
    `);

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('getAdminSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve system configuration.' });
  }
};

/**
 * Update system or organization setting with validation and justification
 */
export const updateAdminSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, reason } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, message: 'Setting value is required.' });
    }

    const [existing] = await query('SELECT * FROM system_settings WHERE setting_key = ?', [key]);
    if (!existing) {
      return res.status(404).json({ success: false, message: `Configuration setting "${key}" not found.` });
    }

    // Guard: security settings can only be altered by super_admin
    if (existing.category === 'security' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Security governance settings can only be altered by Super Administrators.'
      });
    }

    // Type validation
    let stringValue;
    if (existing.value_type === 'number') {
      const numVal = Number(value);
      if (isNaN(numVal)) {
        return res.status(400).json({ success: false, message: `Setting "${key}" requires a numeric value.` });
      }
      stringValue = String(numVal);
    } else if (existing.value_type === 'boolean') {
      const boolVal = value === true || value === 1 || value === '1' || value === 'true';
      stringValue = boolVal ? '1' : '0';
    } else if (existing.value_type === 'time') {
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
      if (!timeRegex.test(String(value).trim())) {
        return res.status(400).json({ success: false, message: `Setting "${key}" must be a valid 24-hour time format (HH:MM:SS).` });
      }
      stringValue = String(value).trim();
    } else if (existing.value_type === 'json') {
      try {
        const obj = typeof value === 'object' ? value : JSON.parse(value);
        stringValue = JSON.stringify(obj);
      } catch (err) {
        return res.status(400).json({ success: false, message: `Setting "${key}" must be valid JSON.` });
      }
    } else {
      stringValue = String(value).trim();
    }

    await query(`
      UPDATE system_settings
      SET setting_value = ?, updated_by = ?
      WHERE setting_key = ?
    `, [stringValue, req.user.id, key]);

    const cleanReason = reason ? reason.trim() : `Updated ${key} configuration`;
    const actionName = existing.category === 'general' ? 'UPDATE_ORGANIZATION_SETTING' : 'UPDATE_SYSTEM_SETTING';
    await recordAuditLog(
      req.user.id,
      actionName,
      'system_settings',
      existing.id,
      { key, oldValue: existing.setting_value },
      { key, newValue: stringValue },
      req,
      cleanReason
    );

    res.json({
      success: true,
      message: `Setting "${key}" updated successfully.`,
      data: {
        settingKey: key,
        settingValue: stringValue,
        valueType: existing.value_type,
        category: existing.category
      }
    });
  } catch (error) {
    console.error('updateAdminSetting error:', error);
    res.status(500).json({ success: false, message: 'Failed to update system configuration.' });
  }
};

// ============================================================================
// 5. AUDIT LOG ARCHITECTURE & IMMUTABILITY (Gate 8, 9, 10, 11)
// ============================================================================

/**
 * Filterable and paginated Audit Log Viewer with payload masking
 */
export const getAdminAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      action,
      entityType,
      userId,
      role,
      startDate,
      endDate,
      search
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = ['1=1'];
    const params = [];

    if (action && action.trim() && action !== 'all') {
      whereConditions.push('al.action = ?');
      params.push(action.trim());
    }

    if (entityType && entityType.trim() && entityType !== 'all') {
      whereConditions.push('al.entity_type = ?');
      params.push(entityType.trim());
    }

    if (userId) {
      whereConditions.push('al.user_id = ?');
      params.push(parseInt(userId, 10));
    }

    if (role && role !== 'all') {
      whereConditions.push('r.name = ?');
      params.push(role);
    }

    if (startDate) {
      whereConditions.push('al.created_at >= ?');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      whereConditions.push('al.created_at <= ?');
      params.push(`${endDate} 23:59:59`);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      whereConditions.push('(al.action LIKE ? OR al.entity_type LIKE ? OR al.reason LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)');
      params.push(q, q, q, q, q, q);
    }

    const whereSql = whereConditions.join(' AND ');

    const [countResult] = await query(`
      SELECT COUNT(*) as total
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ${whereSql}
    `, params);

    const totalLogs = countResult?.total || 0;

    const logs = await query(`
      SELECT al.id, al.action, al.entity_type, al.entity_id,
             al.old_value, al.new_value, al.reason, al.status,
             al.ip_address, al.user_agent, al.created_at,
             u.id as user_id, u.first_name, u.last_name, u.email,
             r.name as role_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ${whereSql}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalLogs,
        totalPages: Math.ceil(totalLogs / limitNum)
      }
    });
  } catch (error) {
    console.error('getAdminAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve administrative audit logs.' });
  }
};

/**
 * Immutability Guard: Reject any mutation or deletion on audit logs (Gate 9)
 */
export const rejectAuditLogMutation = (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed: Audit logs are strictly immutable and protected by institutional governance. UPDATE and DELETE operations are permanently prohibited.'
  });
};
