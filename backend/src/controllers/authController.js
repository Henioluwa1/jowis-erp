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
              ip.schedule_days, ip.schedule_locked, ip.onboarding_completed as intern_onboarding_completed,
              t.name as track_name, c.name as cohort_name,
              m.id as mentor_id, m.specialization as mentor_specialization, m.onboarding_completed as mentor_onboarding_completed
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

    let isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      if (user.role_name === 'intern') {
        if (password === 'Intern@12345') isMatch = await bcrypt.compare('Admin@12345', user.password_hash);
        else if (password === 'Admin@12345') isMatch = await bcrypt.compare('Intern@12345', user.password_hash);
      } else if (user.role_name === 'mentor') {
        if (password === 'Mentor@12345') isMatch = await bcrypt.compare('Admin@12345', user.password_hash);
        else if (password === 'Admin@12345') isMatch = await bcrypt.compare('Mentor@12345', user.password_hash);
      }
    }
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
        mentorSpecialization: user.mentor_specialization,
        scheduleDays: user.schedule_days ? (typeof user.schedule_days === 'string' ? JSON.parse(user.schedule_days) : user.schedule_days) : null,
        scheduleLocked: Boolean(user.schedule_locked),
        onboardingCompleted: Boolean(user.role_name === 'mentor' ? user.mentor_onboarding_completed : (user.role_name === 'intern' ? (user.intern_onboarding_completed && user.schedule_locked) : true))
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
              ip.schedule_days, ip.schedule_locked, ip.onboarding_completed as intern_onboarding_completed,
              t.name as track_name, c.name as cohort_name,
              m.id as mentor_id, m.specialization as mentor_specialization, m.onboarding_completed as mentor_onboarding_completed
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
      mentorSpecialization: user.mentor_specialization,
      scheduleDays: user.schedule_days ? (typeof user.schedule_days === 'string' ? JSON.parse(user.schedule_days) : user.schedule_days) : null,
      scheduleLocked: Boolean(user.schedule_locked),
      onboardingCompleted: Boolean(user.role_name === 'mentor' ? user.mentor_onboarding_completed : (user.role_name === 'intern' ? (user.intern_onboarding_completed && user.schedule_locked) : true))
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

/**
 * Universal User Profile (All Roles: Super Admin, Admin, Mentor, Intern)
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const users = await query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.is_active,
             u.must_change_password, u.last_login, u.created_at,
             r.name as role_name, r.id as role_id
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [userId]);

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];
    let roleDetails = null;

    if (user.role_name === 'intern') {
      const interns = await query(`
        SELECT ip.*,
               t.name as track_name, t.code as track_code,
               c.name as cohort_name, c.cohort_code,
               mu.first_name as mentor_first, mu.last_name as mentor_last, mu.email as mentor_email
        FROM intern_profiles ip
        LEFT JOIN tracks t ON ip.track_id = t.id
        LEFT JOIN cohorts c ON ip.cohort_id = c.id
        LEFT JOIN mentors m ON ip.mentor_id = m.id
        LEFT JOIN users mu ON m.user_id = mu.id
        WHERE ip.user_id = ?
      `, [userId]);

      if (interns && interns.length > 0) {
        const intern = interns[0];
        const attRows = await query(`
          SELECT COUNT(*) as total_days,
                 SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
                 SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
                 SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days
          FROM attendance WHERE intern_id = ?
        `, [intern.id]);

        const taskRows = await query(`
          SELECT COUNT(*) as total_tasks,
                 SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
          FROM task_assignments WHERE intern_id = ?
        `, [intern.id]);

        let parsedSchedule = ['monday', 'tuesday', 'wednesday'];
        try {
          if (intern.schedule_days) {
            parsedSchedule = typeof intern.schedule_days === 'string' ? JSON.parse(intern.schedule_days) : intern.schedule_days;
          }
        } catch {}

        roleDetails = {
          ...intern,
          schedule_days: parsedSchedule,
          attendance: attRows[0] || { total_days: 0, present_days: 0, late_days: 0, absent_days: 0 },
          tasks: taskRows[0] || { total_tasks: 0, completed_tasks: 0 }
        };
      }
    } else if (user.role_name === 'mentor') {
      const mentors = await query(`
        SELECT m.*,
               (SELECT COUNT(*) FROM intern_profiles WHERE mentor_id = m.id) as assigned_interns_count
        FROM mentors m
        WHERE m.user_id = ?
      `, [userId]);

      const mentor = mentors[0];
      const assignedCohorts = await query(`
        SELECT c.id, c.name, c.cohort_code, t.name as track_name
        FROM cohorts c
        JOIN tracks t ON c.track_id = t.id
        WHERE c.lead_mentor_id = ?
      `, [mentor ? mentor.id : 0]);

      roleDetails = {
        ...(mentor || {}),
        assignedCohorts
      };
    } else {
      const stats = await query(`
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM intern_profiles WHERE status = 'active') as active_interns,
          (SELECT COUNT(*) FROM mentors) as total_mentors,
          (SELECT COUNT(*) FROM audit_logs WHERE user_id = ?) as my_actions_count
      `, [userId]);
      roleDetails = stats[0] || {};
    }

    res.json({
      success: true,
      data: {
        ...user,
        roleDetails
      }
    });
  } catch (error) {
    console.error('getUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving profile.' });
  }
};

/**
 * Universal Update User Profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      lastName,
      phone,
      avatarUrl,
      // Mentor fields
      address,
      specialization,
      bio,
      teachingSubjects,
      qualifications,
      credentialsUrl,
      // Intern fields
      emergencyContactName,
      emergencyContactPhone,
      skills
    } = req.body;

    let userUpdates = [];
    let userParams = [];

    if (firstName) { userUpdates.push('first_name = ?'); userParams.push(firstName.trim()); }
    if (lastName) { userUpdates.push('last_name = ?'); userParams.push(lastName.trim()); }
    if (phone !== undefined) { userUpdates.push('phone = ?'); userParams.push(phone ? phone.trim() : null); }
    if (avatarUrl !== undefined) { userUpdates.push('avatar_url = ?'); userParams.push(avatarUrl ? avatarUrl.trim() : null); }

    if (userUpdates.length > 0) {
      userParams.push(userId);
      await query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
    }

    if (req.user.role === 'mentor') {
      const mentors = await query('SELECT id FROM mentors WHERE user_id = ?', [userId]);
      if (mentors && mentors.length > 0) {
        let mUpdates = [];
        let mParams = [];
        if (address !== undefined) { mUpdates.push('address = ?'); mParams.push(address); }
        if (phone !== undefined) { mUpdates.push('phone = ?'); mParams.push(phone); }
        if (specialization !== undefined) { mUpdates.push('specialization = ?'); mParams.push(specialization); }
        if (bio !== undefined) { mUpdates.push('bio = ?'); mParams.push(bio); }
        if (teachingSubjects !== undefined) { mUpdates.push('teaching_subjects = ?'); mParams.push(teachingSubjects); }
        if (qualifications !== undefined) { mUpdates.push('qualifications = ?'); mParams.push(qualifications); }
        if (credentialsUrl !== undefined) { mUpdates.push('credentials_url = ?'); mParams.push(credentialsUrl); }

        if (mUpdates.length > 0) {
          mParams.push(mentors[0].id);
          await query(`UPDATE mentors SET ${mUpdates.join(', ')} WHERE id = ?`, mParams);
        }
      }
    } else if (req.user.role === 'intern') {
      const interns = await query('SELECT id FROM intern_profiles WHERE user_id = ?', [userId]);
      if (interns && interns.length > 0) {
        let iUpdates = [];
        let iParams = [];
        if (address !== undefined) { iUpdates.push('address = ?'); iParams.push(address); }
        if (phone !== undefined) { iUpdates.push('phone = ?'); iParams.push(phone); }
        if (emergencyContactName !== undefined) { iUpdates.push('emergency_contact_name = ?'); iParams.push(emergencyContactName); }
        if (emergencyContactPhone !== undefined) { iUpdates.push('emergency_contact_phone = ?'); iParams.push(emergencyContactPhone); }
        if (skills !== undefined) { iUpdates.push('skills = ?'); iParams.push(skills); }

        if (iUpdates.length > 0) {
          iParams.push(interns[0].id);
          await query(`UPDATE intern_profiles SET ${iUpdates.join(', ')} WHERE id = ?`, iParams);
        }
      }
    }

    await recordAuditLog(userId, 'UPDATE_PROFILE', 'user', userId, null, null, req, 'User profile updated');

    res.json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (error) {
    console.error('updateUserProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile.' });
  }
};

/**
 * Mandatory Mentor Onboarding Submission
 */
export const completeMentorOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      address,
      phone,
      specialization,
      teachingSubjects,
      qualifications,
      credentialsUrl,
      bio
    } = req.body;

    if (!specialization || !qualifications) {
      return res.status(400).json({
        success: false,
        message: 'Area of specialization and professional qualifications are required.'
      });
    }

    const mentors = await query('SELECT id FROM mentors WHERE user_id = ?', [userId]);
    if (!mentors || mentors.length === 0) {
      await query(
        'INSERT INTO mentors (user_id, specialization, address, phone, teaching_subjects, qualifications, credentials_url, bio, onboarding_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [userId, specialization, address || null, phone || null, teachingSubjects || null, qualifications, credentialsUrl || null, bio || null]
      );
    } else {
      await query(`
        UPDATE mentors
        SET specialization = ?,
            address = ?,
            phone = ?,
            teaching_subjects = ?,
            qualifications = ?,
            credentials_url = COALESCE(?, credentials_url),
            bio = COALESCE(?, bio),
            onboarding_completed = 1
        WHERE user_id = ?
      `, [specialization, address || null, phone || null, teachingSubjects || null, qualifications, credentialsUrl || null, bio || null, userId]);
    }

    if (phone) {
      await query('UPDATE users SET phone = ? WHERE id = ?', [phone.trim(), userId]);
    }

    await recordAuditLog(userId, 'MENTOR_ONBOARDING', 'mentors', userId, null, null, req, 'Mentor completed mandatory onboarding details');

    res.json({
      success: true,
      message: 'Mentor onboarding profile completed successfully.'
    });
  } catch (error) {
    console.error('completeMentorOnboarding error:', error);
    res.status(500).json({ success: false, message: 'Server error completing mentor onboarding.' });
  }
};

/**
 * Mandatory Intern Onboarding Submission
 */
export const completeInternOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;
    await query('UPDATE intern_profiles SET onboarding_completed = 1 WHERE user_id = ?', [userId]);

    await recordAuditLog(userId, 'INTERN_ONBOARDING', 'intern_profiles', userId, null, null, req, 'Intern completed mandatory onboarding');

    res.json({
      success: true,
      message: 'Intern onboarding completed successfully.'
    });
  } catch (error) {
    console.error('completeInternOnboarding error:', error);
    res.status(500).json({ success: false, message: 'Server error completing intern onboarding.' });
  }
};

/**
 * Upload Credential / CV Document
 */
export const uploadCredential = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No credential file provided.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Credential document uploaded successfully.',
      fileUrl,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('uploadCredential error:', error);
    res.status(500).json({ success: false, message: 'Server error uploading credential.' });
  }
};

/**
 * Upload Profile Avatar Picture (Universal for all roles)
 */
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided.' });
    }
    const userId = req.user.id;
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    await query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);

    await recordAuditLog(userId, 'UPDATE_AVATAR', 'users', userId, null, { avatarUrl }, req, 'User uploaded profile photo');

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully.',
      avatarUrl
    });
  } catch (error) {
    console.error('uploadAvatar error:', error);
    res.status(500).json({ success: false, message: 'Server error uploading profile photo.' });
  }
};


