import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runPhase9Tests() {
  const PORT = 5096;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`=======================================================`);
  console.log(`⚡  JOWIS STUDIO ERP — PHASE 9 AUTOMATED TEST SUITE`);
  console.log(`🤖  ADVANCED ERP & AUTOMATION ORCHESTRATION ENGINE`);
  console.log(`🧪 Test server running on http://localhost:${PORT}`);
  console.log(`=======================================================\n`);

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
    // SETUP & GATE 19: Authenticate Users Across All Demo Roles
    // -------------------------------------------------------------
    console.log('🔹 SETUP & GATE 19: Authenticating demo credentials across all 4 roles...');
    let superAdminToken, adminToken, mentorToken, internToken;
    let superAdminId, adminId, mentorId, internId;

    {
      // 1. Super Admin
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Super Admin login must succeed with Admin@12345');
      superAdminToken = data.token;
      superAdminId = data.user.id;
    }

    {
      // 2. Operational Admin
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'operations@jowis.com', password: 'Admin@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Operational Admin login must succeed with Admin@12345');
      adminToken = data.token;
      adminId = data.user.id;
    }

    {
      // 3. Lead Mentor (Samuel Adeyemi)
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mentor.sam@jowis.com', password: 'Mentor@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Lead Mentor login must succeed with Mentor@12345');
      mentorToken = data.token;
      mentorId = data.user.id;
    }

    {
      // 4. Intern (David Adeleke)
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Intern login must succeed with Intern@12345');
      internToken = data.token;
      internId = data.user.id;
    }

    // -------------------------------------------------------------
    // GATE 1 & 2: Relational Schema & Automation Data Model
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1 & 2: Relational Schema & Automation Data Model...');
    {
      const tables = await query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME IN ('automation_rules', 'automation_executions')
      `);
      const tableNames = tables.map(t => t.TABLE_NAME.toLowerCase());
      assert(tableNames.includes('automation_rules'), 'Table `automation_rules` exists in database');
      assert(tableNames.includes('automation_executions'), 'Table `automation_executions` exists in database');

      // Check columns in automation_rules
      const ruleCols = await query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_rules'
      `);
      const ruleColNames = ruleCols.map(c => c.COLUMN_NAME.toLowerCase());
      assert(ruleColNames.includes('rule_code'), 'automation_rules has `rule_code` column');
      assert(ruleColNames.includes('action_type'), 'automation_rules has `action_type` column');
      assert(ruleColNames.includes('schedule_interval'), 'automation_rules has `schedule_interval` column');
      assert(ruleColNames.includes('config'), 'automation_rules has `config` JSON column');
      assert(ruleColNames.includes('is_enabled'), 'automation_rules has `is_enabled` column');

      // Check columns in automation_executions
      const execCols = await query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automation_executions'
      `);
      const execColNames = execCols.map(c => c.COLUMN_NAME.toLowerCase());
      assert(execColNames.includes('idempotency_key'), 'automation_executions has `idempotency_key` column');
      assert(execColNames.includes('status'), 'automation_executions has `status` column');
      assert(execColNames.includes('retry_count'), 'automation_executions has `retry_count` column');
      assert(execColNames.includes('max_retries'), 'automation_executions has `max_retries` column');
      assert(execColNames.includes('affected_count'), 'automation_executions has `affected_count` column');
    }

    // -------------------------------------------------------------
    // GATE 3: Automation Configuration API
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Automation Configuration API...');
    let sampleRuleId;
    {
      const res = await fetch(`${baseUrl}/automation/rules`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200, 'Super Admin can list automation rules (200 OK)');
      assert(Array.isArray(data.data) && data.data.length >= 9, 'At least 9 canonical automation rules returned');

      const attendanceRule = data.data.find(r => r.rule_code === 'AUTO_ATTENDANCE_CLOSE');
      assert(attendanceRule !== undefined, 'Canonical rule AUTO_ATTENDANCE_CLOSE found');
      assert(typeof attendanceRule.config === 'object', 'Rule config is parsed as JSON object');
      sampleRuleId = attendanceRule.id;

      // Single rule retrieval
      const singleRes = await fetch(`${baseUrl}/automation/rules/${sampleRuleId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const singleData = await singleRes.json();
      assert(singleRes.status === 200, 'Can retrieve single rule details with recent executions');
      assert(singleData.data.rule_code === 'AUTO_ATTENDANCE_CLOSE', 'Retrieved correct rule code');

      // Update rule configuration
      const updateRes = await fetch(`${baseUrl}/automation/rules/${sampleRuleId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: 'Updated description for attendance closure automation',
          schedule_interval: 'daily'
        })
      });
      const updateData = await updateRes.json();
      assert(updateRes.status === 200, 'Super Admin can update rule configuration (200 OK)');

      // Toggle rule status (enable/disable)
      const toggleRes = await fetch(`${baseUrl}/automation/rules/${sampleRuleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const toggleData = await toggleRes.json();
      assert(toggleRes.status === 200, 'Can toggle rule status');

      // Toggle back to active
      await fetch(`${baseUrl}/automation/rules/${sampleRuleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
    }

    // -------------------------------------------------------------
    // GATE 4: Automated Attendance Processing
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Automated Attendance Processing Engine...');
    {
      // Non-working day validation: Weekend date (2026-09-20 is Sunday)
      const resWeekend = await fetch(`${baseUrl}/automation/rules/AUTO_ATTENDANCE_CLOSE/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true, targetDate: '2026-09-20' })
      });
      const dataWeekend = await resWeekend.json();
      assert(resWeekend.status === 200, 'Non-working day attendance closure request handled safely');
      assert(dataWeekend.data.affectedCount === 0, 'Zero attendance records created on non-working day');

      // Working day execution (2026-09-18 is Friday)
      const resFriday = await fetch(`${baseUrl}/automation/rules/AUTO_ATTENDANCE_CLOSE/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true, targetDate: '2026-09-18' })
      });
      const dataFriday = await resFriday.json();
      assert(resFriday.status === 200, 'Working day attendance closure succeeds (200 OK)');
      assert(dataFriday.data.status === 'completed', 'Execution status is `completed`');
    }

    // -------------------------------------------------------------
    // GATE 5: Automated Overdue Task Detection
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Automated Overdue Task Detection...');
    {
      // Create past-due assignment for testing
      const pastDueDate = '2026-08-01 12:00:00';
      await query(`
        UPDATE task_assignments 
        SET due_date = ?, status = 'assigned' 
        WHERE id = 1
      `, [pastDueDate]);

      const res = await fetch(`${baseUrl}/automation/rules/AUTO_OVERDUE_TASKS/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      assert(res.status === 200, 'Overdue task automation executed (200 OK)');
      assert(data.data.status === 'completed', 'Overdue task scan completed');

      // Verify task assignment status updated to 'overdue'
      const [updatedTa] = await query(`SELECT status FROM task_assignments WHERE id = 1`);
      assert(updatedTa.status === 'overdue', 'Past-due task assignment transitioned to `overdue`');
    }

    // -------------------------------------------------------------
    // GATE 6: Training & Progress Automation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6: Training & Progress Auto-Propagation...');
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_TRAINING_PROGRESS/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      assert(res.status === 200, 'Training progress automation executed (200 OK)');
      assert(data.data.status === 'completed', 'Training progress scan completed without errors');
    }

    // -------------------------------------------------------------
    // GATE 7: Performance-Cycle Automation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 7: Performance-Cycle Reminders & Score Protection...');
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_PERF_REMINDERS/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      assert(res.status === 200, 'Performance reminder automation executed (200 OK)');
      assert(data.data.status === 'completed', 'Performance cycle scan completed');

      // Assert no score fabrication occurred
      const [unfinalizedScore] = await query(`
        SELECT COUNT(*) as count 
        FROM performance_evaluations 
        WHERE status = 'draft' AND overall_score IS NOT NULL
      `);
      assert(unfinalizedScore.count === 0, 'No performance scores were fabricated for draft evaluations');
    }

    // -------------------------------------------------------------
    // GATE 8: Document Expiry Automation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 8: Document Expiry Monitoring & Status Transition...');
    {
      // Create expired document test record
      const [doc] = await query(`SELECT id FROM intern_documents LIMIT 1`);
      if (doc) {
        await query(`UPDATE intern_documents SET expiry_date = '2026-08-10', status = 'verified' WHERE id = ?`, [doc.id]);

        const res = await fetch(`${baseUrl}/automation/rules/AUTO_DOC_EXPIRY/run`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${superAdminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ force: true })
        });
        const data = await res.json();
        assert(res.status === 200, 'Document expiry automation executed (200 OK)');

        // Check document status is now 'expired'
        const [updatedDoc] = await query(`SELECT status FROM intern_documents WHERE id = ?`, [doc.id]);
        assert(updatedDoc.status === 'expired', 'Past-due document transitioned to `expired` status');
      }
    }

    // -------------------------------------------------------------
    // GATE 9: 4-Gate Certificate Eligibility Automation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 9: 4-Gate Certificate Qualification Scanner...');
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_CERT_ELIGIBILITY/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      assert(res.status === 200, 'Certificate eligibility automation executed (200 OK)');
      assert(data.data.status === 'completed', '4-Gate eligibility scan completed');
      assert(data.data.details && Array.isArray(data.data.details.eligibleList), 'Returns structured eligible list');
    }

    // -------------------------------------------------------------
    // GATE 10: Automated Communication Triggers
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 10: Automated Notification Dispatch Verification...');
    {
      // Verify notifications table contains automated notifications
      const notifs = await query(`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE type IN ('attendance', 'task', 'document', 'certificate', 'system')
      `);
      assert(notifs[0].count > 0, 'Automated in-app notifications persisted in notifications table');
    }

    // -------------------------------------------------------------
    // GATE 11: Cohort Lifecycle Automation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 11: Cohort Lifecycle Automation...');
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_COHORT_LIFECYCLE/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      assert(res.status === 200, 'Cohort lifecycle automation executed (200 OK)');
      assert(data.data.status === 'completed', 'Cohort lifecycle scan completed');
    }

    // -------------------------------------------------------------
    // GATE 12: Mentor Operational Automation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 12: Mentor Workload & Backlog Escalation...');
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_MENTOR_WORKLOAD/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      assert(res.status === 200, 'Mentor workload automation executed (200 OK)');
      assert(data.data.status === 'completed', 'Mentor workload scan completed');
    }

    // -------------------------------------------------------------
    // GATE 13: Scheduled Report Automation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 13: Scheduled Report Automation Snapshot...');
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_SCHEDULED_REPORT/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      assert(res.status === 200, 'Scheduled report automation executed (200 OK)');
      assert(data.data.details.users !== undefined, 'Snapshot contains users summary');
      assert(data.data.details.attendanceToday !== undefined, 'Snapshot contains attendance today summary');
    }

    // -------------------------------------------------------------
    // GATE 14: Dashboard Operational Alerts Feed
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 14: Dashboard Operational Alerts Feed...');
    {
      const res = await fetch(`${baseUrl}/automation/alerts`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200, 'Can retrieve operational alerts feed (200 OK)');
      assert(Array.isArray(data.data), 'Alerts returned as array');

      // Mentor view of alerts
      const mentorRes = await fetch(`${baseUrl}/automation/alerts`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      const mentorData = await mentorRes.json();
      assert(mentorRes.status === 200, 'Mentor can retrieve scoped operational alerts');
    }

    // -------------------------------------------------------------
    // GATE 15: Execution History & Traceability
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 15: Master Execution History & Details...');
    let lastExecId;
    {
      const res = await fetch(`${baseUrl}/automation/executions?page=1&limit=10`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200, 'Can retrieve paginated execution history (200 OK)');
      assert(Array.isArray(data.data) && data.data.length > 0, 'Executions list returned');
      assert(data.pagination && data.pagination.total > 0, 'Pagination metadata is populated');
      lastExecId = data.data[0].id;

      // Execution drill-down inspection
      const detailRes = await fetch(`${baseUrl}/automation/executions/${lastExecId}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const detailData = await detailRes.json();
      assert(detailRes.status === 200, 'Can retrieve single execution details modal view');
      assert(detailData.data.idempotency_key !== undefined, 'Execution details contains idempotency_key');
    }

    // -------------------------------------------------------------
    // GATE 16: Bounded Retry & Failure Handling
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 16: Bounded Retry & Failure Handling...');
    {
      // Create mock failed execution
      const failResult = await query(`
        INSERT INTO automation_executions 
        (rule_id, rule_code, trigger_type, idempotency_key, status, start_time, retry_count, max_retries, error_message, executed_by)
        VALUES (?, 'AUTO_OVERDUE_TASKS', 'manual', 'test-failed-key-1', 'failed', NOW(), 0, 3, 'Simulated timeout error', ?)
      `, [sampleRuleId, superAdminId]);
      const failedExecId = failResult.insertId;

      // Retry execution
      const retryRes = await fetch(`${baseUrl}/automation/executions/${failedExecId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const retryData = await retryRes.json();
      assert(retryRes.status === 200, 'Can retry failed execution');
      assert(retryData.data.retryCount === 1, 'Retry count incremented to 1');

      // Exceed max retries
      await query(`UPDATE automation_executions SET retry_count = 3, max_retries = 3, status = 'failed' WHERE id = ?`, [failedExecId]);
      const exceedRes = await fetch(`${baseUrl}/automation/executions/${failedExecId}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(exceedRes.status === 400, 'Exceeding max retries is rejected with 400 Bad Request');
    }

    // -------------------------------------------------------------
    // GATE 17: Idempotency & Duplicate Protection
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 17: Idempotency & Duplicate Protection Engine...');
    {
      // Run AUTO_SCHEDULED_REPORT without force flag
      // First run succeeds (or was already run)
      const res1 = await fetch(`${baseUrl}/automation/rules/AUTO_SCHEDULED_REPORT/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: false })
      });
      const data1 = await res1.json();
      assert(res1.status === 200, 'First execution request handled');

      // Immediate second run without force must be skipped by idempotency
      const res2 = await fetch(`${baseUrl}/automation/rules/AUTO_SCHEDULED_REPORT/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force: false })
      });
      const data2 = await res2.json();
      assert(res2.status === 200, 'Duplicate run returns 200 OK');
      assert(data2.data.status === 'skipped', 'Deterministic Idempotency: second run skipped to prevent duplicate events');
    }

    // -------------------------------------------------------------
    // GATE 18: Security & RBAC Scope Penetration Testing
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 18: Direct API Security & RBAC Scope Penetration Testing...');
    {
      // 1. Missing Token
      const noTokenRes = await fetch(`${baseUrl}/automation/rules`);
      assert(noTokenRes.status === 401, 'Request without token returns 401 Unauthorized');

      // 2. Forged Token
      const forgedRes = await fetch(`${baseUrl}/automation/rules`, {
        headers: { 'Authorization': 'Bearer invalid.forged.jwt.token' }
      });
      assert(forgedRes.status === 401, 'Request with forged token returns 401 Unauthorized');

      // 3. Intern calling automation rules (Forbidden)
      const internRulesRes = await fetch(`${baseUrl}/automation/rules`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(internRulesRes.status === 403, 'Intern calling /automation/rules returns 403 Forbidden');

      // 4. Intern calling trigger manual (Forbidden)
      const internTriggerRes = await fetch(`${baseUrl}/automation/rules/AUTO_ATTENDANCE_CLOSE/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(internTriggerRes.status === 403, 'Intern triggering automation returns 403 Forbidden');

      // 5. Mentor calling automation rules (Forbidden)
      const mentorRulesRes = await fetch(`${baseUrl}/automation/rules`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      assert(mentorRulesRes.status === 403, 'Mentor calling /automation/rules returns 403 Forbidden');

      // 6. Mentor calling executions (Forbidden)
      const mentorExecRes = await fetch(`${baseUrl}/automation/executions`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      assert(mentorExecRes.status === 403, 'Mentor calling /automation/executions returns 403 Forbidden');
    }

    // -------------------------------------------------------------
    // GATE 20: Full Regression Validation (Phases 1-8 Endpoints)
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 20: Regression Validation (Phases 1-8 Endpoints)...');
    {
      // Phase 1: Health
      const healthRes = await fetch(`${baseUrl}/health`);
      assert(healthRes.status === 200, 'Phase 1: /api/health returns 200 OK');

      // Phase 2: Interns
      const internsRes = await fetch(`${baseUrl}/interns`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(internsRes.status === 200, 'Phase 2: /api/interns returns 200 OK');

      // Phase 3: Tasks
      const tasksRes = await fetch(`${baseUrl}/tasks`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(tasksRes.status === 200, 'Phase 3: /api/tasks returns 200 OK');

      // Phase 4: Performance Overview
      const perfRes = await fetch(`${baseUrl}/performance/overview`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(perfRes.status === 200, 'Phase 4: /api/performance/overview returns 200 OK');

      // Phase 5: Executive Reports
      const reportsRes = await fetch(`${baseUrl}/reports/executive`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(reportsRes.status === 200, 'Phase 5: /api/reports/executive returns 200 OK');

      // Phase 6: Documents & Certificates
      const docsRes = await fetch(`${baseUrl}/documents/types`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(docsRes.status === 200, 'Phase 6: /api/documents/types returns 200 OK');

      const certsRes = await fetch(`${baseUrl}/certificates/types`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(certsRes.status === 200, 'Phase 6: /api/certificates/types returns 200 OK');

      // Phase 7: Announcements & Communications
      const annRes = await fetch(`${baseUrl}/communications/announcements`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(annRes.status === 200, 'Phase 7: /api/communications/announcements returns 200 OK');

      // Phase 8: Administration Overview
      const adminOverviewRes = await fetch(`${baseUrl}/admin/overview`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(adminOverviewRes.status === 200, 'Phase 8: /api/admin/overview returns 200 OK');
    }

    console.log(`\n=======================================================`);
    console.log(`🎯 ALL PHASE 9 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log(`=======================================================\n`);
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase9Tests();
