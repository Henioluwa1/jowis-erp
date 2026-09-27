import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';
import { getLagosDate } from '../utils/timezone.js';
import { generateSecureTemporaryPassword } from '../utils/passwordGenerator.js';
import notificationService from '../services/notificationService.js';
import { parseScheduleDays } from '../utils/scheduleHelper.js';

// 9 Permitted lifecycle statuses
export const ALLOWED_LIFECYCLE_STATUSES = [
  'applied',
  'screening',
  'accepted',
  'onboarding',
  'active',
  'suspended',
  'completed',
  'dropped',
  'alumni'
];

/**
 * Valid state transitions map
 */
export const PERMITTED_TRANSITIONS = {
  applied: ['screening', 'dropped'],
  screening: ['accepted', 'dropped'],
  accepted: ['onboarding', 'dropped'],
  onboarding: ['active', 'dropped'],
  active: ['suspended', 'completed', 'dropped'],
  suspended: ['active', 'dropped'],
  completed: ['alumni'],
  dropped: ['screening', 'applied'],
  alumni: []
};

/**
 * List interns with comprehensive filters, search, pagination, and RBAC isolation
 */
export const getAllInterns = async (req, res) => {
  try {
    const { trackId, cohortId, mentorId, status, search, page = 1, limit = 25 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let conditions = [];
    let params = [];

    // Mentor RBAC isolation: mentors only see interns assigned to them or in their lead cohorts
    if (req.user.role === 'mentor') {
      conditions.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      params.push(req.user.mentorId, req.user.mentorId);
    }

    if (trackId) {
      conditions.push('ip.track_id = ?');
      params.push(trackId);
    }
    if (cohortId) {
      conditions.push('ip.cohort_id = ?');
      params.push(cohortId);
    }
    if (mentorId) {
      conditions.push('ip.mentor_id = ?');
      params.push(mentorId);
    }
    if (status) {
      conditions.push('ip.status = ?');
      params.push(status.toLowerCase());
    }
    if (search && search.trim()) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR ip.intern_code LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const interns = await query(`
      SELECT ip.id, ip.intern_code, ip.status, ip.start_date, ip.expected_end_date, ip.actual_end_date, ip.phone,
             ip.schedule_days, ip.schedule_locked,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url, u.is_active as user_active,
             t.id as track_id, t.name as track_name, t.code as track_code,
             c.id as cohort_id, c.name as cohort_name, c.cohort_code, c.status as cohort_status,
             m.id as mentor_id, mu.first_name as mentor_first, mu.last_name as mentor_last, mu.email as mentor_email
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      ${whereClause}
      ORDER BY FIELD(ip.status, 'active', 'onboarding', 'screening', 'accepted', 'applied', 'suspended', 'completed', 'dropped', 'alumni'), ip.id DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    const formattedInterns = interns.map(i => ({
      ...i,
      schedule_days: parseScheduleDays(i.schedule_days) || [],
      schedule_locked: Boolean(i.schedule_locked)
    }));

    const [countResult] = await query(`
      SELECT COUNT(*) as count
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: formattedInterns,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: countResult.count,
        pages: Math.ceil(countResult.count / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('getAllInterns error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve interns.' });
  }
};

/**
 * Get detailed profile for an intern with assignment & lifecycle history
 */
export const getInternById = async (req, res) => {
  try {
    const requestedId = parseInt(req.params.id, 10);

    // Ownership check for interns: can only view own profile
    if (req.user.role === 'intern' && req.user.internProfileId !== requestedId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot view another intern's private profile."
      });
    }

    const [intern] = await query(`
      SELECT ip.*,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url, u.created_at as account_created,
             t.name as track_name, t.code as track_code, t.duration_weeks,
             c.name as cohort_name, c.cohort_code, c.status as cohort_status, c.start_date as cohort_start, c.end_date as cohort_end,
             m.id as mentor_id, mu.first_name as mentor_first, mu.last_name as mentor_last, mu.email as mentor_email, m.specialization as mentor_specialization
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      WHERE ip.id = ?
    `, [requestedId]);

    if (!intern) {
      return res.status(404).json({ success: false, message: 'Intern not found.' });
    }

    // Mentor RBAC check: mentor can only view intern if assigned or lead
    if (req.user.role === 'mentor') {
      const [leadCohort] = await query('SELECT lead_mentor_id FROM cohorts WHERE id = ?', [intern.cohort_id]);
      const isAssignedMentor = intern.mentor_id === req.user.mentorId;
      const isLeadMentor = leadCohort?.lead_mentor_id === req.user.mentorId;
      if (!isAssignedMentor && !isLeadMentor) {
        return res.status(403).json({ success: false, message: 'Forbidden: You are not assigned to mentor this intern.' });
      }
    }

    // Attendance stats
    const [attStats] = await query(`
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'EXCUSED' THEN 1 ELSE 0 END) as excused_days
      FROM attendance
      WHERE intern_id = ?
    `, [requestedId]);

    // Assignment history
    const assignmentHistory = await query(`
      SELECT iah.*, u.first_name as changer_first, u.last_name as changer_last
      FROM intern_assignment_history iah
      JOIN users u ON iah.changed_by = u.id
      WHERE iah.intern_id = ?
      ORDER BY iah.created_at DESC
    `, [requestedId]);

    // Lifecycle history
    const lifecycleHistory = await query(`
      SELECT ilh.*, u.first_name as changer_first, u.last_name as changer_last
      FROM intern_lifecycle_history ilh
      JOIN users u ON ilh.changed_by = u.id
      WHERE ilh.intern_id = ?
      ORDER BY ilh.created_at DESC
    `, [requestedId]);

    // Performance evaluations
    const evaluations = await query(`
      SELECT pe.*, u.first_name as evaluator_first, u.last_name as evaluator_last
      FROM performance_evaluations pe
      JOIN users u ON pe.evaluator_id = u.id
      WHERE pe.intern_id = ?
      ORDER BY pe.created_at DESC
    `, [requestedId]);

    // Task submissions
    const tasks = await query(`
      SELECT ts.*, t.title as task_title, t.due_date, t.max_score
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      WHERE ts.intern_id = ?
      ORDER BY ts.submitted_at DESC
    `, [requestedId]);

    intern.schedule_days = parseScheduleDays(intern.schedule_days) || [];
    intern.schedule_locked = Boolean(intern.schedule_locked);

    res.json({
      success: true,
      data: {
        profile: intern,
        attendanceStats: attStats,
        assignmentHistory,
        lifecycleHistory,
        evaluations,
        tasks
      }
    });
  } catch (error) {
    console.error('getInternById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve intern details.' });
  }
};

/**
 * Register new Intern (Creates User + Intern Profile + Initial Assignment & Lifecycle History)
 */
export const createIntern = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      trackId,
      cohortId,
      mentorId,
      gender,
      dateOfBirth,
      address,
      education,
      skills,
      startDate,
      expectedEndDate
    } = req.body;

    if (!firstName || !lastName || !email || !trackId || !cohortId || !startDate) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, track, cohort, and start date are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check email uniqueness
    const [existingUser] = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email address already exists.' });
    }

    // Validate Track
    const [track] = await query('SELECT id, name, code, is_active FROM tracks WHERE id = ?', [trackId]);
    if (!track) {
      return res.status(400).json({ success: false, message: 'Selected track does not exist.' });
    }
    if (track.is_active === 0) {
      return res.status(400).json({ success: false, message: 'Cannot enroll intern into a deactivated track.' });
    }

    // Validate Cohort
    const [cohort] = await query('SELECT id, name, cohort_code, track_id, status FROM cohorts WHERE id = ?', [cohortId]);
    if (!cohort) {
      return res.status(400).json({ success: false, message: 'Selected cohort does not exist.' });
    }
    if (cohort.status === 'archived') {
      return res.status(400).json({ success: false, message: 'Cannot enroll intern into an archived cohort.' });
    }

    // Relational rule: Cohort must belong to the selected Track
    if (cohort.track_id !== parseInt(trackId, 10)) {
      return res.status(400).json({
        success: false,
        message: `Selected cohort '${cohort.name}' does not belong to track '${track.name}'. Interns must be enrolled in cohorts that match their track.`
      });
    }

    // Validate Mentor if supplied
    let mentorName = null;
    if (mentorId) {
      const [mentor] = await query(`
        SELECT m.id, u.first_name, u.last_name, u.is_active
        FROM mentors m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `, [mentorId]);
      if (!mentor || mentor.is_active === 0) {
        return res.status(400).json({ success: false, message: 'Assigned mentor is invalid or inactive.' });
      }
      mentorName = `${mentor.first_name} ${mentor.last_name}`;
    }

    // Validate dates
    let finalEnd = expectedEndDate;
    if (!finalEnd) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + 6);
      finalEnd = d.toISOString().split('T')[0];
    }
    if (new Date(finalEnd) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'Expected end date cannot precede start date.' });
    }

    // Automatically generate cryptographically secure temporary password (Part 3)
    const tempPassword = (password && password.trim().length >= 8)
      ? password.trim()
      : generateSecureTemporaryPassword(14);

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    // 1. Create User with must_change_password = 1 (Part 4)
    const userResult = await query(
      `INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone, is_active, must_change_password)
       VALUES (4, ?, ?, ?, ?, ?, 1, 1)`,
      [cleanEmail, passwordHash, firstName.trim(), lastName.trim(), phone ? phone.trim() : null]
    );
    const userId = userResult.insertId;

    // Generate unique intern code e.g. JOWIS-INT-2026-XXXX
    let internCode;
    let codeUnique = false;
    let attempts = 0;
    while (!codeUnique && attempts < 10) {
      attempts++;
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidateCode = `JOWIS-INT-2026-${rand}`;
      const [existingCode] = await query('SELECT id FROM intern_profiles WHERE intern_code = ?', [candidateCode]);
      if (!existingCode) {
        internCode = candidateCode;
        codeUnique = true;
      }
    }

    // 2. Create Intern Profile with initial 'active' status
    const profileResult = await query(
      `INSERT INTO intern_profiles
       (user_id, intern_code, track_id, cohort_id, mentor_id, phone, gender, date_of_birth, address, education, skills, status, start_date, expected_end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        userId,
        internCode,
        trackId,
        cohortId,
        mentorId || null,
        phone ? phone.trim() : null,
        gender || null,
        dateOfBirth || null,
        address ? address.trim() : null,
        education ? education.trim() : null,
        skills ? skills.trim() : null,
        startDate,
        finalEnd
      ]
    );
    const internProfileId = profileResult.insertId;

    // 3. Record Initial Lifecycle History
    await query(
      `INSERT INTO intern_lifecycle_history (intern_id, previous_status, new_status, reason, changed_by)
       VALUES (?, NULL, 'active', 'Initial program enrollment and onboarding', ?)`,
      [internProfileId, req.user.id]
    );

    // 4. Record Initial Assignment History
    await query(
      `INSERT INTO intern_assignment_history (intern_id, assignment_type, previous_id, new_id, previous_name, new_name, reason, changed_by)
       VALUES
       (?, 'track', NULL, ?, NULL, ?, 'Initial track enrollment', ?),
       (?, 'cohort', NULL, ?, NULL, ?, 'Initial cohort enrollment', ?)`,
      [
        internProfileId, trackId, track.name, req.user.id,
        internProfileId, cohortId, cohort.name, req.user.id
      ]
    );

    if (mentorId) {
      await query(
        `INSERT INTO intern_assignment_history (intern_id, assignment_type, previous_id, new_id, previous_name, new_name, reason, changed_by)
         VALUES (?, 'mentor', NULL, ?, NULL, ?, 'Initial mentor assignment', ?)`,
        [internProfileId, mentorId, mentorName, req.user.id]
      );
    }

    // Seed default notification preferences
    await query(`
      INSERT IGNORE INTO notification_preferences (user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications)
      VALUES (?, 1, 1, 1, 1, 1, 0)
    `, [userId]);

    // Send Welcome Notification (Part 10)
    await notificationService.createNotification({
      userId,
      type: 'system',
      title: 'Welcome to Jowis Studio ERP',
      message: 'Welcome to Jowis Studio ERP. Your account has been created successfully. For security, please change your temporary password to a password of your choice.',
      link: '/profile'
    });

    await recordAuditLog(req.user.id, 'CREATE_INTERN', 'intern_profiles', internProfileId, null, { email: cleanEmail, internCode, trackId, cohortId }, req);

    res.status(201).json({
      success: true,
      message: `Intern ${firstName} ${lastName} (${internCode}) successfully registered.`,
      data: {
        id: internProfileId,
        userId,
        internCode,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        username: cleanEmail,
        roleName: 'intern',
        status: 'active',
        mustChangePassword: true,
        temporaryPassword: tempPassword
      }
    });
  } catch (error) {
    console.error('createIntern error:', error);
    res.status(500).json({ success: false, message: 'Server error creating intern profile.' });
  }
};

/**
 * Update general intern personal and contact info (excluding administrative assignments)
 */
export const updateIntern = async (req, res) => {
  try {
    const internId = parseInt(req.params.id, 10);
    const { firstName, lastName, phone, address, gender, dateOfBirth, education, skills, notes } = req.body;

    const [existing] = await query(`
      SELECT ip.*, u.first_name, u.last_name, u.email
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      WHERE ip.id = ?
    `, [internId]);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Intern not found.' });
    }

    // Intern can only update personal contact details (phone, address) on own profile
    if (req.user.role === 'intern') {
      if (req.user.internProfileId !== internId) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      await query(
        `UPDATE intern_profiles SET phone = COALESCE(?, phone), address = COALESCE(?, address) WHERE id = ?`,
        [phone || null, address || null, internId]
      );
      if (phone) {
        await query(`UPDATE users SET phone = ? WHERE id = ?`, [phone, existing.user_id]);
      }
      return res.json({ success: true, message: 'Profile contact details updated.' });
    }

    // Guard: Mentors and unauthorized roles cannot edit administrative profile fields
    if (req.user.role === 'mentor') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Mentors are not authorized to edit intern administrative profiles.'
      });
    }

    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Administrative privileges required.' });
    }

    // Admin updates
    await query(
      `UPDATE intern_profiles
       SET phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           gender = COALESCE(?, gender),
           date_of_birth = COALESCE(?, date_of_birth),
           education = COALESCE(?, education),
           skills = COALESCE(?, skills),
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        phone !== undefined ? phone : existing.phone,
        address !== undefined ? address : existing.address,
        gender !== undefined ? gender : existing.gender,
        dateOfBirth !== undefined ? dateOfBirth : existing.date_of_birth,
        education !== undefined ? education : existing.education,
        skills !== undefined ? skills : existing.skills,
        notes !== undefined ? notes : existing.notes,
        internId
      ]
    );

    if (firstName || lastName || phone) {
      await query(
        `UPDATE users
         SET first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone)
         WHERE id = ?`,
        [firstName || null, lastName || null, phone || null, existing.user_id]
      );
    }

    await recordAuditLog(req.user.id, 'UPDATE_INTERN_PROFILE', 'intern_profiles', internId, existing, req.body, req);

    res.json({ success: true, message: 'Intern profile updated successfully.' });
  } catch (error) {
    console.error('updateIntern error:', error);
    res.status(500).json({ success: false, message: 'Failed to update intern profile.' });
  }
};

/**
 * Reassign Intern (Track, Cohort, or Mentor) with relational history tracking and strict validations (Gate 5)
 */
export const reassignIntern = async (req, res) => {
  try {
    const internId = parseInt(req.params.id, 10);
    const { type, targetId, newCohortId, reason } = req.body;

    if (!type || !targetId || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Assignment type, target ID, and mandatory audit reason are required.'
      });
    }

    const [intern] = await query(`
      SELECT ip.*,
             t.name as track_name,
             c.name as cohort_name,
             mu.first_name as mentor_first, mu.last_name as mentor_last
      FROM intern_profiles ip
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      WHERE ip.id = ?
    `, [internId]);

    if (!intern) {
      return res.status(404).json({ success: false, message: 'Intern not found.' });
    }

    if (type === 'cohort') {
      const cohortId = parseInt(targetId, 10);
      const [newCohort] = await query('SELECT id, name, track_id, status FROM cohorts WHERE id = ?', [cohortId]);
      if (!newCohort) {
        return res.status(400).json({ success: false, message: 'Target cohort does not exist.' });
      }
      if (newCohort.status === 'archived') {
        return res.status(400).json({ success: false, message: 'Cannot assign intern to an archived cohort.' });
      }

      // Check track consistency
      if (newCohort.track_id !== intern.track_id) {
        return res.status(400).json({
          success: false,
          message: `Cannot assign to cohort '${newCohort.name}' because it belongs to a different track. Change track first or choose a cohort within the intern's active track.`
        });
      }

      if (intern.cohort_id === cohortId) {
        return res.status(400).json({ success: false, message: 'Intern is already assigned to this cohort.' });
      }

      // Update intern cohort
      await query('UPDATE intern_profiles SET cohort_id = ? WHERE id = ?', [cohortId, internId]);

      // Record in assignment history
      await query(`
        INSERT INTO intern_assignment_history (intern_id, assignment_type, previous_id, new_id, previous_name, new_name, reason, changed_by)
        VALUES (?, 'cohort', ?, ?, ?, ?, ?, ?)
      `, [internId, intern.cohort_id, cohortId, intern.cohort_name, newCohort.name, reason.trim(), req.user.id]);

      await recordAuditLog(req.user.id, 'REASSIGN_COHORT', 'intern_profiles', internId, { cohort_id: intern.cohort_id }, { cohort_id: cohortId, reason: reason.trim() }, req);

      return res.json({
        success: true,
        message: `Intern successfully reassigned from '${intern.cohort_name}' to '${newCohort.name}'.`,
        data: { internId, type: 'cohort', newCohortId: cohortId, newCohortName: newCohort.name }
      });
    }

    if (type === 'track') {
      const trackId = parseInt(targetId, 10);
      const [newTrack] = await query('SELECT id, name, is_active FROM tracks WHERE id = ?', [trackId]);
      if (!newTrack) {
        return res.status(400).json({ success: false, message: 'Target track does not exist.' });
      }
      if (newTrack.is_active === 0) {
        return res.status(400).json({ success: false, message: 'Cannot reassign intern to a deactivated track.' });
      }

      // Must also supply valid newCohortId belonging to this new track
      if (!newCohortId) {
        return res.status(400).json({
          success: false,
          message: 'When reassigning to a new track, you must also select an active cohort (newCohortId) belonging to that track.'
        });
      }

      const [newCohort] = await query('SELECT id, name, track_id, status FROM cohorts WHERE id = ?', [newCohortId]);
      if (!newCohort || newCohort.track_id !== trackId) {
        return res.status(400).json({
          success: false,
          message: `The selected cohort does not belong to the target track '${newTrack.name}'.`
        });
      }
      if (newCohort.status === 'archived') {
        return res.status(400).json({ success: false, message: 'Target cohort cannot be archived.' });
      }

      // Update both track and cohort
      await query('UPDATE intern_profiles SET track_id = ?, cohort_id = ? WHERE id = ?', [trackId, newCohort.id, internId]);

      // Record track reassignment
      await query(`
        INSERT INTO intern_assignment_history (intern_id, assignment_type, previous_id, new_id, previous_name, new_name, reason, changed_by)
        VALUES (?, 'track', ?, ?, ?, ?, ?, ?)
      `, [internId, intern.track_id, trackId, intern.track_name, newTrack.name, reason.trim(), req.user.id]);

      // Record cohort reassignment
      await query(`
        INSERT INTO intern_assignment_history (intern_id, assignment_type, previous_id, new_id, previous_name, new_name, reason, changed_by)
        VALUES (?, 'cohort', ?, ?, ?, ?, ?, ?)
      `, [internId, intern.cohort_id, newCohort.id, intern.cohort_name, newCohort.name, `Track transfer to ${newTrack.name}: ${reason.trim()}`, req.user.id]);

      await recordAuditLog(req.user.id, 'REASSIGN_TRACK', 'intern_profiles', internId, { track_id: intern.track_id, cohort_id: intern.cohort_id }, { track_id: trackId, cohort_id: newCohort.id, reason: reason.trim() }, req);

      return res.json({
        success: true,
        message: `Intern successfully transferred to track '${newTrack.name}' and cohort '${newCohort.name}'.`,
        data: { internId, type: 'track', newTrackId: trackId, newCohortId: newCohort.id }
      });
    }

    if (type === 'mentor') {
      const mentorId = parseInt(targetId, 10);
      const [newMentor] = await query(`
        SELECT m.id, u.first_name, u.last_name, u.is_active
        FROM mentors m
        JOIN users u ON m.user_id = u.id
        WHERE m.id = ?
      `, [mentorId]);

      if (!newMentor || newMentor.is_active === 0) {
        return res.status(400).json({ success: false, message: 'Assigned mentor is invalid or inactive.' });
      }

      const prevMentorName = intern.mentor_first ? `${intern.mentor_first} ${intern.mentor_last}` : 'Unassigned';
      const newMentorName = `${newMentor.first_name} ${newMentor.last_name}`;

      await query('UPDATE intern_profiles SET mentor_id = ? WHERE id = ?', [mentorId, internId]);

      await query(`
        INSERT INTO intern_assignment_history (intern_id, assignment_type, previous_id, new_id, previous_name, new_name, reason, changed_by)
        VALUES (?, 'mentor', ?, ?, ?, ?, ?, ?)
      `, [internId, intern.mentor_id, mentorId, prevMentorName, newMentorName, reason.trim(), req.user.id]);

      await recordAuditLog(req.user.id, 'REASSIGN_MENTOR', 'intern_profiles', internId, { mentor_id: intern.mentor_id }, { mentor_id: mentorId, reason: reason.trim() }, req);

      return res.json({
        success: true,
        message: `Lead mentor successfully reassigned to ${newMentorName}.`,
        data: { internId, type: 'mentor', newMentorId: mentorId, newMentorName }
      });
    }

    res.status(400).json({ success: false, message: 'Invalid assignment type. Must be track, cohort, or mentor.' });
  } catch (error) {
    console.error('reassignIntern error:', error);
    res.status(500).json({ success: false, message: 'Server error during reassignment.' });
  }
};

/**
 * Transition Intern Lifecycle Status with State Engine validations and History Recording (Gate 6)
 */
export const transitionLifecycle = async (req, res) => {
  try {
    const internId = parseInt(req.params.id, 10);
    const { newStatus, reason, actualEndDate } = req.body;

    if (!newStatus || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'New status and mandatory audit reason are required.'
      });
    }

    const cleanStatus = newStatus.trim().toLowerCase();
    if (!ALLOWED_LIFECYCLE_STATUSES.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid lifecycle status '${newStatus}'. Allowed: ${ALLOWED_LIFECYCLE_STATUSES.join(', ')}.`
      });
    }

    const [intern] = await query('SELECT id, status, actual_end_date FROM intern_profiles WHERE id = ?', [internId]);
    if (!intern) {
      return res.status(404).json({ success: false, message: 'Intern not found.' });
    }

    const currentStatus = intern.status;
    if (currentStatus === cleanStatus) {
      return res.status(400).json({ success: false, message: `Intern is already in '${cleanStatus}' status.` });
    }

    // State machine check (Super Admin can perform override if explicit)
    const allowedNext = PERMITTED_TRANSITIONS[currentStatus] || [];
    const isSuperAdmin = req.user.role === 'super_admin';
    if (!allowedNext.includes(cleanStatus) && !isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: `Transition from '${currentStatus}' to '${cleanStatus}' is not permitted. Valid next statuses: ${allowedNext.join(', ') || 'none (terminal)'}.`
      });
    }

    const { date: lagosDate } = getLagosDate();
    let finalActualEndDate = intern.actual_end_date;

    if (cleanStatus === 'completed' || cleanStatus === 'dropped') {
      finalActualEndDate = actualEndDate || lagosDate;
    }

    // Update intern profile
    await query(
      `UPDATE intern_profiles SET status = ?, actual_end_date = ? WHERE id = ?`,
      [cleanStatus, finalActualEndDate, internId]
    );

    // Record in intern_lifecycle_history
    await query(
      `INSERT INTO intern_lifecycle_history (intern_id, previous_status, new_status, reason, changed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [internId, currentStatus, cleanStatus, reason.trim(), req.user.id]
    );

    await recordAuditLog(req.user.id, 'TRANSITION_LIFECYCLE', 'intern_profiles', internId, { status: currentStatus }, { status: cleanStatus, reason: reason.trim() }, req);

    res.json({
      success: true,
      message: `Intern lifecycle status transitioned from '${currentStatus}' to '${cleanStatus}'.`,
      data: { internId, previousStatus: currentStatus, newStatus: cleanStatus }
    });
  } catch (error) {
    console.error('transitionLifecycle error:', error);
    res.status(500).json({ success: false, message: 'Server error during lifecycle transition.' });
  }
};

/**
 * Get intern assignment history
 */
export const getAssignmentHistory = async (req, res) => {
  try {
    const internId = parseInt(req.params.id, 10);
    const history = await query(`
      SELECT iah.*, u.first_name as changer_first, u.last_name as changer_last
      FROM intern_assignment_history iah
      JOIN users u ON iah.changed_by = u.id
      WHERE iah.intern_id = ?
      ORDER BY iah.created_at DESC
    `, [internId]);

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('getAssignmentHistory error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assignment history.' });
  }
};

/**
 * Get intern lifecycle history
 */
export const getLifecycleHistory = async (req, res) => {
  try {
    const internId = parseInt(req.params.id, 10);
    const history = await query(`
      SELECT ilh.*, u.first_name as changer_first, u.last_name as changer_last
      FROM intern_lifecycle_history ilh
      JOIN users u ON ilh.changed_by = u.id
      WHERE ilh.intern_id = ?
      ORDER BY ilh.created_at DESC
    `, [internId]);

    res.json({ success: true, data: history });
  } catch (error) {
    console.error('getLifecycleHistory error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve lifecycle history.' });
  }
};
