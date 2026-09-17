import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';

/**
 * List interns with filters & pagination
 */
export const getAllInterns = async (req, res) => {
  try {
    const { trackId, cohortId, status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let conditions = [];
    let params = [];

    if (trackId) {
      conditions.push('ip.track_id = ?');
      params.push(trackId);
    }
    if (cohortId) {
      conditions.push('ip.cohort_id = ?');
      params.push(cohortId);
    }
    if (status) {
      conditions.push('ip.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR ip.intern_code LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const interns = await query(`
      SELECT ip.id, ip.intern_code, ip.status, ip.start_date, ip.expected_end_date, ip.phone,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url,
             t.id as track_id, t.name as track_name,
             c.id as cohort_id, c.name as cohort_name,
             m.id as mentor_id, mu.first_name as mentor_first, mu.last_name as mentor_last
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      ${whereClause}
      ORDER BY ip.id DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    const [countResult] = await query(`
      SELECT COUNT(*) as count
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: interns,
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
 * Get detailed profile for an intern
 */
export const getInternById = async (req, res) => {
  try {
    const requestedId = parseInt(req.params.id, 10);

    // Ownership check for interns
    if (req.user.role === 'intern' && req.user.internProfileId !== requestedId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot view another intern's private profile."
      });
    }

    const [intern] = await query(`
      SELECT ip.*,
             u.id as user_id, u.first_name, u.last_name, u.email, u.avatar_url, u.created_at as account_created,
             t.name as track_name, t.duration_weeks,
             c.name as cohort_name, c.start_date as cohort_start, c.end_date as cohort_end,
             m.id as mentor_id, mu.first_name as mentor_first, mu.last_name as mentor_last, m.specialization as mentor_specialization
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

    // Attendance stats
    const [attStats] = await query(`
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days
      FROM attendance
      WHERE intern_id = ?
    `, [requestedId]);

    // Progress modules
    const modules = await query(`
      SELECT * FROM curriculum_progress WHERE intern_id = ? ORDER BY module_order ASC
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

    res.json({
      success: true,
      data: {
        profile: intern,
        attendanceStats: attStats,
        curriculum: modules,
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
 * Register new Intern (Creates User + Intern Profile)
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

    // Check email uniqueness
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email address already exists.' });
    }

    // Hash password (default to Intern@12345 if not provided)
    const passwordHash = await bcrypt.hash(password || 'Intern@12345', 10);

    // 1. Create User
    const userResult = await query(
      `INSERT INTO users (role_id, email, password_hash, first_name, last_name, phone, is_active)
       VALUES (4, ?, ?, ?, ?, ?, 1)`,
      [email.trim().toLowerCase(), passwordHash, firstName.trim(), lastName.trim(), phone || null]
    );

    const userId = userResult.insertId;

    // Generate unique intern code e.g. JOWIS-INT-2026-XXXX
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const internCode = `JOWIS-INT-2026-${randomNum}`;

    // 2. Create Intern Profile
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
        phone || null,
        gender || null,
        dateOfBirth || null,
        address || null,
        education || null,
        skills || null,
        startDate,
        expectedEndDate || '2026-08-31'
      ]
    );

    await recordAuditLog(req.user.id, 'CREATE_INTERN', 'intern_profile', profileResult.insertId, null, { email, internCode }, req);

    res.status(201).json({
      success: true,
      message: 'Intern successfully registered.',
      data: {
        id: profileResult.insertId,
        userId,
        internCode,
        email
      }
    });
  } catch (error) {
    console.error('createIntern error:', error);
    res.status(500).json({ success: false, message: 'Server error creating intern.' });
  }
};

/**
 * Update intern status or info
 */
export const updateIntern = async (req, res) => {
  try {
    const internId = parseInt(req.params.id, 10);
    const { status, trackId, cohortId, mentorId, phone, address, notes } = req.body;

    const [existing] = await query('SELECT * FROM intern_profiles WHERE id = ?', [internId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Intern not found.' });
    }

    await query(
      `UPDATE intern_profiles
       SET status = COALESCE(?, status),
           track_id = COALESCE(?, track_id),
           cohort_id = COALESCE(?, cohort_id),
           mentor_id = COALESCE(?, mentor_id),
           phone = COALESCE(?, phone),
           address = COALESCE(?, address),
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [status || null, trackId || null, cohortId || null, mentorId || null, phone || null, address || null, notes || null, internId]
    );

    await recordAuditLog(req.user.id, 'UPDATE_INTERN', 'intern_profile', internId, existing, req.body, req);

    res.json({ success: true, message: 'Intern updated successfully.' });
  } catch (error) {
    console.error('updateIntern error:', error);
    res.status(500).json({ success: false, message: 'Failed to update intern profile.' });
  }
};
