import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';

/**
 * Helper to convert array of objects to standard RFC-4180 CSV string
 */
export const toCSV = (rows, headers) => {
  if (!rows || rows.length === 0) return '';
  const headerLine = headers.map(h => `"${h.label}"`).join(',');
  const bodyLines = rows.map(row => {
    return headers.map(h => {
      let val = row[h.key];
      if (val === null || val === undefined) val = '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });
  return [headerLine, ...bodyLines].join('\r\n');
};

/**
 * Reusable Global Filter Builder (Gate 3)
 */
export const buildReportFilter = (req, tableAlias = 'ip') => {
  const { startDate, endDate, trackId, cohortId, mentorId, periodId, status } = req.query;
  let conditions = [];
  let params = [];

  // Mentor Scoping (Rule 8 & Gate 14): Mentors only see interns they supervise
  if (req.user.role === 'mentor') {
    conditions.push(`(${tableAlias}.mentor_id = ? OR c.lead_mentor_id = ?)`);
    params.push(req.user.mentorId, req.user.mentorId);
  } else if (req.user.role === 'intern') {
    conditions.push(`${tableAlias}.id = ?`);
    params.push(req.user.internProfileId);
  } else if (mentorId) {
    conditions.push(`(${tableAlias}.mentor_id = ? OR c.lead_mentor_id = ?)`);
    params.push(mentorId, mentorId);
  }

  if (trackId && trackId !== 'ALL') {
    conditions.push(`${tableAlias}.track_id = ?`);
    params.push(trackId);
  }
  if (cohortId && cohortId !== 'ALL') {
    conditions.push(`${tableAlias}.cohort_id = ?`);
    params.push(cohortId);
  }
  if (status && status !== 'ALL') {
    conditions.push(`${tableAlias}.status = ?`);
    params.push(status);
  }

  return { conditions, params, startDate, endDate, periodId };
};


// ============================================================================
// GATE 2: EXECUTIVE MANAGEMENT DASHBOARD
// ============================================================================

/**
 * High-Level Executive Dashboard Operational KPIs
 */
export const getExecutiveDashboard = async (req, res) => {
  try {
    const { conditions, params, startDate, endDate } = buildReportFilter(req, 'ip');
    const internWhere = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Intern Operations KPIs
    const [internStats] = await query(`
      SELECT
        COUNT(*) as total_interns,
        SUM(CASE WHEN ip.status = 'active' THEN 1 ELSE 0 END) as active_interns,
        SUM(CASE WHEN ip.status = 'onboarding' THEN 1 ELSE 0 END) as onboarding_interns,
        SUM(CASE WHEN ip.status = 'completed' THEN 1 ELSE 0 END) as completed_interns,
        SUM(CASE WHEN ip.status = 'suspended' THEN 1 ELSE 0 END) as suspended_interns,
        SUM(CASE WHEN ip.status = 'dropped' THEN 1 ELSE 0 END) as dropped_interns,
        SUM(CASE WHEN ip.status = 'alumni' THEN 1 ELSE 0 END) as alumni_interns
      FROM intern_profiles ip
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      ${internWhere}
    `, params);

    // 2. Training & Tasks Operations KPIs
    let taskConditions = [];
    let taskParams = [];

    if (req.user.role === 'mentor') {
      taskConditions.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      taskParams.push(req.user.mentorId, req.user.mentorId);
    } else if (req.user.role === 'intern') {
      taskConditions.push('ta.intern_id = ?');
      taskParams.push(req.user.internProfileId);
    }

    const taskWhere = taskConditions.length > 0 ? `WHERE ${taskConditions.join(' AND ')}` : '';

    const [taskStats] = await query(`
      SELECT
        COUNT(*) as total_assigned_tasks,
        SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN ta.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN ta.status IN ('submitted', 'under_review') THEN 1 ELSE 0 END) as pending_review_tasks,
        SUM(CASE WHEN ta.status = 'returned' THEN 1 ELSE 0 END) as returned_tasks,
        SUM(CASE WHEN ta.due_date < NOW() AND ta.status IN ('assigned', 'in_progress', 'returned') THEN 1 ELSE 0 END) as overdue_tasks
      FROM task_assignments ta
      JOIN intern_profiles ip ON ta.intern_id = ip.id
      LEFT JOIN cohorts c ON ta.cohort_id = c.id
      ${taskWhere}
    `, taskParams);

    const [moduleCount] = await query(`
      SELECT
        COUNT(*) as total_modules,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_modules
      FROM training_modules
    `);

    const totalAssignedTasks = parseInt(taskStats?.total_assigned_tasks || 0, 10);
    const completedTasks = parseInt(taskStats?.completed_tasks || 0, 10);
    const taskCompletionRate = totalAssignedTasks > 0
      ? Math.round((completedTasks / totalAssignedTasks) * 1000) / 10
      : 0;

    // 3. Attendance Operations KPIs (Phase 1 Authoritative)
    let attConditions = [];
    let attParams = [];

    if (startDate) { attConditions.push('a.attendance_date >= ?'); attParams.push(startDate); }
    if (endDate) { attConditions.push('a.attendance_date <= ?'); attParams.push(endDate); }

    if (req.user.role === 'mentor') {
      attConditions.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      attParams.push(req.user.mentorId, req.user.mentorId);
    } else if (req.user.role === 'intern') {
      attConditions.push('a.intern_id = ?');
      attParams.push(req.user.internProfileId);
    }

    const attWhere = attConditions.length > 0 ? `WHERE ${attConditions.join(' AND ')}` : '';

    const [attStats] = await query(`
      SELECT
        COUNT(*) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
        AVG(CASE WHEN a.status = 'late' THEN a.late_minutes ELSE NULL END) as avg_late_minutes
      FROM attendance a
      JOIN intern_profiles ip ON a.intern_id = ip.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      ${attWhere}
    `, attParams);

    const totalExpectedDays = (parseInt(attStats?.present_count || 0, 10)) +
                              (parseInt(attStats?.late_count || 0, 10)) +
                              (parseInt(attStats?.absent_count || 0, 10));
    const presentTotal = (parseInt(attStats?.present_count || 0, 10)) + (parseInt(attStats?.late_count || 0, 10));
    const attendanceRate = totalExpectedDays > 0
      ? Math.round((presentTotal / totalExpectedDays) * 1000) / 10
      : 100;
    const punctualityRate = totalExpectedDays > 0
      ? Math.round(((parseInt(attStats?.present_count || 0, 10)) / totalExpectedDays) * 1000) / 10
      : 100;

    // 4. Performance Operations KPIs (Phase 4 Finalized)
    let perfConditions = [];
    let perfParams = [];

    if (req.user.role === 'mentor') {
      perfConditions.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      perfParams.push(req.user.mentorId, req.user.mentorId);
    } else if (req.user.role === 'intern') {
      perfConditions.push('pe.intern_id = ?');
      perfParams.push(req.user.internProfileId);
    }

    const perfWhere = perfConditions.length > 0 ? `WHERE ${perfConditions.join(' AND ')}` : '';

    const [perfStats] = await query(`
      SELECT
        COUNT(*) as total_evaluations,
        SUM(CASE WHEN pe.status = 'finalized' THEN 1 ELSE 0 END) as finalized_evaluations,
        SUM(CASE WHEN pe.status IN ('draft', 'submitted') THEN 1 ELSE 0 END) as pending_evaluations,
        AVG(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as avg_performance_score
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      LEFT JOIN cohorts c ON pe.cohort_id = c.id
      ${perfWhere}
    `, perfParams);

    // Performance outcome band distribution
    const perfDistribution = await query(`
      SELECT
        COALESCE(pe.overall_rating, 'Unrated') as rating_band,
        COUNT(*) as count
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      LEFT JOIN cohorts c ON pe.cohort_id = c.id
      WHERE pe.status = 'finalized' ${perfConditions.length > 0 ? `AND ${perfConditions.join(' AND ')}` : ''}
      GROUP BY pe.overall_rating
    `, perfParams);

    // 5. Cohort & Track Operational Distribution
    const tracksDistribution = await query(`
      SELECT t.id, t.name, COUNT(ip.id) as intern_count
      FROM tracks t
      LEFT JOIN intern_profiles ip ON t.id = ip.track_id AND ip.status = 'active'
      GROUP BY t.id
      ORDER BY intern_count DESC
    `);

    const cohortsDistribution = await query(`
      SELECT c.id, c.name, c.cohort_code, t.name as track_name, COUNT(ip.id) as intern_count
      FROM cohorts c
      JOIN tracks t ON c.track_id = t.id
      LEFT JOIN intern_profiles ip ON c.id = ip.cohort_id AND ip.status = 'active'
      GROUP BY c.id
      ORDER BY intern_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        interns: {
          total: parseInt(internStats?.total_interns || 0, 10),
          active: parseInt(internStats?.active_interns || 0, 10),
          onboarding: parseInt(internStats?.onboarding_interns || 0, 10),
          completed: parseInt(internStats?.completed_interns || 0, 10),
          suspended: parseInt(internStats?.suspended_interns || 0, 10),
          dropped: parseInt(internStats?.dropped_interns || 0, 10),
          alumni: parseInt(internStats?.alumni_interns || 0, 10)
        },
        training: {
          totalModules: parseInt(moduleCount?.total_modules || 0, 10),
          activeModules: parseInt(moduleCount?.active_modules || 0, 10),
          totalAssignedTasks,
          completedTasks,
          inProgressTasks: parseInt(taskStats?.in_progress_tasks || 0, 10),
          pendingReviewTasks: parseInt(taskStats?.pending_review_tasks || 0, 10),
          returnedTasks: parseInt(taskStats?.returned_tasks || 0, 10),
          overdueTasks: parseInt(taskStats?.overdue_tasks || 0, 10),
          completionRate: `${taskCompletionRate}%`
        },
        attendance: {
          totalDays: totalExpectedDays,
          presentCount: parseInt(attStats?.present_count || 0, 10),
          lateCount: parseInt(attStats?.late_count || 0, 10),
          absentCount: parseInt(attStats?.absent_count || 0, 10),
          excusedCount: parseInt(attStats?.excused_count || 0, 10),
          attendanceRate: `${attendanceRate}%`,
          punctualityRate: `${punctualityRate}%`,
          avgLateMinutes: attStats?.avg_late_minutes !== null ? Math.round(parseFloat(attStats.avg_late_minutes)) : 0
        },
        performance: {
          totalEvaluations: parseInt(perfStats?.total_evaluations || 0, 10),
          finalized: parseInt(perfStats?.finalized_evaluations || 0, 10),
          pending: parseInt(perfStats?.pending_evaluations || 0, 10),
          averageScore: perfStats?.avg_performance_score !== null ? Math.round(parseFloat(perfStats.avg_performance_score) * 10) / 10 : null,
          distribution: perfDistribution.map(d => ({ ratingBand: d.rating_band, count: parseInt(d.count, 10) }))
        },
        distribution: {
          byTrack: tracksDistribution.map(td => ({ id: td.id, name: td.name, count: parseInt(td.intern_count, 10) })),
          byCohort: cohortsDistribution.map(cd => ({ id: cd.id, name: cd.name, code: cd.cohort_code, track: cd.track_name, count: parseInt(cd.intern_count, 10) }))
        }
      }
    });
  } catch (error) {
    console.error('getExecutiveDashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load executive dashboard.' });
  }
};


// ============================================================================
// GATE 4: INTERN ANALYTICS
// ============================================================================

/**
 * Detailed Intern Analytics & Lifecycle Breakdown
 */
export const getInternAnalytics = async (req, res) => {
  try {
    const { conditions, params } = buildReportFilter(req, 'ip');
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Status breakdown
    const statusCounts = await query(`
      SELECT ip.status, COUNT(*) as count
      FROM intern_profiles ip
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
      GROUP BY ip.status
    `, params);

    // Track breakdown
    const trackCounts = await query(`
      SELECT t.name as track_name, COUNT(ip.id) as count
      FROM intern_profiles ip
      JOIN tracks t ON ip.track_id = t.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
      GROUP BY t.id
    `, params);

    // Cohort breakdown
    const cohortCounts = await query(`
      SELECT c.name as cohort_name, c.cohort_code, COUNT(ip.id) as count
      FROM intern_profiles ip
      JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
      GROUP BY c.id
    `, params);

    // Average duration in days for completed internships
    const [durationStat] = await query(`
      SELECT AVG(DATEDIFF(ip.actual_end_date, ip.start_date)) as avg_days
      FROM intern_profiles ip
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ip.status IN ('completed', 'alumni') AND ip.actual_end_date IS NOT NULL
      ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''}
    `, params);

    // Monthly growth trend
    const growthTrend = await query(`
      SELECT DATE_FORMAT(ip.start_date, '%Y-%m') as month, COUNT(*) as count
      FROM intern_profiles ip
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
      GROUP BY DATE_FORMAT(ip.start_date, '%Y-%m')
      ORDER BY month ASC
    `, params);

    // Paginated intern list
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 50, 10);
    const offset = (page - 1) * limit;

    const [totalCnt] = await query(`
      SELECT COUNT(*) as count
      FROM intern_profiles ip
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
    `, params);
    const totalRecords = parseInt(totalCnt?.count || 0, 10);

    const internsList = await query(`
      SELECT ip.*,
             u.first_name, u.last_name, u.email,
             t.name as track_name, c.name as cohort_name,
             mu.first_name as mentor_first, mu.last_name as mentor_last
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      ${whereClause}
      ORDER BY ip.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const lifecycle = {
      active: 0,
      onboarding: 0,
      completed: 0,
      suspended: 0,
      dropped: 0,
      alumni: 0
    };
    statusCounts.forEach(s => {
      if (lifecycle[s.status] !== undefined) {
        lifecycle[s.status] = parseInt(s.count, 10);
      }
    });

    res.json({
      success: true,
      data: {
        lifecycle,
        growth: growthTrend.map(g => ({ month: g.month, count: parseInt(g.count, 10) })),
        avgDurationDays: durationStat?.avg_days ? Math.round(parseFloat(durationStat.avg_days)) : 0,
        roster: {
          total: totalRecords,
          page,
          limit,
          records: internsList
        },
        statusBreakdown: statusCounts.map(s => ({ status: s.status, count: parseInt(s.count, 10) })),
        trackBreakdown: trackCounts.map(t => ({ track: t.track_name, count: parseInt(t.count, 10) })),
        cohortBreakdown: cohortCounts.map(c => ({ cohort: c.cohort_name, code: c.cohort_code, count: parseInt(c.count, 10) })),
        interns: internsList,
        pagination: { page, limit, total: totalRecords }
      }
    });
  } catch (error) {
    console.error('getInternAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load intern analytics.' });
  }
};


// ============================================================================
// GATE 5: ATTENDANCE ANALYTICS
// ============================================================================

/**
 * Authoritative Attendance Analytics & Trends
 */
export const getAttendanceAnalytics = async (req, res) => {
  try {
    const { conditions, params, startDate, endDate } = buildReportFilter(req, 'ip');
    let attConditions = [...conditions];
    let attParams = [...params];

    if (startDate) { attConditions.push('a.attendance_date >= ?'); attParams.push(startDate); }
    if (endDate) { attConditions.push('a.attendance_date <= ?'); attParams.push(endDate); }

    const whereClause = attConditions.length > 0 ? `WHERE ${attConditions.join(' AND ')}` : '';

    // Overall metrics
    const [overall] = await query(`
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
        AVG(CASE WHEN a.status = 'late' THEN a.late_minutes ELSE NULL END) as avg_late_minutes
      FROM attendance a
      JOIN intern_profiles ip ON a.intern_id = ip.id
      JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
    `, attParams);

    const totalExpected = (parseInt(overall?.present_count || 0, 10)) +
                          (parseInt(overall?.late_count || 0, 10)) +
                          (parseInt(overall?.absent_count || 0, 10));
    const presentTotal = (parseInt(overall?.present_count || 0, 10)) + (parseInt(overall?.late_count || 0, 10));
    const attendanceRate = totalExpected > 0 ? Math.round((presentTotal / totalExpected) * 1000) / 10 : 100;
    const punctualityRate = totalExpected > 0 ? Math.round(((parseInt(overall?.present_count || 0, 10)) / totalExpected) * 1000) / 10 : 100;

    // Daily attendance trend (last 30 days or filtered date range)
    const dailyTrend = await query(`
      SELECT
        a.attendance_date,
        COUNT(*) as total,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance a
      JOIN intern_profiles ip ON a.intern_id = ip.id
      JOIN cohorts c ON ip.cohort_id = c.id
      ${whereClause}
      GROUP BY a.attendance_date
      ORDER BY a.attendance_date ASC
      LIMIT 60
    `, attParams);

    // Cohort attendance rates
    const cohortRates = await query(`
      SELECT
        c.id, c.name as cohort_name, c.cohort_code,
        COUNT(a.id) as total_days,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
      FROM cohorts c
      JOIN intern_profiles ip ON c.id = ip.cohort_id
      JOIN attendance a ON ip.id = a.intern_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.name ASC
    `, attParams);

    const formattedCohortRates = cohortRates.map(cr => {
      const exp = parseInt(cr.present_count, 10) + parseInt(cr.late_count, 10) + parseInt(cr.absent_count, 10);
      const rate = exp > 0 ? Math.round(((parseInt(cr.present_count, 10) + parseInt(cr.late_count, 10)) / exp) * 100) : 100;
      return {
        cohortId: cr.id,
        cohortName: cr.cohort_name,
        cohortCode: cr.cohort_code,
        rate: `${rate}%`,
        present: parseInt(cr.present_count, 10),
        late: parseInt(cr.late_count, 10),
        absent: parseInt(cr.absent_count, 10)
      };
    });

    res.json({
      success: true,
      data: {
        attendanceRate: `${attendanceRate}%`,
        punctualityRate: `${punctualityRate}%`,
        avgLateMinutes: overall?.avg_late_minutes !== null ? Math.round(parseFloat(overall.avg_late_minutes)) : 0,
        cohortBreakdown: formattedCohortRates,
        cohortRates: formattedCohortRates,
        summary: {
          totalRecords: parseInt(overall?.total_days || 0, 10),
          presentCount: parseInt(overall?.present_count || 0, 10),
          lateCount: parseInt(overall?.late_count || 0, 10),
          absentCount: parseInt(overall?.absent_count || 0, 10),
          excusedCount: parseInt(overall?.excused_count || 0, 10),
          attendanceRate: `${attendanceRate}%`,
          punctualityRate: `${punctualityRate}%`,
          avgLateMinutes: overall?.avg_late_minutes !== null ? Math.round(parseFloat(overall.avg_late_minutes)) : 0
        },
        dailyTrend: dailyTrend.map(d => {
          const expected = parseInt(d.present, 10) + parseInt(d.late, 10) + parseInt(d.absent, 10);
          const rate = expected > 0 ? Math.round(((parseInt(d.present, 10) + parseInt(d.late, 10)) / expected) * 100) : 100;
          return {
            date: d.attendance_date,
            rate,
            present: parseInt(d.present, 10),
            late: parseInt(d.late, 10),
            absent: parseInt(d.absent, 10)
          };
        })
      }
    });
  } catch (error) {
    console.error('getAttendanceAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load attendance analytics.' });
  }
};


// ============================================================================
// GATE 6: TRAINING & TASK ANALYTICS
// ============================================================================

/**
 * Task Management, Review Workload & Module Completion Analytics
 */
export const getTaskAnalytics = async (req, res) => {
  try {
    const { conditions, params } = buildReportFilter(req, 'ip');
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Task status counts
    const statusCounts = await query(`
      SELECT ta.status, COUNT(*) as count
      FROM task_assignments ta
      JOIN intern_profiles ip ON ta.intern_id = ip.id
      JOIN cohorts c ON ta.cohort_id = c.id
      ${whereClause}
      GROUP BY ta.status
    `, params);

    // Overdue count
    const [overdueStat] = await query(`
      SELECT COUNT(*) as overdue_count
      FROM task_assignments ta
      JOIN intern_profiles ip ON ta.intern_id = ip.id
      JOIN cohorts c ON ta.cohort_id = c.id
      WHERE ta.due_date < NOW() AND ta.status IN ('assigned', 'in_progress', 'returned')
      ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''}
    `, params);

    // Module-by-module performance and pass rate
    const modulePerformance = await query(`
      SELECT
        tm.id, tm.title as module_title, tm.module_code, tr.name as track_name,
        COUNT(DISTINCT ta.id) as total_assignments,
        SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        AVG(ts.score) as avg_score
      FROM training_modules tm
      JOIN tracks tr ON tm.track_id = tr.id
      LEFT JOIN tasks t ON tm.id = t.module_id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN task_submissions ts ON ta.id = ts.task_assignment_id
      GROUP BY tm.id
      ORDER BY tm.track_id ASC, tm.sequence_order ASC
    `);

    // Training progress by track (% tasks completed)
    const trackProgress = await query(`
      SELECT
        tr.id as track_id, tr.name as track_name,
        COUNT(ta.id) as total_assigned,
        SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
      FROM tracks tr
      JOIN intern_profiles ip ON tr.id = ip.track_id
      JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN task_assignments ta ON ip.id = ta.intern_id
      ${whereClause}
      GROUP BY tr.id
    `, params);

    // Mentor review backlog
    const mentorBacklog = await query(`
      SELECT m.id as mentor_id, u.first_name, u.last_name,
             COUNT(ts.id) as pending_reviews
      FROM mentors m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN cohorts c ON m.id = c.lead_mentor_id
      LEFT JOIN intern_profiles ip ON (m.id = ip.mentor_id OR c.id = ip.cohort_id)
      LEFT JOIN task_submissions ts ON ip.id = ts.intern_id AND ts.status IN ('submitted', 'under_review')
      GROUP BY m.id
      ORDER BY pending_reviews DESC
    `);

    let totalAssigned = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let submittedCount = 0;
    statusCounts.forEach(s => {
      const c = parseInt(s.count, 10);
      totalAssigned += c;
      if (s.status === 'completed') completedCount += c;
      if (s.status === 'in_progress') inProgressCount += c;
      if (s.status === 'submitted' || s.status === 'under_review') submittedCount += c;
    });
    const overdueCount = parseInt(overdueStat?.overdue_count || 0, 10);
    const completionRate = totalAssigned > 0 ? `${Math.round((completedCount / totalAssigned) * 100)}%` : '0%';
    const submissionRate = totalAssigned > 0 ? `${Math.round(((completedCount + submittedCount) / totalAssigned) * 100)}%` : '0%';

    res.json({
      success: true,
      data: {
        summary: {
          total_assigned: totalAssigned,
          completed_tasks: completedCount,
          in_progress_tasks: inProgressCount,
          overdue_tasks: overdueCount,
          completion_rate: completionRate,
          submission_rate: submissionRate
        },
        statusBreakdown: statusCounts.map(s => ({ status: s.status, count: parseInt(s.count, 10) })),
        overdueCount,
        modulePerformance: modulePerformance.map(m => {
          const tot = parseInt(m.total_assignments || 0, 10);
          const comp = parseInt(m.completed_count || 0, 10);
          const rate = tot > 0 ? Math.round((comp / tot) * 100) : 0;
          return {
            moduleId: m.id,
            moduleTitle: m.module_title,
            moduleCode: m.module_code,
            trackName: m.track_name,
            totalAssignments: tot,
            completedCount: comp,
            completionRate: `${rate}%`,
            avgScore: m.avg_score !== null ? Math.round(parseFloat(m.avg_score) * 10) / 10 : null
          };
        }),
        trackProgress: trackProgress.map(tp => {
          const tot = parseInt(tp.total_assigned || 0, 10);
          const comp = parseInt(tp.completed_tasks || 0, 10);
          const rate = tot > 0 ? Math.round((comp / tot) * 100) : 0;
          return {
            trackId: tp.track_id,
            trackName: tp.track_name,
            totalAssigned: tot,
            completedTasks: comp,
            progressRate: `${rate}%`
          };
        }),
        mentorBacklog: mentorBacklog.map(mb => ({
          mentorId: mb.mentor_id,
          name: `${mb.first_name} ${mb.last_name}`,
          pendingReviews: parseInt(mb.pending_reviews || 0, 10)
        }))
      }
    });
  } catch (error) {
    console.error('getTaskAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load task analytics.' });
  }
};


// ============================================================================
// GATE 7: PERFORMANCE ANALYTICS
// ============================================================================

/**
 * Performance Management Analytics, Rating Distributions & Criteria Averages
 */
export const getPerformanceAnalytics = async (req, res) => {
  try {
    const { conditions, params, periodId } = buildReportFilter(req, 'ip');
    let perfConditions = [...conditions];
    let perfParams = [...params];

    if (periodId && periodId !== 'ALL') {
      perfConditions.push('pe.period_id = ?');
      perfParams.push(periodId);
    }

    const whereClause = perfConditions.length > 0 ? `WHERE ${perfConditions.join(' AND ')}` : '';

    // Summary statistics
    const [summary] = await query(`
      SELECT
        COUNT(*) as total_evaluations,
        SUM(CASE WHEN pe.status = 'finalized' THEN 1 ELSE 0 END) as finalized_count,
        SUM(CASE WHEN pe.status IN ('draft', 'submitted') THEN 1 ELSE 0 END) as pending_count,
        AVG(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as avg_score,
        MAX(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as max_score,
        MIN(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as min_score
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN cohorts c ON pe.cohort_id = c.id
      ${whereClause}
    `, perfParams);

    // Rating band breakdown
    const ratingBands = await query(`
      SELECT
        COALESCE(pe.overall_rating, 'Unrated') as rating_band,
        COUNT(*) as count,
        AVG(pe.overall_score) as avg_band_score
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN cohorts c ON pe.cohort_id = c.id
      WHERE pe.status = 'finalized' ${perfConditions.length > 0 ? `AND ${perfConditions.join(' AND ')}` : ''}
      GROUP BY pe.overall_rating
    `, perfParams);

    // Criterion-by-criterion performance
    const criterionAverages = await query(`
      SELECT
        pc.id, pc.name as criterion_name, pc.category, pc.weight, pc.max_score,
        AVG(es.score) as avg_score,
        AVG(es.weighted_score) as avg_weighted_score
      FROM performance_criteria pc
      LEFT JOIN evaluation_scores es ON pc.id = es.criterion_id
      LEFT JOIN performance_evaluations pe ON es.evaluation_id = pe.id
      LEFT JOIN intern_profiles ip ON pe.intern_id = ip.id
      LEFT JOIN cohorts c ON pe.cohort_id = c.id
      WHERE (pe.status = 'finalized' OR pe.id IS NULL) ${perfConditions.length > 0 ? `AND ${perfConditions.join(' AND ')}` : ''}
      GROUP BY pc.id
      ORDER BY pc.category ASC, pc.order_index ASC
    `, perfParams);

    // Cross-period performance trend
    const periodTrends = await query(`
      SELECT
        pp.id, pp.name as period_name, pp.start_date,
        COUNT(pe.id) as total_evaluated,
        AVG(pe.overall_score) as avg_score
      FROM performance_periods pp
      JOIN performance_evaluations pe ON pp.id = pe.period_id
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN cohorts c ON pe.cohort_id = c.id
      WHERE pe.status = 'finalized' ${perfConditions.length > 0 ? `AND ${perfConditions.join(' AND ')}` : ''}
      GROUP BY pp.id
      ORDER BY pp.start_date ASC
    `, perfParams);

    const formattedRatingBands = ratingBands.map(r => ({
      ratingBand: r.rating_band,
      count: parseInt(r.count, 10),
      avgBandScore: r.avg_band_score !== null ? Math.round(parseFloat(r.avg_band_score) * 10) / 10 : null
    }));

    const formattedCriteria = criterionAverages.map(ca => ({
      criterionId: ca.id,
      name: ca.criterion_name,
      category: ca.category,
      weight: parseFloat(ca.weight),
      maxScore: parseFloat(ca.max_score),
      avgScore: ca.avg_score !== null ? Math.round(parseFloat(ca.avg_score) * 10) / 10 : null,
      avgWeightedScore: ca.avg_weighted_score !== null ? Math.round(parseFloat(ca.avg_weighted_score) * 100) / 100 : null
    }));

    const formattedTrends = periodTrends.map(pt => ({
      periodId: pt.id,
      periodName: pt.period_name,
      startDate: pt.start_date,
      evaluatedCount: parseInt(pt.total_evaluated, 10),
      avgScore: pt.avg_score !== null ? Math.round(parseFloat(pt.avg_score) * 10) / 10 : null
    }));

    res.json({
      success: true,
      data: {
        summary: {
          total: parseInt(summary?.total_evaluations || 0, 10),
          finalized: parseInt(summary?.finalized_count || 0, 10),
          pending: parseInt(summary?.pending_count || 0, 10),
          averageScore: summary?.avg_score !== null ? Math.round(parseFloat(summary.avg_score) * 10) / 10 : null,
          maxScore: summary?.max_score !== null ? parseFloat(summary.max_score) : null,
          minScore: summary?.min_score !== null ? parseFloat(summary.min_score) : null
        },
        avgScore: summary?.avg_score !== null ? Math.round(parseFloat(summary.avg_score) * 10) / 10 : 0,
        ratingBreakdown: formattedRatingBands,
        ratingBands: formattedRatingBands,
        criteriaPerformance: formattedCriteria,
        criterionAverages: formattedCriteria,
        periodComparison: formattedTrends,
        periodTrends: formattedTrends
      }
    });
  } catch (error) {
    console.error('getPerformanceAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load performance analytics.' });
  }
};


// ============================================================================
// GATE 8: COHORT ANALYTICS
// ============================================================================

/**
 * Factual Operational Reporting by Cohort
 */
export const getCohortAnalytics = async (req, res) => {
  try {
    const cohortsMatrix = await query(`
      SELECT
        c.id as cohort_id, c.name as cohort_name, c.cohort_code, c.status as cohort_status,
        tr.name as track_name,
        u.first_name as mentor_first, u.last_name as mentor_last,
        COUNT(DISTINCT ip.id) as total_interns,
        SUM(CASE WHEN ip.status = 'active' THEN 1 ELSE 0 END) as active_interns,
        (
          SELECT ROUND((SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0)) * 100, 1)
          FROM attendance a
          JOIN intern_profiles aip ON a.intern_id = aip.id
          WHERE aip.cohort_id = c.id
        ) as attendance_rate,
        (
          SELECT ROUND((SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(ta.id), 0)) * 100, 1)
          FROM task_assignments ta
          WHERE ta.cohort_id = c.id
        ) as task_completion_rate,
        (
          SELECT COUNT(*)
          FROM task_assignments ta
          WHERE ta.cohort_id = c.id AND ta.due_date < NOW() AND ta.status IN ('assigned', 'in_progress', 'returned')
        ) as overdue_tasks_count,
        (
          SELECT ROUND(AVG(pe.overall_score), 1)
          FROM performance_evaluations pe
          WHERE pe.cohort_id = c.id AND pe.status = 'finalized'
        ) as avg_performance_score,
        (
          SELECT COUNT(*)
          FROM performance_evaluations pe
          WHERE pe.cohort_id = c.id AND pe.status = 'finalized'
        ) as finalized_evals_count
      FROM cohorts c
      JOIN tracks tr ON c.track_id = tr.id
      LEFT JOIN mentors m ON c.lead_mentor_id = m.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN intern_profiles ip ON c.id = ip.cohort_id
      GROUP BY c.id
      ORDER BY c.id ASC
    `);

    res.json({
      success: true,
      data: cohortsMatrix.map(cm => ({
        ...cm,
        attendance_rate: cm.attendance_rate !== null ? `${cm.attendance_rate}%` : '—',
        task_completion_rate: cm.task_completion_rate !== null ? `${cm.task_completion_rate}%` : '—',
        overdue_tasks_count: parseInt(cm.overdue_tasks_count || 0, 10),
        avg_performance_score: cm.avg_performance_score !== null ? `${cm.avg_performance_score}%` : '—',
        finalized_evals_count: parseInt(cm.finalized_evals_count || 0, 10)
      }))
    });
  } catch (error) {
    console.error('getCohortAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load cohort analytics.' });
  }
};


// ============================================================================
// GATE 9: TRACK ANALYTICS
// ============================================================================

/**
 * Factual Operational Reporting by Training Track
 */
export const getTrackAnalytics = async (req, res) => {
  try {
    const tracksMatrix = await query(`
      SELECT
        tr.id as track_id, tr.name as track_name, tr.code as track_code, tr.is_active,
        COUNT(DISTINCT c.id) as cohort_count,
        COUNT(DISTINCT ip.id) as total_interns,
        SUM(CASE WHEN ip.status = 'active' THEN 1 ELSE 0 END) as active_interns,
        SUM(CASE WHEN ip.status IN ('completed', 'alumni') THEN 1 ELSE 0 END) as alumni_count,
        (
          SELECT ROUND((SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) / NULLIF(COUNT(a.id), 0)) * 100, 1)
          FROM attendance a
          JOIN intern_profiles aip ON a.intern_id = aip.id
          WHERE aip.track_id = tr.id
        ) as attendance_rate,
        (
          SELECT ROUND((SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(ta.id), 0)) * 100, 1)
          FROM task_assignments ta
          JOIN intern_profiles tip ON ta.intern_id = tip.id
          WHERE tip.track_id = tr.id
        ) as task_completion_rate,
        (
          SELECT ROUND(AVG(pe.overall_score), 1)
          FROM performance_evaluations pe
          WHERE pe.track_id = tr.id AND pe.status = 'finalized'
        ) as avg_performance_score
      FROM tracks tr
      LEFT JOIN cohorts c ON tr.id = c.track_id
      LEFT JOIN intern_profiles ip ON tr.id = ip.track_id
      GROUP BY tr.id
      ORDER BY tr.id ASC
    `);

    res.json({
      success: true,
      data: tracksMatrix.map(tm => ({
        ...tm,
        attendance_rate: tm.attendance_rate !== null ? `${tm.attendance_rate}%` : '—',
        task_completion_rate: tm.task_completion_rate !== null ? `${tm.task_completion_rate}%` : '—',
        avg_performance_score: tm.avg_performance_score !== null ? `${tm.avg_performance_score}%` : '—'
      }))
    });
  } catch (error) {
    console.error('getTrackAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load track analytics.' });
  }
};


// ============================================================================
// GATE 10: MENTOR WORKLOAD ANALYTICS
// ============================================================================

/**
 * Mentor Operational Capacity & Review Backlog (Scoped by RBAC)
 */
export const getMentorAnalytics = async (req, res) => {
  try {
    let mentorFilter = '';
    let params = [];

    // Mentor can only see their own metrics
    if (req.user.role === 'mentor') {
      mentorFilter = 'WHERE m.id = ?';
      params.push(req.user.mentorId);
    }

    const mentorsMatrix = await query(`
      SELECT
        m.id as mentor_id,
        u.first_name, u.last_name, u.email,
        COUNT(DISTINCT ip.id) as supervised_interns,
        COUNT(DISTINCT c.id) as lead_cohorts,
        (
          SELECT COUNT(DISTINCT ts.id)
          FROM task_submissions ts
          JOIN intern_profiles tip ON ts.intern_id = tip.id
          LEFT JOIN cohorts tc ON tip.cohort_id = tc.id
          WHERE (tip.mentor_id = m.id OR tc.lead_mentor_id = m.id)
            AND ts.status IN ('submitted', 'under_review')
        ) as pending_task_reviews,
        (
          SELECT COUNT(DISTINCT tr.id)
          FROM task_reviews tr
          WHERE tr.reviewer_id = u.id
        ) as total_reviewed_tasks,
        (
          SELECT COUNT(DISTINCT pe.id)
          FROM performance_evaluations pe
          JOIN intern_profiles pip ON pe.intern_id = pip.id
          LEFT JOIN cohorts pc ON pip.cohort_id = pc.id
          WHERE (pip.mentor_id = m.id OR pc.lead_mentor_id = m.id)
            AND pe.status IN ('draft', 'submitted')
        ) as pending_evaluations,
        (
          SELECT COUNT(DISTINCT pe.id)
          FROM performance_evaluations pe
          WHERE pe.reviewer_id = u.id AND pe.status = 'finalized'
        ) as finalized_evaluations
      FROM mentors m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN intern_profiles ip ON m.id = ip.mentor_id AND ip.status = 'active'
      LEFT JOIN cohorts c ON m.id = c.lead_mentor_id
      ${mentorFilter}
      GROUP BY m.id
      ORDER BY supervised_interns DESC
    `, params);

    res.json({
      success: true,
      data: mentorsMatrix.map(mm => ({
        ...mm,
        pending_task_reviews: parseInt(mm.pending_task_reviews || 0, 10),
        total_reviewed_tasks: parseInt(mm.total_reviewed_tasks || 0, 10),
        pending_evaluations: parseInt(mm.pending_evaluations || 0, 10),
        finalized_evaluations: parseInt(mm.finalized_evaluations || 0, 10)
      }))
    });
  } catch (error) {
    console.error('getMentorAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load mentor analytics.' });
  }
};


// ============================================================================
// GATE 11: TIME-SERIES ANALYTICS
// ============================================================================

/**
 * Historical Trends for Recharts Visualization (Enrollment, Attendance, Velocity)
 */
export const getTimeSeriesAnalytics = async (req, res) => {
  try {
    // 1. Monthly Intern Enrollment
    const enrollmentTrends = await query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month_key,
        COUNT(*) as count
      FROM intern_profiles
      GROUP BY month_key
      ORDER BY month_key ASC
      LIMIT 12
    `);

    // 2. Weekly Attendance Rate (Last 10 weeks)
    const attendanceWeekly = await query(`
      SELECT
        YEARWEEK(attendance_date, 1) as week_key,
        MIN(attendance_date) as start_of_week,
        COUNT(*) as total_records,
        SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) as present_total
      FROM attendance
      GROUP BY week_key
      ORDER BY week_key ASC
      LIMIT 12
    `);

    // 3. Weekly Task Submissions Activity
    const taskWeekly = await query(`
      SELECT
        YEARWEEK(submitted_at, 1) as week_key,
        MIN(DATE(submitted_at)) as week_start,
        COUNT(*) as submissions_count
      FROM task_submissions
      GROUP BY week_key
      ORDER BY week_key ASC
      LIMIT 12
    `);

    const formattedEnrollment = enrollmentTrends.map(e => ({ label: e.month_key, count: parseInt(e.count, 10) }));
    const formattedAttendance = attendanceWeekly.map(a => {
      const tot = parseInt(a.total_records, 10);
      const pres = parseInt(a.present_total, 10);
      const rate = tot > 0 ? Math.round((pres / tot) * 1000) / 10 : 100;
      return { label: a.start_of_week, rate, total: tot };
    });
    const formattedTasks = taskWeekly.map(t => ({ label: t.week_start, submissions: parseInt(t.submissions_count, 10) }));

    res.json({
      success: true,
      data: {
        enrollment: formattedEnrollment,
        internGrowth: formattedEnrollment,
        attendance: formattedAttendance,
        attendanceTrends: formattedAttendance,
        tasks: formattedTasks,
        taskVelocity: formattedTasks
      }
    });
  } catch (error) {
    console.error('getTimeSeriesAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load time-series analytics.' });
  }
};


// ============================================================================
// GATE 12: REPORT DRILL-DOWN ENGINE
// ============================================================================

/**
 * Traceable Underlying Record Querying
 */
export const getReportDrillDown = async (req, res) => {
  try {
    const { metric } = req.query;
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 25, 10);
    const offset = (page - 1) * limit;

    const isMentor = req.user.role === 'mentor';
    const mentorId = req.user.mentorId;

    let rows = [];
    let totalCount = 0;

    switch (metric) {
      case 'overdue_tasks': {
        let where = "WHERE ta.due_date < NOW() AND ta.status IN ('assigned', 'in_progress', 'returned')";
        let params = [];
        if (isMentor) {
          where += " AND (ip.mentor_id = ? OR c.lead_mentor_id = ?)";
          params.push(mentorId, mentorId);
        }

        const [cnt] = await query(`
          SELECT COUNT(*) as count
          FROM task_assignments ta
          JOIN tasks t ON ta.task_id = t.id
          JOIN intern_profiles ip ON ta.intern_id = ip.id
          JOIN cohorts c ON ta.cohort_id = c.id
          ${where}
        `, params);
        totalCount = parseInt(cnt?.count || 0, 10);

        rows = await query(`
          SELECT ta.id, ta.due_date, ta.status,
                 t.title as task_title, t.pass_score, t.max_score,
                 ip.intern_code, u.first_name, u.last_name, u.email,
                 tr.name as track_name, c.name as cohort_name
          FROM task_assignments ta
          JOIN tasks t ON ta.task_id = t.id
          JOIN intern_profiles ip ON ta.intern_id = ip.id
          JOIN users u ON ip.user_id = u.id
          JOIN tracks tr ON t.track_id = tr.id
          JOIN cohorts c ON ta.cohort_id = c.id
          ${where}
          ORDER BY ta.due_date ASC
          LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        break;
      }

      case 'pending_evaluations': {
        let where = "WHERE pe.status IN ('draft', 'submitted')";
        let params = [];
        if (isMentor) {
          where += " AND (ip.mentor_id = ? OR c.lead_mentor_id = ? OR pe.reviewer_id = ?)";
          params.push(mentorId, mentorId, req.user.id);
        }

        const [cnt] = await query(`
          SELECT COUNT(*) as count
          FROM performance_evaluations pe
          JOIN intern_profiles ip ON pe.intern_id = ip.id
          JOIN cohorts c ON pe.cohort_id = c.id
          ${where}
        `, params);
        totalCount = parseInt(cnt?.count || 0, 10);

        rows = await query(`
          SELECT pe.id, pe.status, pe.created_at, pe.evaluation_period,
                 ip.intern_code, u.first_name as intern_first, u.last_name as intern_last,
                 ru.first_name as reviewer_first, ru.last_name as reviewer_last,
                 tr.name as track_name, c.name as cohort_name
          FROM performance_evaluations pe
          JOIN intern_profiles ip ON pe.intern_id = ip.id
          JOIN users u ON ip.user_id = u.id
          JOIN users ru ON pe.reviewer_id = ru.id
          JOIN tracks tr ON pe.track_id = tr.id
          JOIN cohorts c ON pe.cohort_id = c.id
          ${where}
          ORDER BY pe.id DESC
          LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        break;
      }

      case 'late_attendance': {
        let where = "WHERE a.status = 'late'";
        let params = [];
        if (isMentor) {
          where += " AND (ip.mentor_id = ? OR c.lead_mentor_id = ?)";
          params.push(mentorId, mentorId);
        }

        const [cnt] = await query(`
          SELECT COUNT(*) as count
          FROM attendance a
          JOIN intern_profiles ip ON a.intern_id = ip.id
          JOIN cohorts c ON ip.cohort_id = c.id
          ${where}
        `, params);
        totalCount = parseInt(cnt?.count || 0, 10);

        rows = await query(`
          SELECT a.id, a.attendance_date, a.check_in_time, a.late_minutes, a.status,
                 ip.intern_code, u.first_name, u.last_name,
                 tr.name as track_name, c.name as cohort_name
          FROM attendance a
          JOIN intern_profiles ip ON a.intern_id = ip.id
          JOIN users u ON ip.user_id = u.id
          JOIN tracks tr ON ip.track_id = tr.id
          JOIN cohorts c ON ip.cohort_id = c.id
          ${where}
          ORDER BY a.attendance_date DESC
          LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        break;
      }

      case 'active_interns': {
        let where = "WHERE ip.status = 'active'";
        let params = [];
        if (isMentor) {
          where += " AND (ip.mentor_id = ? OR c.lead_mentor_id = ?)";
          params.push(mentorId, mentorId);
        }

        const [cnt] = await query(`
          SELECT COUNT(*) as count
          FROM intern_profiles ip
          LEFT JOIN cohorts c ON ip.cohort_id = c.id
          ${where}
        `, params);
        totalCount = parseInt(cnt?.count || 0, 10);

        rows = await query(`
          SELECT ip.id, ip.intern_code, ip.status, ip.start_date,
                 u.first_name, u.last_name, u.email,
                 tr.name as track_name, c.name as cohort_name
          FROM intern_profiles ip
          JOIN users u ON ip.user_id = u.id
          JOIN tracks tr ON ip.track_id = tr.id
          LEFT JOIN cohorts c ON ip.cohort_id = c.id
          ${where}
          ORDER BY ip.id DESC
          LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        break;
      }

      default:
        return res.status(400).json({ success: false, message: `Unsupported drill-down metric: '${metric}'` });
    }

    res.json({
      success: true,
      data: {
        metric,
        totalCount,
        page,
        limit,
        records: rows
      }
    });
  } catch (error) {
    console.error('getReportDrillDown error:', error);
    res.status(500).json({ success: false, message: 'Failed to query drill-down records.' });
  }
};


// ============================================================================
// GATE 13 & 17: STANDARDIZED CSV EXPORT ENGINE & AUDIT
// ============================================================================

/**
 * Standard RFC-4180 UTF-8 CSV Exporter with Audit Log Integration
 */
export const exportReportCSV = async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate, trackId, cohortId } = req.query;

    let records = [];
    let headers = [];
    let filename = `${type}_export_${Date.now()}.csv`;

    switch (type) {
      case 'attendance': {
        let conds = [];
        let params = [];
        if (startDate) { conds.push('a.attendance_date >= ?'); params.push(startDate); }
        if (endDate) { conds.push('a.attendance_date <= ?'); params.push(endDate); }
        if (trackId && trackId !== 'ALL') { conds.push('ip.track_id = ?'); params.push(trackId); }
        if (cohortId && cohortId !== 'ALL') { conds.push('ip.cohort_id = ?'); params.push(cohortId); }

        if (req.user.role === 'mentor') {
          conds.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
          params.push(req.user.mentorId, req.user.mentorId);
        }

        const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

        records = await query(`
          SELECT a.attendance_date, a.check_in_time, a.status, a.late_minutes, a.notes,
                 ip.intern_code, u.first_name, u.last_name, u.email,
                 t.name as track_name, c.name as cohort_name
          FROM attendance a
          JOIN intern_profiles ip ON a.intern_id = ip.id
          JOIN users u ON ip.user_id = u.id
          JOIN tracks t ON ip.track_id = t.id
          JOIN cohorts c ON ip.cohort_id = c.id
          ${where}
          ORDER BY a.attendance_date DESC, u.last_name ASC
        `, params);

        headers = [
          { key: 'attendance_date', label: 'Date' },
          { key: 'intern_code', label: 'Intern Code' },
          { key: 'first_name', label: 'First Name' },
          { key: 'last_name', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'track_name', label: 'Track' },
          { key: 'cohort_name', label: 'Cohort' },
          { key: 'check_in_time', label: 'Check-In' },
          { key: 'status', label: 'Status' },
          { key: 'late_minutes', label: 'Late Minutes' }
        ];
        break;
      }

      case 'interns': {
        let conds = [];
        let params = [];
        if (trackId && trackId !== 'ALL') { conds.push('ip.track_id = ?'); params.push(trackId); }
        if (cohortId && cohortId !== 'ALL') { conds.push('ip.cohort_id = ?'); params.push(cohortId); }

        if (req.user.role === 'mentor') {
          conds.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
          params.push(req.user.mentorId, req.user.mentorId);
        }

        const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

        records = await query(`
          SELECT ip.intern_code, u.first_name, u.last_name, u.email, ip.phone,
                 ip.status, t.name as track_name, c.name as cohort_name,
                 ip.start_date, ip.expected_end_date, ip.actual_end_date
          FROM intern_profiles ip
          JOIN users u ON ip.user_id = u.id
          JOIN tracks t ON ip.track_id = t.id
          JOIN cohorts c ON ip.cohort_id = c.id
          ${where}
          ORDER BY ip.id ASC
        `, params);

        headers = [
          { key: 'intern_code', label: 'Intern Code' },
          { key: 'first_name', label: 'First Name' },
          { key: 'last_name', label: 'Last Name' },
          { key: 'email', label: 'Email' },
          { key: 'track_name', label: 'Track' },
          { key: 'cohort_name', label: 'Cohort' },
          { key: 'status', label: 'Status' },
          { key: 'start_date', label: 'Start Date' },
          { key: 'expected_end_date', label: 'Expected End Date' }
        ];
        break;
      }

      case 'tasks': {
        let conds = [];
        let params = [];
        if (req.user.role === 'mentor') {
          conds.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
          params.push(req.user.mentorId, req.user.mentorId);
        }

        const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

        records = await query(`
          SELECT ta.id, t.title as task_title, t.task_type, t.difficulty,
                 ip.intern_code, u.first_name, u.last_name,
                 tr.name as track_name, c.name as cohort_name,
                 ta.due_date, ta.status, ts.score, t.max_score
          FROM task_assignments ta
          JOIN tasks t ON ta.task_id = t.id
          JOIN intern_profiles ip ON ta.intern_id = ip.id
          JOIN users u ON ip.user_id = u.id
          JOIN tracks tr ON t.track_id = tr.id
          JOIN cohorts c ON ta.cohort_id = c.id
          LEFT JOIN task_submissions ts ON ta.id = ts.task_assignment_id
          ${where}
          ORDER BY ta.due_date ASC
        `, params);

        headers = [
          { key: 'task_title', label: 'Task Title' },
          { key: 'task_type', label: 'Type' },
          { key: 'difficulty', label: 'Difficulty' },
          { key: 'intern_code', label: 'Intern Code' },
          { key: 'first_name', label: 'First Name' },
          { key: 'last_name', label: 'Last Name' },
          { key: 'track_name', label: 'Track' },
          { key: 'cohort_name', label: 'Cohort' },
          { key: 'due_date', label: 'Due Date' },
          { key: 'status', label: 'Status' },
          { key: 'score', label: 'Score' },
          { key: 'max_score', label: 'Max Score' }
        ];
        break;
      }

      case 'performance': {
        let conds = [];
        let params = [];
        if (req.user.role === 'mentor') {
          conds.push('(ip.mentor_id = ? OR c.lead_mentor_id = ? OR pe.reviewer_id = ?)');
          params.push(req.user.mentorId, req.user.mentorId, req.user.id);
        }

        const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

        records = await query(`
          SELECT pe.id, ip.intern_code, u.first_name, u.last_name,
                 tr.name as track_name, c.name as cohort_name,
                 pp.name as period_name, pe.overall_score, pe.overall_rating,
                 pe.status, ru.first_name as reviewer_first, ru.last_name as reviewer_last
          FROM performance_evaluations pe
          JOIN intern_profiles ip ON pe.intern_id = ip.id
          JOIN users u ON ip.user_id = u.id
          JOIN tracks tr ON pe.track_id = tr.id
          JOIN cohorts c ON pe.cohort_id = c.id
          JOIN users ru ON pe.reviewer_id = ru.id
          LEFT JOIN performance_periods pp ON pe.period_id = pp.id
          ${where}
          ORDER BY pe.id DESC
        `, params);

        headers = [
          { key: 'intern_code', label: 'Intern Code' },
          { key: 'first_name', label: 'First Name' },
          { key: 'last_name', label: 'Last Name' },
          { key: 'track_name', label: 'Track' },
          { key: 'cohort_name', label: 'Cohort' },
          { key: 'period_name', label: 'Evaluation Period' },
          { key: 'overall_score', label: 'Overall Score (%)' },
          { key: 'overall_rating', label: 'Rating Band' },
          { key: 'status', label: 'Status' },
          { key: 'reviewer_first', label: 'Reviewer First Name' },
          { key: 'reviewer_last', label: 'Reviewer Last Name' }
        ];
        break;
      }

      case 'cohorts': {
        let conds = [];
        let params = [];
        if (req.user.role === 'mentor') {
          conds.push('(c.lead_mentor_id = ? OR c.id IN (SELECT cohort_id FROM intern_profiles WHERE mentor_id = ?))');
          params.push(req.user.mentorId, req.user.mentorId);
        }

        const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

        records = await query(`
          SELECT c.id, c.name, c.cohort_code, tr.name as track_name,
                 c.start_date, c.end_date, c.status
          FROM cohorts c
          JOIN tracks tr ON c.track_id = tr.id
          ${where}
          ORDER BY c.id ASC
        `, params);

        headers = [
          { key: 'cohort_code', label: 'Cohort Code' },
          { key: 'name', label: 'Cohort Name' },
          { key: 'track_name', label: 'Track' },
          { key: 'start_date', label: 'Start Date' },
          { key: 'end_date', label: 'End Date' },
          { key: 'status', label: 'Status' }
        ];
        break;
      }

      default:
        return res.status(400).json({ success: false, message: `Unsupported export type: '${type}'` });
    }

    const csvData = toCSV(records, headers);

    // Record Audit Trail (Gate 17)
    await recordAuditLog(req.user.id, 'EXPORT_REPORT', 'reports', null, null, { type, recordCount: records.length, filters: req.query }, req);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvData);
  } catch (error) {
    console.error('exportReportCSV error:', error);
    res.status(500).json({ success: false, message: 'Failed to export report CSV.' });
  }
};


// ============================================================================
// GATE 14: INTERN PERSONAL ANALYTICS
// ============================================================================

/**
 * Personal Career Scorecard for Intern (Strict Profile Isolation)
 */
export const getMyPersonalAnalytics = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    // 1. Personal Attendance stats
    const [att] = await query(`
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days
      FROM attendance
      WHERE intern_id = ?
    `, [internProfileId]);

    const totalDays = parseInt(att?.total_days || 0, 10);
    const presentDays = parseInt(att?.present_days || 0, 10);
    const lateDays = parseInt(att?.late_days || 0, 10);
    const attendanceRate = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 100;

    // 2. Personal Task stats
    const [tasks] = await query(`
      SELECT
        COUNT(*) as total_assigned,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN due_date < NOW() AND status IN ('assigned', 'in_progress', 'returned') THEN 1 ELSE 0 END) as overdue_tasks
      FROM task_assignments
      WHERE intern_id = ?
    `, [internProfileId]);

    // 3. Latest Finalized Performance
    const [latestPerf] = await query(`
      SELECT pe.overall_score, pe.overall_rating, pp.name as period_name
      FROM performance_evaluations pe
      LEFT JOIN performance_periods pp ON pe.period_id = pp.id
      WHERE pe.intern_id = ? AND pe.status = 'finalized'
      ORDER BY pe.finalized_at DESC
      LIMIT 1
    `, [internProfileId]);

    res.json({
      success: true,
      data: {
        attendance: {
          totalDays,
          attendanceRate: `${attendanceRate}%`,
          lateDays,
          absentDays: parseInt(att?.absent_days || 0, 10)
        },
        tasks: {
          totalAssigned: parseInt(tasks?.total_assigned || 0, 10),
          completed: parseInt(tasks?.completed_tasks || 0, 10),
          inProgress: parseInt(tasks?.in_progress_tasks || 0, 10),
          overdue: parseInt(tasks?.overdue_tasks || 0, 10)
        },
        performance: latestPerf ? {
          overallScore: parseFloat(latestPerf.overall_score),
          rating: latestPerf.overall_rating,
          periodName: latestPerf.period_name
        } : null
      }
    });
  } catch (error) {
    console.error('getMyPersonalAnalytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load personal analytics.' });
  }
};

// Legacy backwards compatibility aliases
export const exportAttendanceCSV = (req, res) => {
  req.params.type = 'attendance';
  return exportReportCSV(req, res);
};

export const exportInternsCSV = (req, res) => {
  req.params.type = 'interns';
  return exportReportCSV(req, res);
};
