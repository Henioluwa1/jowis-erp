import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';
import { createNotification } from '../services/notificationService.js';
import {
  parseScheduleDays,
  calculateAffectedScheduledDays,
  isScheduledDay
} from '../utils/scheduleHelper.js';

/**
 * Calculate affected scheduled working days for a proposed date range.
 * Checks ONLY the intern's active 3-day schedule and excludes company holidays.
 */
export const calculateDays = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    let internId = req.body.internId;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required.' });
    }

    if (req.user.role === 'intern') {
      internId = req.user.internProfileId;
    }

    if (!internId) {
      return res.status(400).json({ success: false, message: 'internId is required.' });
    }

    const [intern] = await query('SELECT id, schedule_days, schedule_locked FROM intern_profiles WHERE id = ?', [internId]);
    if (!intern) {
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }

    const scheduleDays = parseScheduleDays(intern.schedule_days);
    if (!scheduleDays || scheduleDays.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Intern attendance schedule is not configured. Please set your 3-day schedule first.'
      });
    }

    // Fetch active company holidays
    const holidays = await query('SELECT holiday_date FROM company_holidays WHERE is_active = 1');
    const holidayDates = holidays.map(h => {
      const d = new Date(h.holiday_date);
      return d.toISOString().split('T')[0];
    });

    const { count, dates } = calculateAffectedScheduledDays(startDate, endDate, scheduleDays, holidayDates);

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        scheduleDays,
        affectedDaysCount: count,
        affectedDates: dates
      }
    });
  } catch (error) {
    console.error('calculateDays error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate affected scheduled days.' });
  }
};

/**
 * Submit a permission request (Intern workflow)
 */
export const createPermissionRequest = async (req, res) => {
  try {
    const internId = req.user.internProfileId;
    if (!internId) {
      return res.status(403).json({ success: false, message: 'Only registered interns can submit permission requests.' });
    }

    const { startDate, endDate, reason, message, requestType = 'absence' } = req.body;

    if (!startDate || !endDate || !reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, and reason are mandatory for permission requests.'
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date.' });
    }

    const [intern] = await query(`
      SELECT ip.*, u.first_name, u.last_name, u.email, m.user_id as mentor_user_id
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      WHERE ip.id = ?
    `, [internId]);

    if (!intern) {
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }

    const scheduleDays = parseScheduleDays(intern.schedule_days);
    if (!scheduleDays || scheduleDays.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'You must configure your permanent 3-day attendance schedule before requesting permission.'
      });
    }

    // Fetch active company holidays
    const holidays = await query('SELECT holiday_date FROM company_holidays WHERE is_active = 1');
    const holidayDates = holidays.map(h => {
      const d = new Date(h.holiday_date);
      return d.toISOString().split('T')[0];
    });

    const { count, dates } = calculateAffectedScheduledDays(startDate, endDate, scheduleDays, holidayDates);

    if (count === 0) {
      return res.status(400).json({
        success: false,
        message: `The requested period (${startDate} to ${endDate}) does not overlap with any of your scheduled attendance days (${scheduleDays.map(d => d.toUpperCase()).join(', ')}). No permission request is required.`
      });
    }

    // Generate unique request code e.g. PR-2026-0001
    const [counterRow] = await query('SELECT COUNT(*) as cnt FROM permission_requests');
    const nextSeq = String((counterRow?.cnt || 0) + 1).padStart(4, '0');
    const requestCode = `PR-${new Date().getFullYear()}-${nextSeq}`;

    const insertResult = await query(`
      INSERT INTO permission_requests (
        intern_id, request_code, request_type, start_date, end_date,
        affected_days_count, affected_dates, reason, message, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [
      internId,
      requestCode,
      requestType,
      startDate,
      endDate,
      count,
      JSON.stringify(dates),
      reason.trim(),
      message?.trim() || null
    ]);

    const createdId = insertResult.insertId;

    // Record Audit Log (Gate 20)
    await recordAuditLog(
      req.user.id,
      'PERMISSION_REQUESTED',
      'permission_requests',
      createdId,
      null,
      { requestCode, startDate, endDate, affectedDaysCount: count, reason },
      req,
      `Permission requested by ${intern.first_name} ${intern.last_name} for ${count} scheduled work days.`
    );

    // Notify assigned mentor
    if (intern.mentor_user_id) {
      await createNotification({
        userId: intern.mentor_user_id,
        type: 'attendance',
        title: 'New Intern Absence Request',
        message: `${intern.first_name} ${intern.last_name} submitted permission request ${requestCode} for ${count} scheduled working day(s): ${reason}`,
        relatedEntityType: 'permission_requests',
        relatedEntityId: createdId,
        link: '/mentor/attendance'
      });
    }

    // Notify Super Admin and Admins
    const adminUsers = await query("SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = 1");
    for (const adm of adminUsers) {
      if (adm.id !== intern.mentor_user_id) {
        await createNotification({
          userId: adm.id,
          type: 'attendance',
          title: 'Permission Request Submitted',
          message: `${intern.first_name} ${intern.last_name} submitted absence request ${requestCode} (${count} scheduled working days).`,
          relatedEntityType: 'permission_requests',
          relatedEntityId: createdId,
          link: '/admin/attendance'
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Permission request ${requestCode} submitted successfully for ${count} scheduled working day(s).`,
      data: {
        id: createdId,
        requestCode,
        startDate,
        endDate,
        affectedDaysCount: count,
        affectedDates: dates,
        status: 'PENDING'
      }
    });
  } catch (error) {
    console.error('createPermissionRequest error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit permission request.' });
  }
};

/**
 * Get permission requests (Filtered with strict RBAC)
 */
export const getPermissionRequests = async (req, res) => {
  try {
    const { status, internId, cohortId, trackId, startDate, endDate } = req.query;
    let conds = [];
    let params = [];

    // RBAC Scoping
    if (req.user.role === 'intern') {
      conds.push('pr.intern_id = ?');
      params.push(req.user.internProfileId);
    } else if (req.user.role === 'mentor') {
      conds.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      params.push(req.user.mentorId, req.user.mentorId);
    }

    if (status && status !== 'ALL') {
      conds.push('pr.status = ?');
      params.push(status.toUpperCase());
    }

    if (internId && req.user.role !== 'intern') {
      conds.push('pr.intern_id = ?');
      params.push(internId);
    }

    if (cohortId && cohortId !== 'ALL') {
      conds.push('ip.cohort_id = ?');
      params.push(cohortId);
    }

    if (trackId && trackId !== 'ALL') {
      conds.push('ip.track_id = ?');
      params.push(trackId);
    }

    if (startDate) {
      conds.push('pr.end_date >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conds.push('pr.start_date <= ?');
      params.push(endDate);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

    const rows = await query(`
      SELECT pr.*,
             ip.intern_code, ip.schedule_days, ip.schedule_locked,
             u.first_name, u.last_name, u.email,
             tr.name as track_name, c.name as cohort_name,
             mu.first_name as mentor_first, mu.last_name as mentor_last,
             ru.first_name as reviewer_first, ru.last_name as reviewer_last
      FROM permission_requests pr
      JOIN intern_profiles ip ON pr.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON ip.track_id = tr.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN users mu ON pr.reviewed_by_mentor_id = mu.id
      LEFT JOIN users ru ON pr.reviewed_by_user_id = ru.id
      ${where}
      ORDER BY pr.id DESC
    `, params);

    const formatted = rows.map(r => ({
      ...r,
      affected_dates: typeof r.affected_dates === 'string' ? JSON.parse(r.affected_dates || '[]') : r.affected_dates,
      schedule_days: parseScheduleDays(r.schedule_days)
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('getPermissionRequests error:', error);
    res.status(500).json({ success: false, message: 'Failed to query permission requests.' });
  }
};

/**
 * Get single permission request by ID
 */
export const getPermissionRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const [reqRow] = await query(`
      SELECT pr.*,
             ip.intern_code, ip.schedule_days, ip.schedule_locked, ip.mentor_id,
             u.id as intern_user_id, u.first_name, u.last_name, u.email,
             tr.name as track_name, c.name as cohort_name, c.lead_mentor_id,
             mu.first_name as mentor_first, mu.last_name as mentor_last,
             ru.first_name as reviewer_first, ru.last_name as reviewer_last
      FROM permission_requests pr
      JOIN intern_profiles ip ON pr.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON ip.track_id = tr.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN users mu ON pr.reviewed_by_mentor_id = mu.id
      LEFT JOIN users ru ON pr.reviewed_by_user_id = ru.id
      WHERE pr.id = ?
    `, [id]);

    if (!reqRow) {
      return res.status(404).json({ success: false, message: 'Permission request not found.' });
    }

    // RBAC validation
    if (req.user.role === 'intern' && reqRow.intern_id !== req.user.internProfileId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own permission requests.' });
    }

    if (req.user.role === 'mentor' && reqRow.mentor_id !== req.user.mentorId && reqRow.lead_mentor_id !== req.user.mentorId) {
      return res.status(403).json({ success: false, message: 'Access denied: Intern is outside your supervision scope.' });
    }

    reqRow.affected_dates = typeof reqRow.affected_dates === 'string' ? JSON.parse(reqRow.affected_dates || '[]') : reqRow.affected_dates;
    reqRow.schedule_days = parseScheduleDays(reqRow.schedule_days);

    res.json({
      success: true,
      data: reqRow
    });
  } catch (error) {
    console.error('getPermissionRequestById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve permission request.' });
  }
};

/**
 * Mentor review of permission request (mentor / admin)
 */
export const mentorReviewPermissionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['APPROVED', 'REJECTED', 'RECOMMENDED'].includes(status?.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'APPROVED', 'REJECTED', or 'RECOMMENDED'."
      });
    }

    const [permReq] = await query(`
      SELECT pr.*, ip.mentor_id, ip.user_id as intern_user_id, c.lead_mentor_id,
             u.first_name, u.last_name
      FROM permission_requests pr
      JOIN intern_profiles ip ON pr.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN cohorts c ON ip.cohort_id = c.id
      WHERE pr.id = ?
    `, [id]);

    if (!permReq) {
      return res.status(404).json({ success: false, message: 'Permission request not found.' });
    }

    // Check mentor scope
    if (req.user.role === 'mentor' && permReq.mentor_id !== req.user.mentorId && permReq.lead_mentor_id !== req.user.mentorId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only review requests for supervised interns.' });
    }

    const reviewStatus = status.toUpperCase();

    await query(`
      UPDATE permission_requests
      SET mentor_review_status = ?,
          mentor_review_notes = ?,
          reviewed_by_mentor_id = ?,
          mentor_reviewed_at = NOW()
      WHERE id = ?
    `, [reviewStatus, notes?.trim() || null, req.user.id, id]);

    // Record Audit
    await recordAuditLog(
      req.user.id,
      'PERMISSION_REVIEWED',
      'permission_requests',
      id,
      { mentor_review_status: permReq.mentor_review_status },
      { mentor_review_status: reviewStatus, notes },
      req,
      `Mentor reviewed permission request ${permReq.request_code}: ${reviewStatus}`
    );

    // Notify intern
    await createNotification({
      userId: permReq.intern_user_id,
      type: 'attendance',
      title: `Absence Request Review Update (${permReq.request_code})`,
      message: `Your mentor reviewed your absence request with determination: ${reviewStatus}.${notes ? ` Note: ${notes}` : ''}`,
      relatedEntityType: 'permission_requests',
      relatedEntityId: id,
      link: '/intern/attendance'
    });

    res.json({
      success: true,
      message: `Mentor review recorded as ${reviewStatus}.`,
      data: { id, mentor_review_status: reviewStatus }
    });
  } catch (error) {
    console.error('mentorReviewPermissionRequest error:', error);
    res.status(500).json({ success: false, message: 'Failed to record mentor review.' });
  }
};

/**
 * Final review and authoritative approval/rejection (Super Admin / Admin)
 * CRITICAL BUSINESS RULE:
 * When APPROVED, affected scheduled dates are recorded in attendance as 'EXCUSED'.
 * Does NOT alter the intern's permanent attendance schedule.
 * Intern CANNOT approve their own request.
 */
export const finalReviewPermissionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status?.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Final status must be 'APPROVED' or 'REJECTED'."
      });
    }

    const [permReq] = await query(`
      SELECT pr.*, ip.user_id as intern_user_id, ip.schedule_days,
             u.first_name, u.last_name
      FROM permission_requests pr
      JOIN intern_profiles ip ON pr.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      WHERE pr.id = ?
    `, [id]);

    if (!permReq) {
      return res.status(404).json({ success: false, message: 'Permission request not found.' });
    }

    // Intern CANNOT approve their own request
    if (req.user.id === permReq.intern_user_id) {
      return res.status(403).json({
        success: false,
        message: 'Security Alert: You cannot approve or reject your own permission request.'
      });
    }

    const finalStatus = status.toUpperCase();

    // Update request
    await query(`
      UPDATE permission_requests
      SET status = ?,
          final_review_status = ?,
          final_review_notes = ?,
          reviewed_by_user_id = ?,
          final_reviewed_at = NOW()
      WHERE id = ?
    `, [finalStatus, finalStatus, notes?.trim() || null, req.user.id, id]);

    // If APPROVED, reflect in attendance system for all affected scheduled dates
    if (finalStatus === 'APPROVED') {
      const affectedDates = typeof permReq.affected_dates === 'string'
        ? JSON.parse(permReq.affected_dates || '[]')
        : (permReq.affected_dates || []);

      for (const attDate of affectedDates) {
        // Check if attendance row already exists
        const [existingAtt] = await query(
          'SELECT * FROM attendance WHERE intern_id = ? AND attendance_date = ?',
          [permReq.intern_id, attDate]
        );

        const excNotes = `Approved Permission (${permReq.request_code}): ${permReq.reason}`;

        if (existingAtt) {
          const oldStatus = existingAtt.status;
          await query(
            'UPDATE attendance SET status = ?, notes = ?, marked_by = ? WHERE id = ?',
            ['EXCUSED', excNotes, req.user.id, existingAtt.id]
          );

          // Record in attendance_audit_logs
          await query(`
            INSERT INTO attendance_audit_logs (attendance_id, intern_id, changed_by, old_status, new_status, reason)
            VALUES (?, ?, ?, ?, 'EXCUSED', ?)
          `, [existingAtt.id, permReq.intern_id, req.user.id, oldStatus, `Permission Approved: ${permReq.request_code}`]);
        } else {
          const insRes = await query(`
            INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, marked_by, notes)
            VALUES (?, ?, '09:00:00', 'EXCUSED', 0, ?, ?)
          `, [permReq.intern_id, attDate, req.user.id, excNotes]);

          // Record in attendance_audit_logs
          await query(`
            INSERT INTO attendance_audit_logs (attendance_id, intern_id, changed_by, old_status, new_status, reason)
            VALUES (?, ?, ?, 'ABSENT', 'EXCUSED', ?)
          `, [insRes.insertId, permReq.intern_id, req.user.id, `Permission Approved: ${permReq.request_code}`]);
        }
      }
    }

    // Record Audit Log (Gate 20)
    await recordAuditLog(
      req.user.id,
      finalStatus === 'APPROVED' ? 'PERMISSION_APPROVED' : 'PERMISSION_REJECTED',
      'permission_requests',
      id,
      { status: permReq.status },
      { status: finalStatus, notes },
      req,
      `Permission request ${permReq.request_code} marked as ${finalStatus} by administrator.`
    );

    // Notify intern
    await createNotification({
      userId: permReq.intern_user_id,
      type: 'attendance',
      title: finalStatus === 'APPROVED' ? 'Permission Request Approved' : 'Permission Request Rejected',
      message: finalStatus === 'APPROVED'
        ? `Your permission request ${permReq.request_code} for ${permReq.affected_days_count} scheduled working day(s) has been approved. Your attendance record has been updated.`
        : `Your permission request ${permReq.request_code} was rejected.${notes ? ` Reason: ${notes}` : ''}`,
      relatedEntityType: 'permission_requests',
      relatedEntityId: id,
      link: '/intern/attendance'
    });

    res.json({
      success: true,
      message: `Permission request ${permReq.request_code} has been ${finalStatus}.`,
      data: {
        id,
        requestCode: permReq.request_code,
        status: finalStatus
      }
    });
  } catch (error) {
    console.error('finalReviewPermissionRequest error:', error);
    res.status(500).json({ success: false, message: 'Failed to record administrative determination.' });
  }
};

/**
 * Cancel a pending permission request (Intern only)
 */
export const cancelPermissionRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const [permReq] = await query(
      'SELECT * FROM permission_requests WHERE id = ?',
      [id]
    );

    if (!permReq) {
      return res.status(404).json({ success: false, message: 'Permission request not found.' });
    }

    if (req.user.role === 'intern' && permReq.intern_id !== req.user.internProfileId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (permReq.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a request that is already ${permReq.status}.`
      });
    }

    await query("UPDATE permission_requests SET status = 'CANCELLED' WHERE id = ?", [id]);

    await recordAuditLog(
      req.user.id,
      'PERMISSION_CANCELLED',
      'permission_requests',
      id,
      { status: 'PENDING' },
      { status: 'CANCELLED' },
      req,
      `Permission request ${permReq.request_code} cancelled by intern.`
    );

    res.json({
      success: true,
      message: `Permission request ${permReq.request_code} has been cancelled.`
    });
  } catch (error) {
    console.error('cancelPermissionRequest error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel permission request.' });
  }
};
