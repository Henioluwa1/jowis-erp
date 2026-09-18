import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runPhase4Tests() {
  const PORT = 5099;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('=======================================================');
  console.log('⚡  JOWIS STUDIO ERP — PHASE 4 AUTOMATED TEST SUITE');
  console.log('🎯  PERFORMANCE MANAGEMENT & EVALUATION ENGINE');
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
    // GATE 1: Performance Domain Data Model
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1: Performance Domain Data Model & Relational Schema');

    const [tPeriods] = await query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'performance_periods'");
    assert(tPeriods, "Table 'performance_periods' must exist");

    const [tCriteria] = await query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'performance_criteria'");
    assert(tCriteria, "Table 'performance_criteria' must exist");

    const [tBands] = await query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'performance_rating_bands'");
    assert(tBands, "Table 'performance_rating_bands' must exist");

    const [tScores] = await query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'evaluation_scores'");
    assert(tScores, "Table 'evaluation_scores' must exist");

    const evalCols = await query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'performance_evaluations'");
    const evalColNames = evalCols.map(c => c.COLUMN_NAME);
    assert(evalColNames.includes('period_id'), "Column 'performance_evaluations.period_id' exists");
    assert(evalColNames.includes('reviewer_id'), "Column 'performance_evaluations.reviewer_id' exists");
    assert(evalColNames.includes('status'), "Column 'performance_evaluations.status' exists");
    assert(evalColNames.includes('overall_rating'), "Column 'performance_evaluations.overall_rating' exists");
    assert(evalColNames.includes('is_locked'), "Column 'performance_evaluations.is_locked' exists");
    assert(evalColNames.includes('strengths'), "Column 'performance_evaluations.strengths' exists");
    assert(evalColNames.includes('areas_for_improvement'), "Column 'performance_evaluations.areas_for_improvement' exists");

    // -------------------------------------------------------------
    // GATE 2: Performance Criteria Management & Weight Balances
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: Performance Criteria Management (Validation, Weights, Referential Guards)');

    // 1. Invalid weight (negative)
    const badWeightRes = await fetch(`${baseUrl}/performance/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Invalid Criteria', weight: -10, maxScore: 100 })
    });
    assert(badWeightRes.status === 400, 'Criterion with negative weight must return HTTP 400');

    // 2. Invalid max score (0)
    const badMaxScoreRes = await fetch(`${baseUrl}/performance/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Invalid Criteria', weight: 10, maxScore: 0 })
    });
    assert(badMaxScoreRes.status === 400, 'Criterion with 0 max_score must return HTTP 400');

    // 3. Create a valid test criterion
    const createCritRes = await fetch(`${baseUrl}/performance/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Automated CI/CD & DevOps Readiness',
        description: 'Ability to automate deployment and manage container pipelines.',
        category: 'delivery',
        weight: 10.00,
        maxScore: 100,
        status: 'inactive' // Set to inactive so foundation 100% active weight is untouched
      })
    });
    const createCritData = await createCritRes.json();
    assert(createCritRes.status === 201 && createCritData.success, 'Admin can create evaluation criterion');
    const testCriterionId = createCritData.data.id;

    // 4. Update criterion
    const updateCritRes = await fetch(`${baseUrl}/performance/criteria/${testCriterionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ weight: 15.00, description: 'Updated pipeline evaluation.' })
    });
    assert(updateCritRes.status === 200, 'Admin can update evaluation criterion');

    // 5. Validate weights endpoint
    const weightValRes = await fetch(`${baseUrl}/performance/criteria/validate-weights`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const weightValData = await weightValRes.json();
    assert(weightValRes.status === 200 && weightValData.data.isBalanced === true, 'Foundation criteria weights total exactly 100%');

    // 6. Delete unused criterion
    const delCritRes = await fetch(`${baseUrl}/performance/criteria/${testCriterionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(delCritRes.status === 200, 'Admin can delete unreferenced criterion');

    // 7. Prevent deletion of criterion with historical evaluation scores
    const delHistCritRes = await fetch(`${baseUrl}/performance/criteria/1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(delHistCritRes.status === 400, 'Referential Integrity: Deleting criterion with historical scores must return HTTP 400');

    // -------------------------------------------------------------
    // GATE 3: Performance Period Management & Lifecycles
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Performance Period Management (Lifecycle & History Protection)');

    // 1. Invalid period (start date after end date)
    const badPeriodRes = await fetch(`${baseUrl}/performance/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Faulty Period',
        startDate: '2026-12-31',
        endDate: '2026-01-01'
      })
    });
    assert(badPeriodRes.status === 400, 'Period with start_date after end_date must return HTTP 400');

    // 2. Create valid test period in 'draft'
    const testPeriodName = `Test Cycle Q4 ${Date.now()}`;
    const createPeriodRes = await fetch(`${baseUrl}/performance/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: testPeriodName,
        description: 'Automated test performance evaluation cycle.',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        status: 'draft'
      })
    });
    const createPeriodData = await createPeriodRes.json();
    assert(createPeriodRes.status === 201 && createPeriodData.success, 'Admin can create draft performance period');
    const testPeriodId = createPeriodData.data.id;

    // 3. Update draft period
    const updatePeriodRes = await fetch(`${baseUrl}/performance/periods/${testPeriodId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ description: 'Updated test cycle scope.' })
    });
    assert(updatePeriodRes.status === 200, 'Admin can update draft performance period');

    // 4. Transition: draft -> active
    const activatePeriodRes = await fetch(`${baseUrl}/performance/periods/${testPeriodId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'active' })
    });
    assert(activatePeriodRes.status === 200, "Valid transition: 'draft' -> 'active' succeeds");

    // 5. Invalid transition: active -> draft (arbitrary jump)
    const invalidJumpRes = await fetch(`${baseUrl}/performance/periods/${testPeriodId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'draft' })
    });
    assert(invalidJumpRes.status === 400, "Invalid transition: 'active' -> 'draft' must return HTTP 400");

    // -------------------------------------------------------------
    // GATE 4: Evaluation Creation & Assignment
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Evaluation Assignment Engine (Scoping, Eligibility, Duplicate Guards)');

    // 1. Missing target
    const noTargetRes = await fetch(`${baseUrl}/performance/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ periodId: testPeriodId })
    });
    assert(noTargetRes.status === 400, 'Assignment without internId or cohortId must return HTTP 400');

    // 2. Mentor 2 attempting to evaluate Intern 1 (Cross-mentor isolation)
    const unauthMentorRes = await fetch(`${baseUrl}/performance/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentor2Token}` },
      body: JSON.stringify({ internId: 1, periodId: testPeriodId })
    });
    assert(unauthMentorRes.status === 403, 'Mentor 2 blocked from assigning evaluation for Intern 1 outside supervision (403 Forbidden)');

    // 3. Valid assignment by Admin for Intern 1 in testPeriod
    const validAssignRes = await fetch(`${baseUrl}/performance/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ internId: 1, periodId: testPeriodId })
    });
    const validAssignData = await validAssignRes.json();
    assert(validAssignRes.status === 201 && validAssignData.success, 'Admin successfully initiates evaluation for Intern 1');
    const testEvaluationId = validAssignData.data.id;

    // 4. Duplicate assignment prevention for same intern and period
    const dupAssignRes = await fetch(`${baseUrl}/performance/evaluations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ internId: 1, periodId: testPeriodId })
    });
    assert(dupAssignRes.status === 400, 'Duplicate evaluation for same intern and period must return HTTP 400');

    // -------------------------------------------------------------
    // GATE 5 & 6: Evaluation Workspace & Server Calculation Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5 & 6: Reviewer Workspace & Server Calculation Engine');

    // 1. Fetch evaluation details
    const evalDetailsRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const evalDetailsData = await evalDetailsRes.json();
    assert(evalDetailsRes.status === 200 && evalDetailsData.data.scores.length > 0, 'Evaluation workspace loads criteria scores structure');
    const criteriaScores = evalDetailsData.data.scores;

    // 2. Submit score exceeding max_score (e.g. 150/100)
    const overScoreRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        scores: [{ criterionId: criteriaScores[0].criterion_id, score: 150 }]
      })
    });
    assert(overScoreRes.status === 400, 'Score exceeding maximum allowed score must return HTTP 400');

    // 3. Submit negative score
    const negScoreRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        scores: [{ criterionId: criteriaScores[0].criterion_id, score: -5 }]
      })
    });
    assert(negScoreRes.status === 400, 'Negative score must return HTTP 400');

    // 4. Save valid evaluation scores (Mentor 1: Sam evaluates Intern 1)
    // Formula check:
    // Criteria:
    // 1: Technical Competence (Weight: 25%, Max: 100) -> Score: 88 (Contribution: 22.00)
    // 2: Code Quality (Weight: 25%, Max: 100) -> Score: 92 (Contribution: 23.00)
    // 3: Milestone Delivery (Weight: 20%, Max: 100) -> Score: 85 (Contribution: 17.00)
    // 4: Communication (Weight: 15%, Max: 100) -> Score: 90 (Contribution: 13.50)
    // 5: Initiative (Weight: 15%, Max: 100) -> Score: 80 (Contribution: 12.00)
    // Expected Sum = 22.00 + 23.00 + 17.00 + 13.50 + 12.00 = 87.50%
    const mockScores = [
      { criterionId: criteriaScores[0].criterion_id, score: 88, comments: 'Solid architecture.' },
      { criterionId: criteriaScores[1].criterion_id, score: 92, comments: 'Clean, modular code.' },
      { criterionId: criteriaScores[2].criterion_id, score: 85, comments: 'Delivered milestones on time.' },
      { criterionId: criteriaScores[3].criterion_id, score: 90, comments: 'Proactive communication.' },
      { criterionId: criteriaScores[4].criterion_id, score: 80, comments: 'Strong initiative.' }
    ];

    const saveDraftRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentor1Token}` },
      body: JSON.stringify({
        scores: mockScores,
        strengths: 'Exceptional full-stack competence, clean async programming, and reliable delivery.',
        areasForImprovement: 'Expand automated end-to-end integration test suites.',
        reviewerComments: 'David is performing at an advanced level with strong engineering autonomy.'
      })
    });
    const saveDraftData = await saveDraftRes.json();
    assert(saveDraftRes.status === 200 && Math.abs(saveDraftData.data.overallScore - 87.50) < 0.05, 'Server-authoritative calculation accurately computed 87.50% overall score');

    // -------------------------------------------------------------
    // GATE 7 & 8: Rating Resolution, Finalization & State Locking
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 7 & 8: Rating Band Resolution, Finalization & Historical Locking');

    // 1. Submit evaluation
    const submitEvalRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mentor1Token}` }
    });
    assert(submitEvalRes.status === 200, "Workflow transition: 'draft' -> 'submitted' succeeds");

    // 2. Finalize evaluation
    const finalizeRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mentor1Token}` }
    });
    const finalizeData = await finalizeRes.json();
    assert(finalizeRes.status === 200 && finalizeData.data.status === 'finalized', 'Evaluation successfully finalized');
    assert(finalizeData.data.overallRating === 'Exceeds Expectations', 'Score 87.50% accurately maps to rating band: Exceeds Expectations');
    assert(finalizeData.data.isLocked === true, 'Finalized evaluation is marked locked (is_locked = 1)');

    // 3. Attempt to mutate locked evaluation
    const lockedMutateRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentor1Token}` },
      body: JSON.stringify({ strengths: 'Tampered strengths' })
    });
    assert(lockedMutateRes.status === 400, 'Direct mutation on locked evaluation must return HTTP 400');

    // 4. Controlled Admin Reopen/Amend process
    const reopenRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amendmentReason: 'Formal committee review requested additional technical evaluation detail.' })
    });
    const reopenData = await reopenRes.json();
    assert(reopenRes.status === 200 && reopenData.data.isLocked === false, 'Admin successfully unlocked evaluation through controlled amendment process');

    // 5. Reopen without mandatory justification must fail
    const badReopenRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amendmentReason: '' })
    });
    assert(badReopenRes.status === 400, 'Reopen without minimum mandatory reason must return HTTP 400');

    // Re-finalize for subsequent tests
    await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // -------------------------------------------------------------
    // GATE 9 & 12: Intern Performance View & History
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 9 & 12: Intern Workspace, Radar Distribution & Profile Isolation');

    // 1. Intern 1 views own finalized performance
    const myPerfRes = await fetch(`${baseUrl}/performance/me`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    const myPerfData = await myPerfRes.json();
    assert(myPerfRes.status === 200 && myPerfData.success, 'Intern 1 can retrieve their finalized evaluations');
    assert(myPerfData.data.latest && myPerfData.data.latest.overall_rating === 'Exceeds Expectations', 'Intern 1 sees latest finalized rating');
    assert(myPerfData.data.radarData.length >= 5, 'Intern 1 receives radar chart dataset across criteria');

    // 2. Strict Profile Isolation: Intern 2 blocked from viewing Intern 1 evaluation
    const internLeakRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}`, {
      headers: { Authorization: `Bearer ${intern2Token}` }
    });
    assert(internLeakRes.status === 403, 'Intern 2 blocked from viewing Intern 1 evaluation (403 Forbidden)');

    // 3. Intern 1 blocked from modifying their own score
    const internHackRes = await fetch(`${baseUrl}/performance/evaluations/${testEvaluationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${intern1Token}` },
      body: JSON.stringify({ scores: [{ criterionId: 1, score: 100 }] })
    });
    assert(internHackRes.status === 403, 'Intern 1 blocked from modifying evaluation scores (403 Forbidden)');

    // -------------------------------------------------------------
    // GATE 10 & 11: Mentor & Admin Operations Dashboards
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 10 & 11: Mentor Workspace & Admin Performance Overview');

    // 1. Admin overview dashboard
    const adminDashRes = await fetch(`${baseUrl}/performance/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminDashData = await adminDashRes.json();
    assert(adminDashRes.status === 200 && adminDashData.data.stats.total >= 1, 'Admin overview loads operational KPIs');
    assert(adminDashData.data.ratingDistribution.length > 0, 'Admin overview contains rating band distribution');
    assert(adminDashData.data.trackBreakdown.length > 0, 'Admin overview contains track-by-track breakdown');

    // 2. Mentor workspace
    const mentorWorkRes = await fetch(`${baseUrl}/performance/mentor-workspace`, {
      headers: { Authorization: `Bearer ${mentor1Token}` }
    });
    const mentorWorkData = await mentorWorkRes.json();
    assert(mentorWorkRes.status === 200 && mentorWorkData.data.evaluations.length >= 1, 'Mentor workspace loads scoped evaluations for supervised cohort');

    // -------------------------------------------------------------
    // GATE 13: Metric Separation (Attendance/Tasks do not contaminate score)
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 13: Metric Separation & Domain Boundary Preservation');

    assert(myPerfData.data.supportingContext !== null, 'Supporting context is provided for background visibility');
    assert(myPerfData.data.supportingContext.attendance !== undefined, 'Attendance rate provided in supportingContext');
    assert(myPerfData.data.supportingContext.tasks !== undefined, 'Task completion count provided in supportingContext');
    assert(
      Math.abs(myPerfData.data.latest.overall_score - 87.50) < 0.05,
      'Performance score is strictly derived from criteria scores (87.50%), not contaminated by attendance or task metrics'
    );

    // -------------------------------------------------------------
    // GATE 14 & 15: RBAC Boundaries & Audit Trail Preservation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 14 & 15: RBAC Boundaries & Audit Trail Preservation');

    // 1. Intern attempting to create performance period
    const internPeriodRes = await fetch(`${baseUrl}/performance/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${intern1Token}` },
      body: JSON.stringify({ name: 'Hacked Period', startDate: '2026-01-01', endDate: '2026-02-01' })
    });
    assert(internPeriodRes.status === 403, 'Intern creating period must return 403 Forbidden');

    // 2. Intern attempting to create criterion
    const internCritRes = await fetch(`${baseUrl}/performance/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${intern1Token}` },
      body: JSON.stringify({ name: 'Hacked Criterion', weight: 10, maxScore: 100 })
    });
    assert(internCritRes.status === 403, 'Intern creating criterion must return 403 Forbidden');

    // 3. Verify audit log preservation
    const [auditPeriod] = await query("SELECT * FROM audit_logs WHERE action = 'CREATE_PERFORMANCE_PERIOD' ORDER BY id DESC LIMIT 1");
    assert(auditPeriod, 'CREATE_PERFORMANCE_PERIOD action preserved in audit_logs');

    const [auditAssign] = await query("SELECT * FROM audit_logs WHERE action = 'ASSIGN_PERFORMANCE_EVALUATION' ORDER BY id DESC LIMIT 1");
    assert(auditAssign, 'ASSIGN_PERFORMANCE_EVALUATION action preserved in audit_logs');

    const [auditFinalize] = await query("SELECT * FROM audit_logs WHERE action = 'FINALIZE_PERFORMANCE_EVALUATION' ORDER BY id DESC LIMIT 1");
    assert(auditFinalize, 'FINALIZE_PERFORMANCE_EVALUATION action preserved in audit_logs');

    const [auditAmend] = await query("SELECT * FROM audit_logs WHERE action = 'AMEND_PERFORMANCE_EVALUATION' ORDER BY id DESC LIMIT 1");
    assert(auditAmend, 'AMEND_PERFORMANCE_EVALUATION action preserved in audit_logs');

    console.log('\n=======================================================');
    console.log(`🎯 ALL PHASE 4 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('Test Execution Terminated with Error:', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase4Tests();
