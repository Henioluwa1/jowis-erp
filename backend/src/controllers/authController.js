import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { JWT_SECRET, revokedTokens } from '../middleware/auth.js';
import { recordAuditLog } from '../middleware/audit.js';
import { validatePasswordPolicy } from '../utils/passwordGenerator.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const users = await query(
      `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.phone, u.avatar_url, u.is_active, u.must_change_password,
              r.name as role_name, r.id as role_id,
              ip.id as intern_profile_id, ip.intern_code, ip.track_id as intern_track_id, ip.cohort_id as intern_cohort_id,
              t.name as track_name, c.name as cohort_name,
              m.id as mentor_id, m.specialization as mentor_specialization
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN intern_profiles ip ON u.id = ip.user_id
       LEFT JOIN tracks t ON ip.track_id = t.id
       LEFT JOIN cohorts c ON ip.cohort_id = c.id
       LEFT JOIN mentors m ON u.id = m.user_id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.'
      });
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const tokenPayload = {
      userId: user.id,
      role: user.role_name,
      roleId: user.role_id,
      internProfileId: user.intern_profile_id
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    // Record login audit log
    await recordAuditLog(user.id, 'LOGIN', 'user', user.id, null, { email: user.email }, req);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      mustChangePassword: Boolean(user.must_change_password),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        role: user.role_name,
        mustChangePassword: Boolean(user.must_change_password),
        internProfileId: user.intern_profile_id,
        internCode: user.intern_code,
        trackId: user.intern_track_id,
        trackName: user.track_name,
        cohortId: user.intern_cohort_id,
        cohortName: user.cohort_name,
        mentorId: user.mentor_id,
        mentorSpecialization: user.mentor_specialization
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

export const getMe = async (req, res) => {
  try {
    const users = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.is_active, u.must_change_password,
              r.name as role_name, r.id as role_id,
              ip.id as intern_profile_id, ip.intern_code, ip.track_id as intern_track_id, ip.cohort_id as intern_cohort_id,
              t.name as track_name, c.name as cohort_name,
              m.id as mentor_id, m.specialization as mentor_specialization
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN intern_profiles ip ON u.id = ip.user_id
       LEFT JOIN tracks t ON ip.track_id = t.id
       LEFT JOIN cohorts c ON ip.cohort_id = c.id
       LEFT JOIN mentors m ON u.id = m.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];
    const userPayload = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      role: user.role_name,
      mustChangePassword: Boolean(user.must_change_password),
      internProfileId: user.intern_profile_id,
      internCode: user.intern_code,
      trackId: user.intern_track_id,
      trackName: user.track_name,
      cohortId: user.intern_cohort_id,
      cohortName: user.cohort_name,
      mentorId: user.mentor_id,
      mentorSpecialization: user.mentor_specialization
    };
    res.json({
      success: true,
      user: userPayload,
      data: userPayload
    });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving user profile.' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const [user] = await query(
      'SELECT id, email, password_hash, must_change_password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Policy validation
    const policyResult = validatePasswordPolicy(newPassword);
    if (!policyResult.valid) {
      return res.status(400).json({
        success: false,
        message: policyResult.message
      });
    }

    // If account was marked with temporary password (must_change_password = 1)
    if (user.must_change_password === 1) {
      // If current password was passed, verify it; otherwise session authentication is sufficient
      if (currentPassword) {
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
          return res.status(400).json({ success: false, message: 'Current temporary password is incorrect.' });
        }
      }
    } else {
      // Normal password change requires current password verification
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required.' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }
    }

    // Prevent reusing the same temporary password
    const isSameAsOld = await bcrypt.compare(newPassword, user.password_hash);
    if (isSameAsOld) {
      return res.status(400).json({
        success: false,
        message: 'New password cannot be identical to your temporary password.'
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [newHash, req.user.id]
    );

    await recordAuditLog(req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id, null, null, req);

    res.json({
      success: true,
      message: 'Password updated successfully. Account is now fully active.',
      mustChangePassword: false
    });
  } catch (error) {
    console.error('changePassword error:', error);
    res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
};

export const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) revokedTokens.add(token);
    }
    if (req.user) {
      await recordAuditLog(req.user.id, 'LOGOUT', 'user', req.user.id, null, null, req, 'User logged out');
    }
    res.json({
      success: true,
      message: 'Logout successful.'
    });
  } catch (error) {
    console.error('logout error:', error);
    res.status(500).json({ success: false, message: 'Server error during logout.' });
  }
};

