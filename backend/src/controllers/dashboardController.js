import { query } from '../config/db.js';
import { getLagosDate, calculateExpectedWorkingDays } from '../utils/timezone.js';

export const getAdminDashboard = async (req, res) => {
  try {
    const { date } = getLagosDate();

    // 1. Intern Statistics
    const [internStats] = await query(`
      SELECT
        COUNT(*) as total_interns,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_interns,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_interns,
        SUM(CASE WHEN status = 'dropped' THEN 1 ELSE 0 END) as dropped_interns,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_interns
      FROM intern_profiles
    `);

    // 2. Training Metrics
    const [trackStats] = await query(`SELECT COUNT(*) as total_tracks FROM tracks WHERE is_active = 1`);
    const [cohortStats] = await query(`SELECT COUNT(*) as active_cohorts FROM cohorts WHERE status = 'active'`);
    const [mentorStats] = await query(`SELECT COUNT(*) as active_mentors FROM mentors`);
    const [taskStats] = await query(`
      SELECT
        COUNT(*) as total_tasks,
        (SELECT COUNT(*) FROM task_submissions WHERE status = 'submitted') as pending_reviews
      FROM tasks
    `);

    // 3. Attendance Today
    const [todayAttendance] = await query(`
      SELECT
        COUNT(*) as marked_today,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_today,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late_today,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_today
      FROM attendance
      WHERE attendance_date = ?
    `, [date]);

    const activeTotal = parseInt(internStats.active_interns || 0, 10);
    const presentToday = parseInt(todayAttendance.present_today || 0, 10);
    const lateToday = parseInt(todayAttendance.late_today || 0, 10);
    const absentToday = parseInt(todayAttendance.absent_today || 0, 10);
    const attendanceRateToday = activeTotal > 0 ? Math.round(((presentToday + lateToday) / activeTotal) * 100) : 0;

    // 4. Overall Performance Average
    const [perfStats] = await query(`
      SELECT AVG(overall_score) as avg_performance FROM performance_evaluations
    `);

    // 5. Attendance Trend Chart (last 10 distinct days)
    const attendanceTrend = await query(`
      SELECT
        attendance_date as date,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent
      FROM attendance
      GROUP BY attendance_date
      ORDER BY attendance_date ASC
      LIMIT 10
    `);

    // 6. Intern Distribution by Track
    const trackDistribution = await query(`
      SELECT t.name, COUNT(ip.id) as value
      FROM tracks t
      LEFT JOIN intern_profiles ip ON t.id = ip.track_id
      GROUP BY t.id, t.name
    `);

    // 7. Recent Audit Activities
    const recentActivities = await query(`
      SELECT al.action, al.entity_type, al.created_at,
             u.first_name, u.last_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        interns: {
          total: parseInt(internStats.total_interns || 0, 10),
          active: activeTotal,
          completed: parseInt(internStats.completed_interns || 0, 10),
          dropped: parseInt(internStats.dropped_interns || 0, 10),
          suspended: parseInt(internStats.suspended_interns || 0, 10)
        },
        training: {
          totalTracks: parseInt(trackStats.total_tracks || 0, 10),
          activeCohorts: parseInt(cohortStats.active_cohorts || 0, 10),
          activeMentors: parseInt(mentorStats.active_mentors || 0, 10),
          pendingTaskReviews: parseInt(taskStats.pending_reviews || 0, 10)
        },
        attendanceToday: {
          date,
          present: presentToday,
          late: lateToday,
          absent: absentToday,
          notMarked: Math.max(0, activeTotal - presentToday - lateToday - absentToday),
          rate: attendanceRateToday
        },
        performance: {
          averageScore: Math.round(parseFloat(perfStats.avg_performance || 0) * 10) / 10
        },
        charts: {
          attendanceTrend,
          trackDistribution
        },
        recentActivities
      }
    });
  } catch (error) {
    console.error('getAdminDashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load admin dashboard data.' });
  }
};

export const getInternDashboard = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    const { date } = getLagosDate();

    // 1. Intern Profile Overview
    const [profile] = await query(`
      SELECT ip.*, u.first_name, u.last_name, u.email, u.avatar_url,
             t.name as track_name,
             c.name as cohort_name, c.start_date as cohort_start, c.end_date as cohort_end,
             mu.first_name as mentor_first, mu.last_name as mentor_last
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      WHERE ip.id = ?
    `, [internProfileId]);

    // 2. Today's Attendance Record
    const [todayAttendance] = await query(`
      SELECT * FROM attendance WHERE intern_id = ? AND attendance_date = ?
    `, [internProfileId, date]);

    // 3. Authoritative Working Days & Holidays Configuration
    const [wdSetting] = await query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'working_days'`
    );
    let workingDaysConfig = null;
    if (wdSetting?.setting_value) {
      try { workingDaysConfig = JSON.parse(wdSetting.setting_value); } catch (e) {}
    }
    const holidayRows = await query(`SELECT holiday_date FROM company_holidays WHERE is_active = 1`);
    const holidaySet = new Set(holidayRows.map(h => h.holiday_date));

    // 4. Attendance Summary Aggregation
    const [attSummary] = await query(`
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN status = 'EXCUSED' THEN 1 ELSE 0 END) as excused_days,
        AVG(CASE WHEN status = 'LATE' THEN late_minutes ELSE NULL END) as avg_late_minutes,
        SEC_TO_TIME(ROUND(AVG(TIME_TO_SEC(check_in_time)))) as avg_check_in_time
      FROM attendance
      WHERE intern_id = ?
    `, [internProfileId]);

    const totalDays = parseInt(attSummary?.total_days || 0, 10);
    const presentDays = parseInt(attSummary?.present_days || 0, 10);
    const lateDays = parseInt(attSummary?.late_days || 0, 10);
    const absentDays = parseInt(attSummary?.absent_days || 0, 10);
    const excusedDays = parseInt(attSummary?.excused_days || 0, 10);

    const { expectedDays } = calculateExpectedWorkingDays(profile.start_date || '2026-02-01', date, workingDaysConfig, holidaySet);
    const expectedAttendanceDays = Math.max(expectedDays, totalDays, 1);

    const attendanceRate = Math.min(100, Math.round(((presentDays + lateDays) / expectedAttendanceDays) * 100));
    const punctualityRate = Math.min(100, Math.round((presentDays / expectedAttendanceDays) * 100));
    const lateRate = Math.round((lateDays / expectedAttendanceDays) * 100);
    const absenceRate = Math.round((absentDays / expectedAttendanceDays) * 100);
    const avgLateMinutes = Math.round(parseFloat(attSummary?.avg_late_minutes || 0));
    const avgCheckInTime = attSummary?.avg_check_in_time || '08:45:00';

    // 5. Performance Summary
    const [perf] = await query(`
      SELECT overall_score, technical_skills, task_completion, communication, professionalism, summary_feedback
      FROM performance_evaluations
      WHERE intern_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [internProfileId]);

    // 5. Curriculum Progress
    const progressList = await query(`
      SELECT module_name, status, completion_percentage
      FROM curriculum_progress
      WHERE intern_id = ?
      ORDER BY module_order ASC
    `, [internProfileId]);

    const completedModules = progressList.filter(m => m.status === 'completed').length;
    const overallProgress = progressList.length > 0 ? Math.round((completedModules / progressList.length) * 100) : 0;

    // 6. Recent Announcements
    const announcements = await query(`
      SELECT id, title, content, is_pinned, created_at
      FROM announcements
      WHERE target_type = 'all' OR (target_type = 'track' AND target_id = ?)
      ORDER BY is_pinned DESC, created_at DESC
      LIMIT 3
    `, [profile.track_id]);

    res.json({
      success: true,
      data: {
        profile: {
          name: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          internCode: profile.intern_code,
          track: profile.track_name,
          cohort: profile.cohort_name,
          mentor: profile.mentor_first ? `${profile.mentor_first} ${profile.mentor_last}` : 'Lead Instructor',
          status: profile.status,
          avatarUrl: profile.avatar_url
        },
        todayAttendance: {
          date,
          isCheckedIn: !!todayAttendance,
          record: todayAttendance || null
        },
        attendanceStats: {
          totalDays,
          expectedWorkingDays: expectedAttendanceDays,
          expectedAttendanceDays,
          presentDays,
          lateDays,
          absentDays,
          excusedDays,
          attendanceRate,
          punctualityRate,
          lateRate,
          absenceRate,
          avgLateMinutes,
          avgCheckInTime
        },
        performance: perf ? {
          overallScore: parseFloat(perf.overall_score),
          technical: perf.technical_skills,
          taskCompletion: perf.task_completion,
          feedback: perf.summary_feedback
        } : null,
        trainingProgress: {
          overallPercentage: overallProgress,
          modules: progressList
        },
        announcements
      }
    });
  } catch (error) {
    console.error('getInternDashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load intern dashboard.' });
  }
};
