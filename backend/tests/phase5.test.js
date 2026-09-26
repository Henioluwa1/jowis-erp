import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runPhase5Tests() {
  const PORT = 5088;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('=======================================================');
  console.log('⚡  JOWIS STUDIO ERP — PHASE 5 AUTOMATED TEST SUITE');
  console.log('🎯  REPORTS, ANALYTICS & MANAGEMENT INTELLIGENCE');
  console.log(`🧪  Test server running on http://localhost:${PORT}`);
  console.log('=======================================================\n');

  const baseUrl = `http://localhost:${PORT}/api`;
  let testPassed = 0;
  let testFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testFailed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate All Roles
    // -------------------------------------------------------------
    console.log('🔹 SETUP: Authenticating users across roles...');

    // 1. Super Admin
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
    });
    const adminData = await adminRes.json();
    assert(adminData.success && adminData.token, 'Super Admin login must succeed');
    const adminToken = adminData.token;

    // 2. Mentor 1: Sam (Lead for Cohort 1 / Mentor for Intern 1)
    const mentor1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mentor.sam@jowis.com', password: 'Mentor@12345' })
    });
    const mentor1Data = await mentor1Res.json();
    assert(mentor1Data.success && mentor1Data.token, 'Mentor 1 (Samuel Adeyemi) login must succeed');
    const mentor1Token = mentor1Data.token;

    // 3. Mentor 2: Chioma (Lead for Cohort 2 / Mentor for Intern 2)
    const mentor2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mentor.chioma@jowis.com', password: 'Mentor@12345' })
    });
    const mentor2Data = await mentor2Res.json();
    assert(mentor2Data.success && mentor2Data.token, 'Mentor 2 (Chioma Okeke) login must succeed');
    const mentor2Token = mentor2Data.token;

    // 4. Intern 1: David (Track 1 / Cohort 1)
    const intern1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const intern1Data = await intern1Res.json();
    assert(intern1Data.success && intern1Data.token, 'Intern 1 (David Adeleke) login must succeed');
    const intern1Token = intern1Data.token;

    // 5. Intern 2: Zainab (Track 2 / Cohort 2)
    const intern2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern.zainab@jowis.com', password: 'Intern@12345' })
    });
    const intern2Data = await intern2Res.json();
    assert(intern2Data.success && intern2Data.token, 'Intern 2 (Zainab Bello) login must succeed');
    const intern2Token = intern2Data.token;

    // -------------------------------------------------------------
    // GATE 1: Reporting Data Architecture & Composite Indexes
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1: Reporting Data Architecture & Composite Indexes');

    const attIndexes = await query("SHOW INDEX FROM attendance WHERE Key_name = 'idx_att_date_status'");
    assert(attIndexes.length > 0, 'idx_att_date_status exists on attendance table');

    const taskIndexes = await query("SHOW INDEX FROM task_assignments WHERE Key_name = 'idx_ta_due_status'");
    assert(taskIndexes.length > 0, 'idx_ta_due_status exists on task_assignments table');

    const perfIndexes = await query("SHOW INDEX FROM performance_evaluations WHERE Key_name = 'idx_pe_period_status'");
    assert(perfIndexes.length > 0, 'idx_pe_period_status exists on performance_evaluations table');

    const internIndexes = await query("SHOW INDEX FROM intern_profiles WHERE Key_name = 'idx_ip_track_status'");
    assert(internIndexes.length > 0, 'idx_ip_track_status exists on intern_profiles table');

    // -------------------------------------------------------------
    // GATE 2: Executive Management Dashboard
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: Executive Management Dashboard');

    const execRes = await fetch(`${baseUrl}/reports/executive`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(execRes.status === 200, 'Executive Dashboard returns 200 OK');
    const execData = await execRes.json();
    assert(execData.success === true, 'Executive Dashboard payload reports success');

    const { interns, training, attendance, performance, distribution } = execData.data;
    assert(interns && typeof interns.total === 'number', 'Executive: interns KPI group present with total');
    assert(typeof interns.active === 'number', 'Executive: active is numeric');
    assert(training && typeof training.totalAssignedTasks === 'number', 'Executive: training KPI group present with totalAssignedTasks');
    assert(typeof training.completionRate === 'string' && training.completionRate.endsWith('%'), 'Executive: completionRate formatted as %');
    assert(attendance && typeof attendance.attendanceRate === 'string', 'Executive: attendance KPI group present with attendanceRate');
    assert(performance && typeof performance.finalized === 'number', 'Executive: performance KPI group present with finalized count');
    assert(Array.isArray(distribution.byTrack), 'Executive: distribution byTrack is an array');
    assert(Array.isArray(distribution.byCohort), 'Executive: distribution byCohort is an array');

    // -------------------------------------------------------------
    // GATE 3: Parameter-Safe Multi-Criteria Filtering Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Parameter-Safe Multi-Criteria Filtering Engine');

    const filteredTrackRes = await fetch(`${baseUrl}/reports/executive?trackId=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(filteredTrackRes.status === 200, 'Filtering by trackId=1 succeeds');
    const filteredTrackData = await filteredTrackRes.json();
    assert(filteredTrackData.success === true, 'Filtered track payload reports success');

    const filteredCohortRes = await fetch(`${baseUrl}/reports/executive?cohortId=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(filteredCohortRes.status === 200, 'Filtering by cohortId=1 succeeds');

    const filteredDateRes = await fetch(`${baseUrl}/reports/executive?startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(filteredDateRes.status === 200, 'Filtering by date range succeeds');

    // SQL Injection Defense test
    const sqliRes = await fetch(`${baseUrl}/reports/executive?trackId=1' OR '1'='1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    // Parameterized queries treat trackId as literal string or return 200 with 0 matches / handled safely
    assert(sqliRes.status === 200 || sqliRes.status === 400, 'SQL injection attempt handled safely without unhandled error');

    // -------------------------------------------------------------
    // GATE 4: Intern Lifecycle & Demographic Analytics
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Intern Lifecycle & Demographic Analytics');

    const internReportRes = await fetch(`${baseUrl}/reports/interns`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(internReportRes.status === 200, 'Intern report endpoint returns 200 OK');
    const internReportData = await internReportRes.json();
    assert(internReportData.success === true, 'Intern report payload reports success');

    assert(internReportData.data.lifecycle && typeof internReportData.data.lifecycle.active === 'number', 'Lifecycle breakdown present with active count');
    assert(Array.isArray(internReportData.data.growth), 'Intern growth trend is an array');
    assert(typeof internReportData.data.avgDurationDays === 'number', 'avgDurationDays is numeric');
    assert(Array.isArray(internReportData.data.roster.records), 'Intern roster records is an array');
    assert(typeof internReportData.data.roster.total === 'number', 'Intern roster total count is numeric');

    // -------------------------------------------------------------
    // GATE 5: Authoritative Attendance Intelligence
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Authoritative Attendance Intelligence');

    const attReportRes = await fetch(`${baseUrl}/reports/attendance`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(attReportRes.status === 200, 'Attendance report endpoint returns 200 OK');
    const attReportData = await attReportRes.json();
    assert(attReportData.success === true, 'Attendance report payload reports success');

    assert(typeof attReportData.data.attendanceRate === 'string', 'attendanceRate is formatted string');
    assert(typeof attReportData.data.punctualityRate === 'string', 'punctualityRate is formatted string');
    assert(typeof attReportData.data.avgLateMinutes === 'number', 'avgLateMinutes is numeric');
    assert(Array.isArray(attReportData.data.dailyTrend), 'dailyTrend is an array');
    assert(Array.isArray(attReportData.data.cohortBreakdown), 'cohortBreakdown is an array');

    // -------------------------------------------------------------
    // GATE 6: Task & Training Execution Analytics
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6: Task & Training Execution Analytics');

    const taskReportRes = await fetch(`${baseUrl}/reports/tasks`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(taskReportRes.status === 200, 'Task report endpoint returns 200 OK');
    const taskReportData = await taskReportRes.json();
    assert(taskReportData.success === true, 'Task report payload reports success');

    const tSummary = taskReportData.data.summary;
    assert(typeof tSummary.total_assigned === 'number', 'Task report summary includes total_assigned');
    assert(typeof tSummary.completion_rate === 'string', 'Task report includes completion_rate');
    assert(typeof tSummary.submission_rate === 'string', 'Task report includes submission_rate');
    assert(Array.isArray(taskReportData.data.modulePerformance), 'modulePerformance is an array');
    assert(Array.isArray(taskReportData.data.mentorBacklog), 'mentorBacklog is an array');

    // -------------------------------------------------------------
    // GATE 7: Performance & Evaluation Analytics
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 7: Performance & Evaluation Analytics');

    const perfReportRes = await fetch(`${baseUrl}/reports/performance`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(perfReportRes.status === 200, 'Performance report endpoint returns 200 OK');
    const perfReportData = await perfReportRes.json();
    assert(perfReportData.success === true, 'Performance report payload reports success');

    assert(typeof perfReportData.data.avgScore === 'number', 'Performance avgScore is numeric');
    assert(perfReportData.data.ratingBreakdown !== undefined, 'ratingBreakdown is present');
    assert(Array.isArray(perfReportData.data.criteriaPerformance), 'criteriaPerformance is an array');
    assert(Array.isArray(perfReportData.data.periodComparison), 'periodComparison is an array');

    // -------------------------------------------------------------
    // GATE 8: Cohort Progression & Performance Matrix
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 8: Cohort Progression & Performance Matrix');

    const cohortReportRes = await fetch(`${baseUrl}/reports/cohorts`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(cohortReportRes.status === 200, 'Cohort matrix endpoint returns 200 OK');
    const cohortReportData = await cohortReportRes.json();
    assert(cohortReportData.success === true, 'Cohort matrix payload reports success');
    assert(Array.isArray(cohortReportData.data), 'Cohort matrix data is an array');
    if (cohortReportData.data.length > 0) {
      const c1 = cohortReportData.data[0];
      assert(c1.cohort_name !== undefined, 'Cohort row contains cohort_name');
      assert(c1.attendance_rate !== undefined, 'Cohort row contains attendance_rate');
      assert(c1.task_completion_rate !== undefined, 'Cohort row contains task_completion_rate');
    }

    // -------------------------------------------------------------
    // GATE 9: Track Utilization & Comparative Metrics
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 9: Track Utilization & Comparative Metrics');

    const trackReportRes = await fetch(`${baseUrl}/reports/tracks`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(trackReportRes.status === 200, 'Track utilization endpoint returns 200 OK');
    const trackReportData = await trackReportRes.json();
    assert(trackReportData.success === true, 'Track utilization payload reports success');
    assert(Array.isArray(trackReportData.data), 'Track metrics data is an array');
    if (trackReportData.data.length > 0) {
      const tr1 = trackReportData.data[0];
      assert(tr1.track_name !== undefined, 'Track row contains track_name');
      assert(typeof tr1.total_interns === 'number', 'Track row total_interns is numeric');
    }

    // -------------------------------------------------------------
    // GATE 10: Mentor Workload & Review Cadence
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 10: Mentor Workload & Review Cadence');

    const mentorReportRes = await fetch(`${baseUrl}/reports/mentors`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(mentorReportRes.status === 200, 'Mentor workload endpoint returns 200 OK');
    const mentorReportData = await mentorReportRes.json();
    assert(mentorReportData.success === true, 'Mentor workload payload reports success');
    assert(Array.isArray(mentorReportData.data), 'Mentor workload data is an array');
    assert(mentorReportData.data.length >= 2, 'Admin sees all mentors in workload report');

    const m1 = mentorReportData.data[0];
    assert(m1.first_name !== undefined, 'Mentor row contains first_name');
    assert(typeof m1.supervised_interns === 'number', 'supervised_interns is numeric');
    assert(typeof m1.pending_task_reviews === 'number', 'pending_task_reviews is numeric');
    assert(typeof m1.pending_evaluations === 'number', 'pending_evaluations is numeric');

    // -------------------------------------------------------------
    // GATE 11: Longitudinal & Time-Series Analytics
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 11: Longitudinal & Time-Series Analytics');

    const timeSeriesRes = await fetch(`${baseUrl}/reports/time-series`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(timeSeriesRes.status === 200, 'Time-series endpoint returns 200 OK');
    const timeSeriesData = await timeSeriesRes.json();
    assert(timeSeriesData.success === true, 'Time-series payload reports success');
    assert(Array.isArray(timeSeriesData.data.internGrowth), 'internGrowth dataset is an array');
    assert(Array.isArray(timeSeriesData.data.attendanceTrends), 'attendanceTrends dataset is an array');
    assert(Array.isArray(timeSeriesData.data.taskVelocity), 'taskVelocity dataset is an array');

    // -------------------------------------------------------------
    // GATE 12: Drill-Down Lineage & Underlying Record Tracing
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 12: Drill-Down Lineage & Underlying Record Tracing');

    const drillTasksRes = await fetch(`${baseUrl}/reports/drill-down?metric=overdue_tasks`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(drillTasksRes.status === 200, 'Drill-down overdue_tasks returns 200 OK');
    const drillTasksData = await drillTasksRes.json();
    assert(drillTasksData.data.metric === 'overdue_tasks', 'Drill-down metric is overdue_tasks');
    assert(Array.isArray(drillTasksData.data.records), 'Drill-down records is an array');

    const drillEvalRes = await fetch(`${baseUrl}/reports/drill-down?metric=pending_evaluations`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(drillEvalRes.status === 200, 'Drill-down pending_evaluations returns 200 OK');

    const drillLateRes = await fetch(`${baseUrl}/reports/drill-down?metric=late_attendance`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(drillLateRes.status === 200, 'Drill-down late_attendance returns 200 OK');

    const drillActiveRes = await fetch(`${baseUrl}/reports/drill-down?metric=active_interns`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(drillActiveRes.status === 200, 'Drill-down active_interns returns 200 OK');
    const drillActiveData = await drillActiveRes.json();
    assert(drillActiveData.data.records.length > 0, 'Drill-down active_interns returns active intern records');

    const drillInvalidRes = await fetch(`${baseUrl}/reports/drill-down?metric=invalid_metric`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(drillInvalidRes.status === 400, 'Drill-down invalid_metric returns 400 Bad Request');

    // -------------------------------------------------------------
    // GATE 13 & 17: Standard RFC-4180 CSV Exporter & Audit Logging
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 13 & 17: Standard RFC-4180 CSV Exporter & Audit Logging');

    // 1. Export Attendance CSV
    const exportAttRes = await fetch(`${baseUrl}/reports/export/attendance`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(exportAttRes.status === 200, 'Export attendance CSV returns 200 OK');
    assert(exportAttRes.headers.get('content-type').includes('text/csv'), 'Content-Type is text/csv');
    const attCsvText = await exportAttRes.text();
    assert(attCsvText.includes('"Date"') && attCsvText.includes('"Intern Code"'), 'Attendance CSV includes expected headers');

    // 2. Export Interns CSV
    const exportInternsRes = await fetch(`${baseUrl}/reports/export/interns`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(exportInternsRes.status === 200, 'Export interns CSV returns 200 OK');
    const internsCsvText = await exportInternsRes.text();
    assert(internsCsvText.includes('"Intern Code"') && internsCsvText.includes('"Email"'), 'Interns CSV includes expected headers');

    // 3. Export Tasks CSV
    const exportTasksRes = await fetch(`${baseUrl}/reports/export/tasks`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(exportTasksRes.status === 200, 'Export tasks CSV returns 200 OK');

    // 4. Export Performance CSV
    const exportPerfRes = await fetch(`${baseUrl}/reports/export/performance`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(exportPerfRes.status === 200, 'Export performance CSV returns 200 OK');

    // 5. Verify Audit Log Entry
    const [auditEntry] = await query("SELECT * FROM audit_logs WHERE action = 'EXPORT_REPORT' ORDER BY id DESC LIMIT 1");
    assert(auditEntry !== undefined, 'Audit log contains EXPORT_REPORT action record');
    assert(auditEntry.entity_type === 'reports', 'Audit log entity_type is reports');

    // -------------------------------------------------------------
    // GATE 14: Intern Personal Career Scorecard & Strict Isolation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 14: Intern Personal Career Scorecard & Strict Isolation');

    // 1. Intern accesses own scorecard
    const internScorecardRes = await fetch(`${baseUrl}/reports/me`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internScorecardRes.status === 200, 'Intern accessing /reports/me returns 200 OK');
    const internScorecardData = await internScorecardRes.json();
    assert(internScorecardData.success === true, 'Scorecard reports success');
    assert(internScorecardData.data.attendance !== undefined, 'Scorecard contains personal attendance');
    assert(internScorecardData.data.tasks !== undefined, 'Scorecard contains personal tasks');

    // 2. Intern blocked from administrative reporting endpoints (Strict 403 Forbidden)
    const internBlocked1 = await fetch(`${baseUrl}/reports/executive`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internBlocked1.status === 403, 'Intern accessing /reports/executive must return 403 Forbidden');

    const internBlocked2 = await fetch(`${baseUrl}/reports/attendance`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internBlocked2.status === 403, 'Intern accessing /reports/attendance must return 403 Forbidden');

    const internBlocked3 = await fetch(`${baseUrl}/reports/tasks`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internBlocked3.status === 403, 'Intern accessing /reports/tasks must return 403 Forbidden');

    const internBlocked4 = await fetch(`${baseUrl}/reports/performance`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internBlocked4.status === 403, 'Intern accessing /reports/performance must return 403 Forbidden');

    const internBlocked5 = await fetch(`${baseUrl}/reports/mentors`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internBlocked5.status === 403, 'Intern accessing /reports/mentors must return 403 Forbidden');

    const internBlocked6 = await fetch(`${baseUrl}/reports/drill-down?metric=active_interns`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internBlocked6.status === 403, 'Intern accessing /reports/drill-down must return 403 Forbidden');

    const internBlocked7 = await fetch(`${baseUrl}/reports/export/executive`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(internBlocked7.status === 403, 'Intern accessing /reports/export/executive must return 403 Forbidden');

    // -------------------------------------------------------------
    // GATE 15: Mentor Scoping & Isolation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 15: Mentor Scoping & Isolation');

    // 1. Mentor 1 accessing mentor workload only sees their own record
    const mentorWorkloadRes = await fetch(`${baseUrl}/reports/mentors`, {
      headers: { Authorization: `Bearer ${mentor1Token}` }
    });
    assert(mentorWorkloadRes.status === 200, 'Mentor 1 accessing /reports/mentors returns 200 OK');
    const mentorWorkloadData = await mentorWorkloadRes.json();
    assert(mentorWorkloadData.data.length === 1, 'Mentor 1 is scoped to exactly 1 record (their own workload)');

    // 2. Mentor 1 accessing executive dashboard succeeds with scoped data
    const mentorExecRes = await fetch(`${baseUrl}/reports/executive`, {
      headers: { Authorization: `Bearer ${mentor1Token}` }
    });
    assert(mentorExecRes.status === 200, 'Mentor 1 accessing /reports/executive returns 200 OK');

    // 3. Mentor 1 accessing drill-down only sees supervised interns
    const mentorDrillRes = await fetch(`${baseUrl}/reports/drill-down?metric=active_interns`, {
      headers: { Authorization: `Bearer ${mentor1Token}` }
    });
    assert(mentorDrillRes.status === 200, 'Mentor 1 accessing drill-down returns 200 OK');
    const mentorDrillData = await mentorDrillRes.json();
    assert(Array.isArray(mentorDrillData.data.records), 'Mentor 1 drill-down returns records array');

    // 4. Mentor 1 exporting interns CSV succeeds with scoped data
    const mentorExportRes = await fetch(`${baseUrl}/reports/export/interns`, {
      headers: { Authorization: `Bearer ${mentor1Token}` }
    });
    assert(mentorExportRes.status === 200, 'Mentor 1 exporting interns CSV returns 200 OK');
    const mentorExportText = await mentorExportRes.text();
    assert(mentorExportText.includes('"Intern Code"'), 'Mentor 1 export returns CSV format');

    console.log('\n=======================================================');
    console.log(`🎯 ALL PHASE 5 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('Test Execution Terminated with Error:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase5Tests();
