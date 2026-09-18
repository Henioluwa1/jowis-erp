import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runPhase3Tests() {
  const PORT = 5088;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('=======================================================');
  console.log('⚡  JOWIS STUDIO ERP — PHASE 3 AUTOMATED TEST SUITE');
  console.log('🎯  TRAINING EXECUTION, TASKS, ASSIGNMENTS & REVIEWS');
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

    // 4. Intern 1: David (Track 1: Full-Stack)
    const intern1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const intern1Data = await intern1Res.json();
    assert(intern1Data.success && intern1Data.token, 'Intern 1 (David Adeleke) login must succeed');
    const intern1Token = intern1Data.token;

    // 5. Intern 2: Zainab (Track 2: UI/UX)
    const intern2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern.zainab@jowis.com', password: 'Intern@12345' })
    });
    const intern2Data = await intern2Res.json();
    assert(intern2Data.success && intern2Data.token, 'Intern 2 (Zainab Bello) login must succeed');
    const intern2Token = intern2Data.token;

    // -------------------------------------------------------------
    // GATE 1: Training Domain Data Model & Relational Integrity
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1: Training Domain Data Model & Relational Tables');
    const [tmTable] = await query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'training_modules'`);
    assert(tmTable && tmTable.TABLE_NAME === 'training_modules', "Table 'training_modules' must exist");

    const [taTable] = await query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'task_assignments'`);
    assert(taTable && taTable.TABLE_NAME === 'task_assignments', "Table 'task_assignments' must exist");

    const [trTable] = await query(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'task_reviews'`);
    assert(trTable && trTable.TABLE_NAME === 'task_reviews', "Table 'task_reviews' must exist");

    const taskCols = await query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'tasks'`);
    const taskColFields = taskCols.map(c => c.COLUMN_NAME);
    assert(taskColFields.includes('module_id'), "Column 'tasks.module_id' exists");
    assert(taskColFields.includes('task_type'), "Column 'tasks.task_type' exists");
    assert(taskColFields.includes('difficulty'), "Column 'tasks.difficulty' exists");
    assert(taskColFields.includes('pass_score'), "Column 'tasks.pass_score' exists");

    // -------------------------------------------------------------
    // GATE 2: Training Module Management
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: Training Module Management (CRUD, Ordering, Scoping)');
    const testModuleCode = `MOD-TEST-${Date.now().toString().slice(-4)}`;

    // 1. Invalid track rejection
    const invalidTrackMod = await fetch(`${baseUrl}/training/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ trackId: 9999, title: 'Orphan Module', moduleCode: 'MOD-ORPHAN' })
    });
    assert(invalidTrackMod.status === 400, 'Creating module with non-existent track must return HTTP 400');

    // 2. Create valid module in Track 1
    const createModRes = await fetch(`${baseUrl}/training/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        trackId: 1,
        title: 'Microservices & Distributed Systems',
        moduleCode: testModuleCode,
        sequenceOrder: 10,
        estimatedHours: 45,
        status: 'active'
      })
    });
    const createModData = await createModRes.json();
    assert(createModRes.status === 201 && createModData.success, 'Admin can create training module in Track 1');
    const createdModuleId = createModData.data.id;

    // 3. Duplicate module code in same track rejected
    const dupModRes = await fetch(`${baseUrl}/training/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        trackId: 1,
        title: 'Duplicate Code Module',
        moduleCode: testModuleCode
      })
    });
    assert(dupModRes.status === 400, 'Duplicate module code within same track must return HTTP 400');

    // 4. Update module
    const updateModRes = await fetch(`${baseUrl}/training/modules/${createdModuleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Advanced Microservices Architecture & Event Streaming',
        estimatedHours: 50
      })
    });
    const updateModData = await updateModRes.json();
    assert(updateModRes.status === 200 && updateModData.data.title.includes('Advanced'), 'Admin can update training module details');

    // 5. Toggle module status
    const toggleModRes = await fetch(`${baseUrl}/training/modules/${createdModuleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'archived' })
    });
    const toggleModData = await toggleModRes.json();
    assert(toggleModRes.status === 200 && toggleModData.data.status === 'archived', 'Admin can archive training module');

    // Restore to active for task tests
    await fetch(`${baseUrl}/training/modules/${createdModuleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'active' })
    });

    // 6. Intern module scoping: Intern 1 (Track 1) can see Track 1 modules, but not Track 2 exclusive
    const intern1ModulesRes = await fetch(`${baseUrl}/training/modules`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const intern1Modules = await intern1Res.status === 200 ? (await intern1ModulesRes.json()).data : [];
    assert(intern1Modules.every(m => m.track_id === 1), 'Intern 1 only receives modules scoped to Track 1');

    // -------------------------------------------------------------
    // GATE 3: Task Management
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Task Management (Integrity, Types, Difficulty, CRUD)');
    
    // 1. Module belonging to different track rejected (Rule 1 & 2)
    const invalidModuleTask = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Cross Track Mismatched Task',
        description: 'Should fail because module belongs to Track 2, but task claims Track 1',
        trackId: 1,
        moduleId: 7 // Module 7 belongs to Track 2 (Design Thinking)
      })
    });
    assert(invalidModuleTask.status === 400, 'Task with module belonging to different track must return HTTP 400');

    // 2. Create valid task in Track 1
    const createTaskRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Kafka Event-Driven Architecture Pipeline',
        description: 'Build a distributed message queue streaming consumer with node-rdkafka and Redis cache.',
        instructions: '1. Spin up Kafka broker via docker-compose\n2. Implement consumer group with auto-commit false\n3. Provide unit test suite with 90%+ coverage',
        expectedDeliverable: 'GitHub repo with docker-compose.yml and comprehensive README',
        trackId: 1,
        cohortId: 1,
        moduleId: createdModuleId,
        taskType: 'coding',
        difficulty: 'advanced',
        dueDate: '2026-10-15 23:59:59',
        estimatedHours: 16,
        maxScore: 100,
        passScore: 70,
        priority: 'high',
        status: 'published'
      })
    });
    const createTaskData = await createTaskRes.json();
    assert(createTaskRes.status === 201 && createTaskData.success, 'Admin can create published technical task');
    const createdTaskId = createTaskData.data.id;

    // 3. Update task
    const updateTaskRes = await fetch(`${baseUrl}/tasks/${createdTaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ priority: 'urgent', estimatedHours: 20 })
    });
    assert(updateTaskRes.status === 200, 'Admin can update task priority and estimated hours');

    // 4. Toggle task status
    const toggleTaskRes = await fetch(`${baseUrl}/tasks/${createdTaskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'published' })
    });
    assert(toggleTaskRes.status === 200, 'Admin can manage task publication lifecycle');

    // -------------------------------------------------------------
    // GATE 4: Task Assignment Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Task Assignment Engine (Cross-track, Ambiguity, Duplicate Rejection)');

    // 1. Ambiguity check: rejecting when neither internId nor cohortId is specified
    const ambigRes = await fetch(`${baseUrl}/tasks/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ taskId: createdTaskId })
    });
    assert(ambigRes.status === 400, 'Ambiguous assignment without target must be rejected (400)');

    // 2. Cross-track assignment rejection (Rule 3): Intern 2 (Track 2) cannot be assigned Track 1 Task
    const crossTrackRes = await fetch(`${baseUrl}/tasks/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ taskId: createdTaskId, internId: 2 }) // Intern 2 is Zainab (UI/UX)
    });
    assert(crossTrackRes.status === 400, 'Assigning task to intern from a different track must return HTTP 400');

    // 3. Valid assignment to Intern 1 (David, Track 1)
    const validAssignRes = await fetch(`${baseUrl}/tasks/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        taskId: createdTaskId,
        internId: 1,
        dueDate: '2026-10-15 23:59:59',
        notes: 'Initial individual milestone assignment'
      })
    });
    const validAssignData = await validAssignRes.json();
    assert(validAssignRes.status === 201 && validAssignData.success, 'Valid task assignment to Intern 1 succeeds');
    const createdAssignmentId = validAssignData.data.id;

    // 4. Duplicate active assignment prevention (Rule 5)
    const dupAssignRes = await fetch(`${baseUrl}/tasks/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        taskId: createdTaskId,
        internId: 1
      })
    });
    assert(dupAssignRes.status === 400, 'Duplicate active assignment for same intern + task must be rejected (400)');

    // 5. Cohort bulk assignment (skips existing active assignment without collision error)
    const cohortAssignRes = await fetch(`${baseUrl}/tasks/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        taskId: createdTaskId,
        cohortId: 1
      })
    });
    const cohortAssignData = await cohortAssignRes.json();
    assert(cohortAssignRes.status === 201 && cohortAssignData.data.skippedCount >= 1, 'Cohort assignment succeeds and safely skips already-assigned interns');

    // -------------------------------------------------------------
    // GATE 5: Intern Task Workspace & Ownership Isolation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Intern Task Workspace & Strict Ownership Isolation');

    // 1. Intern retrieves own tasks
    const internTasksRes = await fetch(`${baseUrl}/tasks/me`, {
      headers: { 'Authorization': `Bearer ${intern1Token}` }
    });
    const internTasksData = await internTasksRes.json();
    assert(internTasksRes.status === 200 && Array.isArray(internTasksData.data), 'Intern 1 can retrieve assigned technical deliverables');
    const internTaskIds = internTasksData.data.map(t => t.task_id);
    assert(internTaskIds.includes(createdTaskId), 'Newly assigned task appears in Intern 1 workspace');

    // 2. Ownership security: Intern 2 cannot view or manipulate Intern 1 assignment
    const intern2Tamper = await fetch(`${baseUrl}/tasks/me/assignments/${createdAssignmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern2Token}` },
      body: JSON.stringify({ status: 'in_progress' })
    });
    assert(intern2Tamper.status === 403, 'Intern 2 blocked from modifying Intern 1 task status (403 Forbidden)');

    // -------------------------------------------------------------
    // GATE 6 & 8: Submission System & Workflow State Transitions
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6 & 8: Submission Engine, Attempt Counter & Controlled Transitions');

    // 1. Intern advances status to `in_progress`
    const advanceStatusRes = await fetch(`${baseUrl}/tasks/me/assignments/${createdAssignmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({ status: 'in_progress' })
    });
    assert(advanceStatusRes.status === 200, "Intern successfully transitioned task to 'in_progress'");

    // 2. Empty submission rejected
    const emptySub = await fetch(`${baseUrl}/tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({ assignmentId: createdAssignmentId })
    });
    assert(emptySub.status === 400, 'Empty submission (no url/text/file) must be rejected with 400');

    // 3. Valid first submission (Attempt #1)
    const firstSubRes = await fetch(`${baseUrl}/tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({
        assignmentId: createdAssignmentId,
        submissionUrl: 'https://github.com/jowis-interns/david-kafka-pipeline',
        submissionText: 'Implemented Kafka consumer groups with Node.js and Docker Compose.'
      })
    });
    const firstSubData = await firstSubRes.json();
    assert(firstSubRes.status === 201 && firstSubData.data.attemptNumber === 1, 'First submission recorded with server-controlled Attempt #1');
    const createdSubmissionId = firstSubData.data.submissionId;

    // Check assignment status changed to 'submitted'
    const [subCheck] = await query('SELECT status FROM task_assignments WHERE id = ?', [createdAssignmentId]);
    assert(subCheck.status === 'submitted', "Task assignment state automatically advanced to 'submitted'");

    // -------------------------------------------------------------
    // GATE 7: Mentor Review & Supervision Scoping
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 7: Mentor Review, Scoring & Strict Scoping');

    // 1. Mentor 2 (Chioma - Lead for Track 2 / Cohort 2) attempting to review Track 1 Intern 1 MUST BE BLOCKED
    const unauthorizedReviewRes = await fetch(`${baseUrl}/tasks/submissions/${createdSubmissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mentor2Token}` },
      body: JSON.stringify({
        score: 88,
        feedback: 'Unauthorized review attempt',
        outcome: 'completed'
      })
    });
    assert(unauthorizedReviewRes.status === 403, 'Unauthorized Mentor 2 blocked from reviewing Intern 1 submission (403 Forbidden)');

    // 2. Score exceeding max_score must be rejected
    const excessScoreRes = await fetch(`${baseUrl}/tasks/submissions/${createdSubmissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mentor1Token}` },
      body: JSON.stringify({
        score: 150, // max is 100
        feedback: 'Score too high',
        outcome: 'completed'
      })
    });
    assert(excessScoreRes.status === 400, 'Score exceeding maximum permitted score must be rejected (400)');

    // 3. Mentor 1 (Sam - Authoritative Mentor) returns work for revision (Outcome: 'returned')
    const returnWorkRes = await fetch(`${baseUrl}/tasks/submissions/${createdSubmissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mentor1Token}` },
      body: JSON.stringify({
        score: 55,
        feedback: 'Good architecture, but unit tests for edge failure cases are missing. Please add failure recovery tests and resubmit.',
        outcome: 'returned'
      })
    });
    const returnWorkData = await returnWorkRes.json();
    assert(returnWorkRes.status === 200 && returnWorkData.data.status === 'returned', "Mentor returned work for revision (state -> 'returned')");

    // 4. Verify intern assignment status is now 'returned'
    const [retCheck] = await query('SELECT status FROM task_assignments WHERE id = ?', [createdAssignmentId]);
    assert(retCheck.status === 'returned', "Task assignment state reflects 'returned'");

    // 5. Intern resubmits work with revision -> Attempt #2
    const resubRes = await fetch(`${baseUrl}/tasks/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({
        assignmentId: createdAssignmentId,
        submissionUrl: 'https://github.com/jowis-interns/david-kafka-pipeline/commit/revised',
        submissionText: 'Added 12 unit tests covering broker failover and consumer restart.'
      })
    });
    const resubData = await resubRes.json();
    assert(resubRes.status === 201 && resubData.data.attemptNumber === 2, 'Resubmission incremented server attempt counter to Attempt #2');

    // 6. Mentor 1 performs final passing review (Outcome: 'completed')
    const finalReviewRes = await fetch(`${baseUrl}/tasks/submissions/${createdSubmissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mentor1Token}` },
      body: JSON.stringify({
        score: 92,
        feedback: 'Excellent failover tests! Meets enterprise reliability standards.',
        outcome: 'completed'
      })
    });
    const finalReviewData = await finalReviewRes.json();
    assert(finalReviewRes.status === 200 && finalReviewData.data.status === 'graded', 'Mentor approved deliverable with 92/100 score');

    // Verify task assignment completed
    const [compCheck] = await query('SELECT status FROM task_assignments WHERE id = ?', [createdAssignmentId]);
    assert(compCheck.status === 'completed', "Task assignment state reached final 'completed' state");

    // -------------------------------------------------------------
    // GATE 9: Training Progress Calculation Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 9: Training Progress Calculation Engine');
    const progressRes = await fetch(`${baseUrl}/tasks/progress?internId=1`, {
      headers: { 'Authorization': `Bearer ${mentor1Token}` }
    });
    const progressData = await progressRes.json();
    assert(progressRes.status === 200 && progressData.success, 'Training progress calculated successfully');
    assert(progressData.data.summary.tasksCompleted >= 1, 'Progress reflects completed tasks');
    assert(progressData.data.summary.averageScore > 0, 'Progress reflects average task scores');
    assert(Array.isArray(progressData.data.modules), 'Progress contains module-by-module breakdown');

    // -------------------------------------------------------------
    // GATE 10 & 11: Admin Operations Dashboard & Mentor Workspace
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 10 & 11: Operations Dashboard & Mentor Workspace');
    
    // Admin operations dashboard
    const opsRes = await fetch(`${baseUrl}/tasks/operations-dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const opsData = await opsRes.json();
    assert(opsRes.status === 200 && opsData.data.metrics.activeTasks >= 1, 'Admin training operations dashboard loaded metrics');

    // Mentor workspace (scoped)
    const mentorWorkRes = await fetch(`${baseUrl}/tasks/mentor-workspace`, {
      headers: { 'Authorization': `Bearer ${mentor1Token}` }
    });
    const mentorWorkData = await mentorWorkRes.json();
    assert(mentorWorkRes.status === 200 && Array.isArray(mentorWorkData.data.interns), 'Mentor workspace returned scoped supervised interns');

    // -------------------------------------------------------------
    // GATE 12: RBAC & Security Boundaries
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 12: RBAC & System Boundaries');
    
    // Intern attempting to create module
    const internCreateMod = await fetch(`${baseUrl}/training/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({ trackId: 1, title: 'Intern Rogue Module', moduleCode: 'MOD-ROGUE' })
    });
    assert(internCreateMod.status === 403, 'Intern creating module must return 403 Forbidden');

    // Intern attempting to create task
    const internCreateTask = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({ title: 'Intern Rogue Task', description: 'Should fail', trackId: 1 })
    });
    assert(internCreateTask.status === 403, 'Intern creating task must return 403 Forbidden');

    // Intern attempting to assign task
    const internAssignTask = await fetch(`${baseUrl}/tasks/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({ taskId: createdTaskId, internId: 1 })
    });
    assert(internAssignTask.status === 403, 'Intern assigning task must return 403 Forbidden');

    // Intern attempting to grade submission
    const internGradeSub = await fetch(`${baseUrl}/tasks/submissions/${createdSubmissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${intern1Token}` },
      body: JSON.stringify({ score: 100, outcome: 'completed' })
    });
    assert(internGradeSub.status === 403, 'Intern grading submission must return 403 Forbidden');

    // -------------------------------------------------------------
    // GATE 13: Audit Trail Preservation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 13: Audit Trail Preservation');
    const [modAudit] = await query("SELECT * FROM audit_logs WHERE action = 'CREATE_TRAINING_MODULE' ORDER BY id DESC LIMIT 1");
    assert(modAudit && modAudit.action === 'CREATE_TRAINING_MODULE', 'CREATE_TRAINING_MODULE action preserved in audit_logs');

    const [taskAudit] = await query("SELECT * FROM audit_logs WHERE action = 'CREATE_TASK' ORDER BY id DESC LIMIT 1");
    assert(taskAudit && taskAudit.action === 'CREATE_TASK', 'CREATE_TASK action preserved in audit_logs');

    const [assignAudit] = await query("SELECT * FROM audit_logs WHERE action = 'ASSIGN_TASK_INTERN' ORDER BY id DESC LIMIT 1");
    assert(assignAudit && assignAudit.action === 'ASSIGN_TASK_INTERN', 'ASSIGN_TASK_INTERN action preserved in audit_logs');

    const [subAudit] = await query("SELECT * FROM audit_logs WHERE action = 'SUBMIT_TASK_WORK' ORDER BY id DESC LIMIT 1");
    assert(subAudit && subAudit.action === 'SUBMIT_TASK_WORK', 'SUBMIT_TASK_WORK action preserved in audit_logs');

    const [revAudit] = await query("SELECT * FROM audit_logs WHERE action = 'REVIEW_SUBMISSION' ORDER BY id DESC LIMIT 1");
    assert(revAudit && revAudit.action === 'REVIEW_SUBMISSION', 'REVIEW_SUBMISSION action preserved in audit_logs');

    console.log('\n=======================================================');
    console.log(`🎯 ALL PHASE 3 TESTS COMPLETED: ${testPassed} PASSED, 0 FAILED.`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase3Tests();
