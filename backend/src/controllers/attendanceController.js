import { query } from '../config/db.js';
import { getLagosDate, evaluateAttendance, calculateExpectedWorkingDays, isWorkingDay } from '../utils/timezone.js';
import { recordAuditLog } from '../middleware/audit.js';
import {
  validateSchedule,
  parseScheduleDays,
  getWorkingDaysConfig,
  isScheduledDay,
  COMPULSORY_DAY,
  VALID_OPTIONAL_DAYS
} from '../utils/scheduleHelper.js';
import { createNotification } from '../services/notificationService.js';

/**
 * Intern self check-in endpoint
 * CRITICAL SECURITY: Evaluates current authoritative Lagos server time against 09:00 AM cutoff.
 * Any client-supplied check_in_time, status, late_minutes, or attendance_date is strictly disregarded.
 */
export const checkIn = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({
        success: false,
        message: 'Only registered interns can mark attendance.'
      });
    }

    // Authoritative server timestamp in Africa/Lagos timezone
    const { date, time } = getLagosDate();

    // Check intern schedule if configured
    const [internProf] = await query('SELECT schedule_days, schedule_locked FROM intern_profiles WHERE id = ?', [internProfileId]);
    const scheduleDays = parseScheduleDays(internProf?.schedule_days);

    if (scheduleDays && scheduleDays.length === 3) {
      if (!isScheduledDay(date, scheduleDays)) {
        const [y, m, d] = date.split('-').map(Number);
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
        return res.status(400).json({
          success: false,
          message: `Today (${dayName}) is not one of your scheduled attendance days (${scheduleDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}). Attendance check-in is only expected on scheduled working days.`
        });
      }
    }

    // 1. Check if already checked in today
    const existing = await query(
      `SELECT * FROM attendance WHERE intern_id = ? AND attendance_date = ?`,
      [internProfileId, date]
    );

    if (existing.length > 0) {
      const rec = existing[0];
      return res.status(400).json({
        success: false,
        message: `Attendance has already been recorded for today.`,
        data: {
          attendanceDate: rec.attendance_date,
          checkInTime: rec.check_in_time,
          status: rec.status,
          lateMinutes: rec.late_minutes
        }
      });
    }

    // 2. Fetch cutoff time from system settings or use default 09:00:00
    const [cutoffSetting] = await query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'attendance_cutoff_time'`
    );
    const cutoffTime = cutoffSetting?.setting_value || '09:00:00';

    // 3. Evaluate authoritative status & late minutes
    const evaluation = evaluateAttendance(time, cutoffTime);

    // 4. Insert into database
    const insertResult = await query(
      `INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, marked_by, notes)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [
        internProfileId,
        date,
        time,
        evaluation.status,
        evaluation.lateMinutes,
        evaluation.status === 'LATE' ? `Late arrival: ${evaluation.lateMinutes} min after ${cutoffTime}` : 'Prompt arrival'
      ]
    );

    res.status(201).json({
      success: true,
      message: evaluation.status === 'PRESENT'
        ? `Attendance marked successfully at ${time}. Status: PRESENT`
        : `Attendance marked at ${time}. Status: LATE (${evaluation.lateMinutes} minutes late)`,
      data: {
        id: insertResult.insertId,
        attendanceDate: date,
        checkInTime: time,
        status: evaluation.status,
        lateMinutes: evaluation.lateMinutes
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Attendance has already been recorded for today.'
      });
    }
    console.error('CheckIn error:', error);
    res.status(500).json({ success: false, message: 'Server error during attendance check-in.' });
  }
};

/**
 * Get the logged-in intern's attendance history
 */
export const getMyAttendance = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    const { page = 1, limit = 30, startDate, endDate, status } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let whereClause = 'WHERE a.intern_id = ?';
    const params = [internProfileId];

    if (startDate) {
      whereClause += ' AND a.attendance_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND a.attendance_date <= ?';
      params.push(endDate);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }

    const records = await query(
      `SELECT a.id, a.attendance_date, a.check_in_time, a.check_out_time, a.status, a.late_minutes, a.notes,
              u.first_name as marked_by_first, u.last_name as marked_by_last
       FROM attendance a
       LEFT JOIN users u ON a.marked_by = u.id
       ${whereClause}
       ORDER BY a.attendance_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    const [totalCount] = await query(
      `SELECT COUNT(*) as count FROM attendance a ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: records,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('getMyAttendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance records.' });
  }
};

/**
 * Intern / Admin: Get attendance schedule
 */
export const getMySchedule = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId || req.query.internId;
    if (!internProfileId) {
      return res.status(400).json({ success: false, message: 'Intern profile ID not found.' });
    }

    const [intern] = await query(
      'SELECT id, intern_code, schedule_days, schedule_locked FROM intern_profiles WHERE id = ?',
      [internProfileId]
    );

    if (!intern) {
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }

    const scheduleDays = parseScheduleDays(intern.schedule_days);

    res.json({
      success: true,
      data: {
        internId: intern.id,
        internCode: intern.intern_code,
        scheduleDays: scheduleDays || [],
        scheduleLocked: Boolean(intern.schedule_locked),
        locked: Boolean(intern.schedule_locked),
        compulsoryDay: COMPULSORY_DAY,
        validOptionalDays: VALID_OPTIONAL_DAYS
      }
    });
  } catch (err) {
    console.error('getMySchedule error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance schedule.' });
  }
};

/**
 * Intern: Set permanent 3-day attendance schedule
 * CRITICAL BUSINESS RULES:
 * 1. Monday is compulsory.
 * 2. Exactly 2 additional days chosen from {tuesday, wednesday, thursday, friday}.
 * 3. Total schedule is exactly 3 days.
 * 4. Once submitted, schedule becomes permanently locked.
 */
export const setMySchedule = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Only registered interns can configure their attendance schedule.' });
    }

    const [intern] = await query(
      'SELECT id, intern_code, schedule_days, schedule_locked FROM intern_profiles WHERE id = ?',
      [internProfileId]
    );

    if (!intern) {
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }

    if (intern.schedule_locked) {
      return res.status(400).json({
        success: false,
        message: 'Attendance schedule is permanently locked and cannot be changed.'
      });
    }

    const { days } = req.body;
    const canonicalDays = validateSchedule(days);

    await query(
      'UPDATE intern_profiles SET schedule_days = ?, schedule_locked = 1 WHERE id = ?',
      [JSON.stringify(canonicalDays), internProfileId]
    );

    await recordAuditLog(
      req.user.id,
      'SET_ATTENDANCE_SCHEDULE',
      'intern_profiles',
      internProfileId,
      { schedule_days: intern.schedule_days, schedule_locked: intern.schedule_locked },
      { schedule_days: canonicalDays, schedule_locked: 1 },
      req,
      `Attendance schedule permanently configured and locked: ${canonicalDays.join(', ')}`
    );

    await createNotification({
      userId: req.user.id,
      type: 'attendance',
      title: 'Attendance Schedule Confirmed',
      message: `Your permanent 3-day attendance schedule has been configured and locked: ${canonicalDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}.`,
      relatedEntityType: 'intern_profiles',
      relatedEntityId: internProfileId,
      link: '/intern/attendance'
    });

    res.json({
      success: true,
      message: 'Attendance schedule successfully configured and permanently locked.',
      data: {
        scheduleDays: canonicalDays,
        scheduleLocked: true
      }
    });
  } catch (err) {
    console.error('setMySchedule error:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to configure attendance schedule.' });
  }
};

/**
 * Get logged-in intern's comprehensive attendance summary & analytical rates
 * Calculated against Expected Working Days (excluding weekends and approved holidays).
 */
export const getMyAttendanceSummary = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    const { date } = getLagosDate();

    // Fetch intern profile details including schedule
    const [internProfile] = await query(
      `SELECT start_date, schedule_days, schedule_locked FROM intern_profiles WHERE id = ?`,
      [internProfileId]
    );
    const startDate = internProfile?.start_date || '2026-02-01';
    const scheduleDays = parseScheduleDays(internProfile?.schedule_days);

    // Fetch working days configuration: prioritize intern's 3-day schedule
    let workingDaysConfig = null;
    if (scheduleDays && scheduleDays.length === 3) {
      workingDaysConfig = getWorkingDaysConfig(scheduleDays);
    } else {
      const [wdSetting] = await query(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'working_days'`
      );
      if (wdSetting?.setting_value) {
        try { workingDaysConfig = JSON.parse(wdSetting.setting_value); } catch (e) {}
      }
    }

    // Fetch active company holidays
    const holidayRows = await query(
      `SELECT holiday_date FROM company_holidays WHERE is_active = 1`
    );
    const holidaySet = new Set(holidayRows.map(h => h.holiday_date));

    // Check today's status
    const todayRecords = await query(
      `SELECT * FROM attendance WHERE intern_id = ? AND attendance_date = ?`,
      [internProfileId, date]
    );
    const todayRecord = todayRecords.length > 0 ? todayRecords[0] : null;

    // Aggregate counts
    const counts = await query(
      `SELECT
         COUNT(*) as total_records,
         SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
         SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late_days,
         SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days,
         SUM(CASE WHEN status = 'EXCUSED' THEN 1 ELSE 0 END) as excused_days,
         SUM(late_minutes) as total_late_minutes,
         AVG(CASE WHEN status = 'LATE' THEN late_minutes ELSE NULL END) as avg_late_minutes,
         SEC_TO_TIME(ROUND(AVG(TIME_TO_SEC(check_in_time)))) as avg_check_in_time
       FROM attendance
       WHERE intern_id = ?`,
      [internProfileId]
    );

    const c = counts[0] || {};
    const total = parseInt(c.total_records || 0, 10);
    const present = parseInt(c.present_days || 0, 10);
    const late = parseInt(c.late_days || 0, 10);
    const absent = parseInt(c.absent_days || 0, 10);
    const excused = parseInt(c.excused_days || 0, 10);

    // Calculate Authoritative Expected Attendance Days (Working Days - Holidays - Dates before start)
    const { expectedDays } = calculateExpectedWorkingDays(startDate, date, workingDaysConfig, holidaySet);
    const expectedAttendanceDays = Math.max(expectedDays, total, 1);

    const attendanceRate = Math.min(100, Math.round(((present + late) / expectedAttendanceDays) * 100));
    const punctualityRate = Math.min(100, Math.round((present / expectedAttendanceDays) * 100));
    const lateRate = Math.round((late / expectedAttendanceDays) * 100);
    const absenceRate = Math.round((absent / expectedAttendanceDays) * 100);
    const avgLateMinutes = Math.round(parseFloat(c.avg_late_minutes || 0));
    const avgCheckInTime = c.avg_check_in_time || '08:45:00';

    // Calculate Trend: Compare last 7 records vs previous 7 records
    const recentRecords = await query(
      `SELECT status FROM attendance WHERE intern_id = ? ORDER BY attendance_date DESC LIMIT 14`,
      [internProfileId]
    );

    let trend = 'Stable';
    if (recentRecords.length >= 6) {
      const recent = recentRecords.slice(0, 3);
      const prior = recentRecords.slice(3, 6);
      const recentPresent = recent.filter(r => r.status === 'PRESENT').length;
      const priorPresent = prior.filter(r => r.status === 'PRESENT').length;

      if (recentPresent > priorPresent) trend = 'Improving';
      else if (recentPresent < priorPresent) trend = 'Declining';
    }

    res.json({
      success: true,
      data: {
        today: todayRecord,
        todayDate: date,
        isCheckedInToday: !!todayRecord,
        stats: {
          totalDays: total,
          expectedWorkingDays: expectedAttendanceDays,
          expectedAttendanceDays,
          presentDays: present,
          lateDays: late,
          absentDays: absent,
          excusedDays: excused,
          attendanceRate,
          punctualityRate,
          lateRate,
          absenceRate,
          avgLateMinutes,
          avgCheckInTime,
          trend
        }
      }
    });
  } catch (error) {
    console.error('getMyAttendanceSummary error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate attendance summary.' });
  }
};

/**
 * Get intern's attendance charts data (monthly trend & status distribution)
 */
export const getMyAttendanceAnalytics = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    // Monthly breakdown
    const monthly = await query(
      `SELECT
         DATE_FORMAT(attendance_date, '%Y-%m') as month_label,
         SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
         SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late,
         SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent,
         ROUND(AVG(late_minutes), 0) as avg_late_mins
       FROM attendance
       WHERE intern_id = ?
       GROUP BY month_label
       ORDER BY month_label ASC
       LIMIT 6`,
      [internProfileId]
    );

    // Distribution by Status
    const distribution = await query(
      `SELECT status as name, COUNT(*) as value
       FROM attendance
       WHERE intern_id = ?
       GROUP BY status`,
      [internProfileId]
    );

    res.json({
      success: true,
      data: {
        monthly,
        distribution
      }
    });
  } catch (error) {
    console.error('getMyAttendanceAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve analytics.' });
  }
};

/**
 * Admin: Get live overview statistics for today's attendance
 */
export const getAdminTodayOverview = async (req, res) => {
  try {
    const { date } = getLagosDate();

    // Total active interns and those scheduled for today
    const activeInterns = await query(
      `SELECT id, schedule_days FROM intern_profiles WHERE status = 'active'`
    );
    const totalActive = activeInterns.length;
    const scheduledToday = activeInterns.filter(i => isScheduledDay(date, i.schedule_days)).length;
    const expectedToday = scheduledToday > 0 ? scheduledToday : totalActive;

    // Today's attendance counts
    const [todayCounts] = await query(
      `SELECT
         COUNT(*) as marked_count,
         SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_count,
         SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late_count,
         SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_count,
         SUM(CASE WHEN status = 'EXCUSED' THEN 1 ELSE 0 END) as excused_count,
         AVG(CASE WHEN status = 'LATE' THEN late_minutes ELSE NULL END) as avg_late_mins
       FROM attendance
       WHERE attendance_date = ?`,
      [date]
    );

    const marked = parseInt(todayCounts.marked_count || 0, 10);
    const present = parseInt(todayCounts.present_count || 0, 10);
    const late = parseInt(todayCounts.late_count || 0, 10);
    const absent = parseInt(todayCounts.absent_count || 0, 10);
    const excused = parseInt(todayCounts.excused_count || 0, 10);
    const notMarked = Math.max(0, expectedToday - marked);
    const attendanceRate = expectedToday > 0 ? Math.min(100, Math.round(((present + late) / expectedToday) * 100)) : 100;

    res.json({
      success: true,
      data: {
        todayDate: date,
        totalActiveInterns: totalActive,
        scheduledTodayCount: scheduledToday,
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        excusedCount: excused,
        notMarkedCount: notMarked,
        attendanceRate,
        avgLateMinutes: Math.round(parseFloat(todayCounts.avg_late_mins || 0))
      }
    });
  } catch (error) {
    console.error('getAdminTodayOverview error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve admin attendance overview.' });
  }
};

/**
 * Admin: Operational Attendance Register with Filters & Pagination
 */
export const getAdminAttendanceRegister = async (req, res) => {
  try {
    const {
      date,
      startDate,
      endDate,
      trackId,
      cohortId,
      status,
      search,
      page = 1,
      limit = 25
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let whereConditions = [];
    let params = [];

    // Mentor restriction: if user is mentor, only show interns assigned to them
    if (req.user.role === 'mentor') {
      whereConditions.push('ip.mentor_id = ?');
      params.push(req.user.mentorId);
    }

    if (date) {
      whereConditions.push('a.attendance_date = ?');
      params.push(date);
    }
    if (startDate) {
      whereConditions.push('a.attendance_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereConditions.push('a.attendance_date <= ?');
      params.push(endDate);
    }
    if (trackId) {
      whereConditions.push('ip.track_id = ?');
      params.push(trackId);
    }
    if (cohortId) {
      whereConditions.push('ip.cohort_id = ?');
      params.push(cohortId);
    }
    if (status) {
      whereConditions.push('a.status = ?');
      params.push(status);
    }
    if (search) {
      whereConditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR ip.intern_code LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const records = await query(
      `SELECT a.id, a.intern_id, a.attendance_date, a.check_in_time, a.check_out_time, a.status, a.late_minutes, a.notes,
              u.first_name, u.last_name, u.email, u.avatar_url,
              ip.intern_code, ip.schedule_days, ip.schedule_locked,
              t.name as track_name,
              c.name as cohort_name,
              mu.first_name as marked_by_first, mu.last_name as marked_by_last
       FROM attendance a
       JOIN intern_profiles ip ON a.intern_id = ip.id
       JOIN users u ON ip.user_id = u.id
       JOIN tracks t ON ip.track_id = t.id
       JOIN cohorts c ON ip.cohort_id = c.id
       LEFT JOIN users mu ON a.marked_by = mu.id
       ${whereClause}
       ORDER BY a.attendance_date DESC, a.check_in_time ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    const [countResult] = await query(
      `SELECT COUNT(*) as count
       FROM attendance a
       JOIN intern_profiles ip ON a.intern_id = ip.id
       JOIN users u ON ip.user_id = u.id
       ${whereClause}`,
      params
    );

    const formattedRecords = records.map(r => ({
      ...r,
      schedule_days: parseScheduleDays(r.schedule_days) || [],
      schedule_locked: Boolean(r.schedule_locked)
    }));

    res.json({
      success: true,
      data: formattedRecords,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: countResult.count,
        pages: Math.ceil(countResult.count / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('getAdminAttendanceRegister error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance register.' });
  }
};

/**
 * Admin: Manual Attendance Marking or Correction with Audit Trail
 */
export const manualMarkOrCorrect = async (req, res) => {
  try {
    const { internId, attendanceDate, checkInTime, status, reason, notes } = req.body;

    if (!internId || !attendanceDate || !status || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Intern ID, attendance date, status, and audit reason are required.'
      });
    }

    // Check if an attendance record already exists
    const [existing] = await query(
      `SELECT * FROM attendance WHERE intern_id = ? AND attendance_date = ?`,
      [internId, attendanceDate]
    );

    let lateMinutes = 0;
    if (status === 'LATE') {
      const [cutoffSetting] = await query(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'attendance_cutoff_time'`
      );
      const cutoffTime = cutoffSetting?.setting_value || '09:00:00';
      const evalResult = evaluateAttendance(checkInTime || '09:05:00', cutoffTime);
      lateMinutes = evalResult.lateMinutes;
    }

    let attendanceId;

    if (existing) {
      // Update existing record
      await query(
        `UPDATE attendance
         SET check_in_time = ?, status = ?, late_minutes = ?, marked_by = ?, notes = ?
         WHERE id = ?`,
        [checkInTime || existing.check_in_time, status, lateMinutes, req.user.id, notes || existing.notes, existing.id]
      );
      attendanceId = existing.id;

      // Create entry in attendance_audit_logs
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
      await query(
        `INSERT INTO attendance_audit_logs (attendance_id, intern_id, changed_by, old_status, new_status, old_time, new_time, reason, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          existing.id,
          internId,
          req.user.id,
          existing.status,
          status,
          existing.check_in_time,
          checkInTime || existing.check_in_time,
          reason,
          ip
        ]
      );
    } else {
      // Insert new manual record
      const result = await query(
        `INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, marked_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [internId, attendanceDate, checkInTime || '08:45:00', status, lateMinutes, req.user.id, notes || `Manually marked by ${req.user.firstName}: ${reason}`]
      );
      attendanceId = result.insertId;

      // Audit log
      await recordAuditLog(req.user.id, 'MANUAL_ATTENDANCE_CREATED', 'attendance', attendanceId, null, { internId, attendanceDate, status, reason }, req);
    }

    res.json({
      success: true,
      message: existing ? 'Attendance record successfully corrected and audited.' : 'Manual attendance successfully created.',
      data: {
        id: attendanceId,
        internId,
        attendanceDate,
        status,
        checkInTime
      }
    });
  } catch (error) {
    console.error('manualMarkOrCorrect error:', error);
    res.status(500).json({ success: false, message: 'Server error updating attendance.' });
  }
};

/**
 * Admin: Get attendance correction audit logs
 */
export const getAttendanceAuditLogs = async (req, res) => {
  try {
    const logs = await query(
      `SELECT aal.*,
              u.first_name as intern_first, u.last_name as intern_last, ip.intern_code,
              cu.first_name as admin_first, cu.last_name as admin_last
       FROM attendance_audit_logs aal
       JOIN intern_profiles ip ON aal.intern_id = ip.id
       JOIN users u ON ip.user_id = u.id
       JOIN users cu ON aal.changed_by = cu.id
       ORDER BY aal.created_at DESC
       LIMIT 50`
    );

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('getAttendanceAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance audit logs.' });
  }
};

/**
 * Company Holidays: List active holidays
 */
export const getCompanyHolidays = async (req, res) => {
  try {
    const holidays = await query(`SELECT * FROM company_holidays ORDER BY holiday_date ASC`);
    res.json({ success: true, data: holidays });
  } catch (error) {
    console.error('getCompanyHolidays error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve company holidays.' });
  }
};

/**
 * Company Holidays: Admin creates/updates a holiday date
 */
export const createCompanyHoliday = async (req, res) => {
  try {
    const holidayDate = req.body.holidayDate || req.body.holiday_date;
    const name = req.body.name;
    const description = req.body.description;
    if (!holidayDate || !name) {
      return res.status(400).json({ success: false, message: 'Holiday date and name are required.' });
    }

    const result = await query(
      `INSERT INTO company_holidays (holiday_date, name, description, is_active)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = 1`,
      [holidayDate, name, description || null]
    );

    let holidayId = result.insertId;
    if (!holidayId) {
      const [existing] = await query('SELECT id FROM company_holidays WHERE holiday_date = ?', [holidayDate]);
      holidayId = existing?.id;
    }

    await recordAuditLog(req.user.id, 'CREATE_HOLIDAY', 'company_holidays', holidayId, null, { holidayDate, name }, req);
    res.status(201).json({ success: true, message: 'Company holiday successfully recorded.', data: { id: holidayId } });
  } catch (error) {
    console.error('createCompanyHoliday error:', error);
    res.status(500).json({ success: false, message: 'Failed to save company holiday.' });
  }
};

/**
 * Company Holidays: Admin deletes a holiday
 */
export const deleteCompanyHoliday = async (req, res) => {
  try {
    const holidayId = parseInt(req.params.id, 10);
    await query(`DELETE FROM company_holidays WHERE id = ?`, [holidayId]);
    await recordAuditLog(req.user.id, 'DELETE_HOLIDAY', 'company_holidays', holidayId, null, null, req);
    res.json({ success: true, message: 'Holiday removed.' });
  } catch (error) {
    console.error('deleteCompanyHoliday error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete company holiday.' });
  }
};

/**
 * Admin: Close daily attendance period
 * Marks unmarked active interns as ABSENT without ever overwriting existing check-ins or excused absences.
 */
export const closeDailyAttendance = async (req, res) => {
  try {
    const { date } = getLagosDate();
    const targetDate = req.body.date || date;

    // Check if target date is a working day
    const [wdSetting] = await query(`SELECT setting_value FROM system_settings WHERE setting_key = 'working_days'`);
    let workingDaysConfig = null;
    if (wdSetting?.setting_value) {
      try { workingDaysConfig = JSON.parse(wdSetting.setting_value); } catch (e) {}
    }
    const holidayRows = await query(`SELECT holiday_date FROM company_holidays WHERE is_active = 1`);
    const holidaySet = new Set(holidayRows.map(h => h.holiday_date));

    if (!isWorkingDay(targetDate, workingDaysConfig, holidaySet)) {
      return res.status(400).json({
        success: false,
        message: `${targetDate} is a non-working day or company holiday. Cannot close attendance on non-working days.`
      });
    }

    // Find all active interns who have NO attendance record for targetDate
    const unmarkedInterns = await query(`
      SELECT ip.id, u.first_name, u.last_name
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      WHERE ip.status = 'active'
        AND ip.start_date <= ?
        AND ip.id NOT IN (
          SELECT intern_id FROM attendance WHERE attendance_date = ?
        )
    `, [targetDate, targetDate]);

    // Fetch authoritative closing time from system_settings
    const [closeTimeSetting] = await query(
      `SELECT setting_value FROM system_settings WHERE setting_key IN ('attendance_auto_close_time', 'attendance_closing_time') LIMIT 1`
    );
    const closingTime = closeTimeSetting?.setting_value || '17:00:00';

    let insertedCount = 0;
    for (const intern of unmarkedInterns) {
      await query(`
        INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, marked_by, notes)
        VALUES (?, ?, ?, 'ABSENT', 0, ?, 'Automated end-of-day attendance closure')
        ON DUPLICATE KEY UPDATE status = status
      `, [intern.id, targetDate, closingTime, req.user.id]);
      insertedCount++;
    }

    await recordAuditLog(req.user.id, 'CLOSE_DAILY_ATTENDANCE', 'attendance', null, null, { date: targetDate, absentCount: insertedCount }, req);

    res.json({
      success: true,
      message: `Attendance closed for ${targetDate}. ${insertedCount} unmarked intern(s) recorded as ABSENT.`,
      data: { targetDate, recordedAbsences: insertedCount }
    });
  } catch (error) {
    console.error('closeDailyAttendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to close attendance for the day.' });
  }
};

