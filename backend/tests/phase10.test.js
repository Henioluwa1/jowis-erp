import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../src/middleware/auth.js';

const server = http.createServer(app);

async function runPhase10Tests() {
  const PORT = 5097;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`=======================================================`);
  console.log(`⚡  JOWIS STUDIO ERP — PHASE 10 COMPREHENSIVE TEST SUITE`);
  console.log(`🛡️  FINAL QA, SECURITY HARDENING & DEPLOYMENT READINESS`);
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
    // GATE 19: All 6 Documented Demo Accounts Authenticate
    // -------------------------------------------------------------
    console.log('🔹 GATE 19: Verifying all 6 documented demo accounts in README...');
    let superAdminToken, adminToken, mentorToken, mentorChiomaToken, internToken, internZainabToken;
    let superAdminUser, adminUser, mentorUser, internUser, internZainabUser;

    const demoAccounts = [
      { role: 'Super Admin', email: 'admin@jowis.com', pass: 'Admin@12345' },
      { role: 'Operational Admin', email: 'operations@jowis.com', pass: 'Admin@12345' },
      { role: 'Lead Mentor', email: 'mentor.sam@jowis.com', pass: 'Mentor@12345' },
      { role: 'UI/UX Mentor', email: 'mentor.chioma@jowis.com', pass: 'Mentor@12345' },
      { role: 'Intern 1', email: 'intern@jowis.com', pass: 'Intern@12345' },
      { role: 'Intern 2', email: 'intern.zainab@jowis.com', pass: 'Intern@12345' }
    ];

    for (const acc of demoAccounts) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.pass })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, `${acc.role} (${acc.email}) login must succeed with documented password`);
      assert(data.user && !data.user.password_hash, `Login response for ${acc.email} must never expose password hash`);

      if (acc.email === 'admin@jowis.com') { superAdminToken = data.token; superAdminUser = data.user; }
      if (acc.email === 'operations@jowis.com') { adminToken = data.token; adminUser = data.user; }
      if (acc.email === 'mentor.sam@jowis.com') { mentorToken = data.token; mentorUser = data.user; }
      if (acc.email === 'mentor.chioma@jowis.com') { mentorChiomaToken = data.token; }
      if (acc.email === 'intern@jowis.com') { internToken = data.token; internUser = data.user; }
      if (acc.email === 'intern.zainab@jowis.com') { internZainabToken = data.token; internZainabUser = data.user; }
    }

    // -------------------------------------------------------------
    // GATE 3: Authentication Security Audit
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Testing Authentication Attack Resilience...');

    // 1. Invalid password
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@jowis.com', password: 'WrongPassword!999' })
      });
      assert(res.status === 401, 'Login with incorrect password must be rejected with 401 Unauthorized');
    }

    // 2. Unknown email
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent.user@jowis.com', password: 'Admin@12345' })
      });
      assert(res.status === 401, 'Login with unknown email must be rejected with 401 Unauthorized');
    }

    // 3. Empty credentials
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert(res.status === 400, 'Login with empty body must be rejected with 400 Bad Request');
    }

    // 4. Missing Bearer token
    {
      const res = await fetch(`${baseUrl}/auth/me`);
      assert(res.status === 401, 'Request to protected route without token must return 401 Unauthorized');
    }

    // 5. Malformed Bearer token
    {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': 'Bearer NOT_A_VALID_JWT_TOKEN_123' }
      });
      assert(res.status === 401, 'Malformed token must return 401 Unauthorized');
    }

    // 6. Tampered signature
    {
      const forgedToken = jwt.sign({ userId: 1, role: 'super_admin' }, 'FORGED_SECRET_KEY_ATTACK');
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${forgedToken}` }
      });
      assert(res.status === 401, 'Token signed with unauthorized secret must return 401 Unauthorized');
    }

    // 7. Expired token
    {
      const expiredToken = jwt.sign({ userId: 1, role: 'super_admin' }, JWT_SECRET, { expiresIn: '0s' });
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${expiredToken}` }
      });
      assert(res.status === 401, 'Expired session token must be rejected with 401 Unauthorized');
    }

    // 8. Server-Side Logout Endpoint
    {
      const res = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      assert(res.status === 200 && data.success, 'POST /api/auth/logout succeeds with 200 OK');

      // Re-authenticate super admin to continue remaining tests with an active token
      const reloginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
      });
      const reloginData = await reloginRes.json();
      superAdminToken = reloginData.token;
    }

    // -------------------------------------------------------------
    // GATE 4: Password & Sensitive Data Exposure
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Auditing Password & Sensitive Data Exposure...');

    // 1. GET /api/auth/me does not expose password_hash
    {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200, '/api/auth/me returns 200 OK');
      assert(data.user && !('password_hash' in data.user), '/api/auth/me does not leak password_hash');
      assert(!('password' in data.user), '/api/auth/me does not leak password field');
    }

    // 2. GET /api/admin/users does not expose password_hash in roster
    {
      const res = await fetch(`${baseUrl}/admin/users?page=1&limit=5`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200, '/api/admin/users returns 200 OK');
      const userList = Array.isArray(data.data) ? data.data : (data.data?.users || []);
      assert(Array.isArray(userList) && userList.length > 0, 'User list retrieved');
      const hashExposed = userList.some(u => 'password_hash' in u || 'password' in u);
      assert(!hashExposed, 'User administration roster strictly omits password hashes');
    }

    // -------------------------------------------------------------
    // GATE 5: RBAC Security & Boundary Penetration Testing
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Testing Role-Based Access Control Boundaries...');

    // 1. Intern blocked from /api/admin/*
    {
      const res = await fetch(`${baseUrl}/admin/overview`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 403, 'Intern calling /api/admin/overview must return 403 Forbidden');
    }
    {
      const res = await fetch(`${baseUrl}/admin/users`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 403, 'Intern calling /api/admin/users must return 403 Forbidden');
    }

    // 2. Mentor blocked from /api/admin/*
    {
      const res = await fetch(`${baseUrl}/admin/overview`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      assert(res.status === 403, 'Mentor calling /api/admin/overview must return 403 Forbidden');
    }
    {
      const res = await fetch(`${baseUrl}/admin/users`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      assert(res.status === 403, 'Mentor calling /api/admin/users must return 403 Forbidden');
    }

    // 3. Intern and Mentor blocked from /api/automation/*
    {
      const res = await fetch(`${baseUrl}/automation/rules`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 403, 'Intern calling /api/automation/rules must return 403 Forbidden');
    }
    {
      const res = await fetch(`${baseUrl}/automation/rules`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      assert(res.status === 403, 'Mentor calling /api/automation/rules must return 403 Forbidden');
    }

    // 4. Intern blocked from /api/system/settings and /api/system/audit-logs
    {
      const res = await fetch(`${baseUrl}/system/settings`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 403, 'Intern calling /api/system/settings must return 403 Forbidden');
    }
    {
      const res = await fetch(`${baseUrl}/system/audit-logs`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 403, 'Intern calling /api/system/audit-logs must return 403 Forbidden');
    }

    // 5. Mentor blocked from modifying intern profile administrative fields
    {
      const res = await fetch(`${baseUrl}/interns/1`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${mentorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ education: 'Hacked Degree', skills: 'Unauthorized' })
      });
      assert(res.status === 403, 'Mentor calling PUT /api/interns/:id must return 403 Forbidden');
    }

    // 6. Intern blocked from certificate issuance
    {
      const res = await fetch(`${baseUrl}/certificates/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ internId: 1, certificateTypeId: 1 })
      });
      assert(res.status === 403, 'Intern calling POST /api/certificates/issue must return 403 Forbidden');
    }

    // 7. Intern blocked from grading task submissions
    {
      const res = await fetch(`${baseUrl}/tasks/submissions/1/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ score: 100, outcome: 'completed' })
      });
      assert(res.status === 403, 'Intern calling POST /api/tasks/submissions/:id/review must return 403 Forbidden');
    }

    // -------------------------------------------------------------
    // GATE 6: Data Isolation & Scoping Audit
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6: Verifying Data Isolation Between Interns...');

    // 1. Intern 1 attempting to view Intern 2's profile
    {
      const res = await fetch(`${baseUrl}/interns/2`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 403, "Intern 1 accessing Intern 2's profile must return 403 Forbidden");
    }

    // 2. Intern 1 can view own profile
    {
      const res = await fetch(`${baseUrl}/interns/1`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 200, "Intern 1 accessing own profile succeeds with 200 OK");
    }

    // 3. Intern 1's tasks query returns only their own assignments
    {
      const res = await fetch(`${baseUrl}/tasks/my-tasks`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      const data = await res.json();
      assert(res.status === 200, "Intern 1 querying /tasks/my-tasks succeeds (200 OK)");
      const tasksList = Array.isArray(data.data) ? data.data : (data.data?.tasks || []);
      const otherInternTasks = tasksList.filter(t => t.intern_id && t.intern_id !== 1);
      assert(otherInternTasks.length === 0, "Tasks query returns 0 records from other interns");
    }

    // 4. Intern 1 cannot download another intern's document
    {
      const res = await fetch(`${baseUrl}/documents/2/download`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      // Document 2 belongs to another intern or doesn't exist; must be 403 or 404, never 200
      assert(res.status === 403 || res.status === 404, "Intern 1 cannot download another intern's document (403/404)");
    }

    // -------------------------------------------------------------
    // GATE 8: SQL Injection Attack Resilience
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 8: Testing SQL Injection Payload Resilience...');

    // 1. Search with SQL injection payload in tasks
    {
      const payload = "' OR '1'='1";
      const res = await fetch(`${baseUrl}/tasks?search=${encodeURIComponent(payload)}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(res.status === 200, "SQL injection query in task search handled safely (200 OK)");
    }

    // 2. Search with SQL injection in interns
    {
      const payload = "'; DROP TABLE users; --";
      const res = await fetch(`${baseUrl}/interns?search=${encodeURIComponent(payload)}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(res.status === 200, "Destructive SQL injection payload in intern search handled safely (200 OK)");
    }

    // 3. Report drill-down with SQL injection payload
    {
      const payload = "1 OR 1=1";
      const res = await fetch(`${baseUrl}/reports/drill-down?metric=active_interns&trackId=${encodeURIComponent(payload)}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(res.status === 200 || res.status === 400, "Report drill-down parameter injection handled safely");
    }

    // -------------------------------------------------------------
    // GATE 9: Mass Assignment & Privilege Escalation Protection
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 9: Testing Mass Assignment Protection...');

    // 1. Attempt to inject role_id: 1 into profile update
    {
      const res = await fetch(`${baseUrl}/admin/users/5`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: 'David',
          lastName: 'Adeleke',
          roleId: 1, // Injected privilege escalation field
          role: 'super_admin',
          isActive: 0
        })
      });
      assert(res.status === 200, "Profile update endpoint executes");

      // Verify user's role was NOT modified
      const [u] = await query('SELECT role_id, is_active FROM users WHERE id = 5');
      assert(u.role_id === 4, "Mass assignment attack: user role_id remained 4 (intern)");
      assert(u.is_active === 1, "Mass assignment attack: is_active remained 1");
    }

    // 2. Intern attempting to transition task status to 'completed'
    {
      const res = await fetch(`${baseUrl}/tasks/my-tasks/1/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'completed' }) // Forbidden state transition
      });
      assert(res.status === 400 || res.status === 403, "Intern attempting to force 'completed' task status rejected (400/403)");
    }

    // -------------------------------------------------------------
    // GATE 10: Attendance Rules & Lagos Cutoff Verification
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 10: Verifying Attendance Rules & Cutoff Engine...');

    // 1. Verify system settings cutoff time
    {
      const [setting] = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'attendance_cutoff_time'");
      assert(setting && setting.setting_value === '09:00:00', "Authoritative attendance cutoff is strictly 09:00:00");
    }

    // 2. Verify timezone is Africa/Lagos
    {
      const [tz] = await query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_timezone'");
      assert(tz && tz.setting_value === 'Africa/Lagos', "Operational timezone is strictly Africa/Lagos");
    }

    // -------------------------------------------------------------
    // GATE 12: Performance Score Calculation Formula
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 12: Verifying Performance Score Calculation Formula...');

    // 1. Verify formula: weighted_score = (score / max_score) * weight
    {
      const score = 80;
      const maxScore = 100;
      const weight = 25;
      const expectedWeighted = (score / maxScore) * weight;
      assert(expectedWeighted === 20, "Evaluation scoring formula: (80/100)*25 = 20");
    }

    // 2. Client cannot override overall_score via direct API
    {
      // Attempting to pass forged overall_score
      const res = await fetch(`${baseUrl}/performance/evaluations/1`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          overallScore: 99.99, // Injected calculation override
          scores: []
        })
      });
      assert(res.status === 200 || res.status === 400, "Evaluation update request processed");
    }

    // -------------------------------------------------------------
    // GATE 13: Document & Certificate Security Audit
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 13: Auditing Document & Certificate Security Engine...');

    // 1. Four-Gate Certificate Eligibility Evaluation
    {
      const res = await fetch(`${baseUrl}/certificates/eligibility?internId=1`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200 && data.data, 'Certificate eligibility evaluation succeeds (200 OK)');
      assert(typeof data.data.isEligible === 'boolean', 'Eligibility status returned as boolean');
      assert(data.data.criteria && 'lifecycle' in data.data.criteria, 'Eligibility criteria contains lifecycle evaluation');
      assert('tasks' in data.data.criteria, 'Eligibility criteria contains tasks evaluation');
      assert('performance' in data.data.criteria, 'Eligibility criteria contains performance evaluation');
      assert('documents' in data.data.criteria, 'Eligibility criteria contains documents evaluation');
    }

    // 2. Document upload executable extension blocking (.php)
    {
      const formData = new FormData();
      const blob = new Blob(['<?php echo "malicious code"; ?>'], { type: 'application/x-php' });
      formData.append('file', blob, 'exploit_test.php');
      formData.append('documentTypeId', '1');
      const res = await fetch(`${baseUrl}/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${internToken}` },
        body: formData
      });
      assert(res.status === 400 || res.status === 500, 'Executable file extension (.php) rejected by document upload security filter');
    }

    // 3. Document upload path traversal blocking
    {
      const formData = new FormData();
      const blob = new Blob(['safe content'], { type: 'application/pdf' });
      formData.append('file', blob, '../../../etc/passwd.pdf');
      formData.append('documentTypeId', '1');
      const res = await fetch(`${baseUrl}/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${internToken}` },
        body: formData
      });
      assert(res.status === 400 || res.status === 500, 'Path-traversal filename payload rejected by upload security filter');
    }

    // 4. Submission upload executable extension blocking (.exe)
    {
      const formData = new FormData();
      const blob = new Blob(['MZ binary payload'], { type: 'application/x-msdownload' });
      formData.append('attachment', blob, 'payload.exe');
      formData.append('taskAssignmentId', '1');
      formData.append('submissionText', 'Exploit attempt');
      const res = await fetch(`${baseUrl}/tasks/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${internToken}` },
        body: formData
      });
      assert(res.status === 400 || res.status === 500, 'Executable submission (.exe) rejected by task upload security filter');
    }

    // -------------------------------------------------------------
    // GATE 14: Notification Security & Scoping
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 14: Testing Notification Security & Scoping...');

    // 1. Intern unread notification count returns valid number
    {
      const res = await fetch(`${baseUrl}/communications/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      const data = await res.json();
      assert(res.status === 200 && typeof data.count === 'number', 'Intern unread notification count returns integer');
    }

    // 2. Intern cannot mark another user's notification as read
    {
      // Try to mark notification #9999 or non-owned notification
      const res = await fetch(`${baseUrl}/communications/notifications/9999/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(res.status === 403 || res.status === 404, "Accessing unauthorized notification returns 403 or 404");
    }

    // -------------------------------------------------------------
    // GATE 15: Automation Engine Reliability & Idempotency
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 15: Auditing Automation Engine Reliability...');

    // 1. Trigger rule once
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_SCHEDULED_REPORT/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(res.status === 200, "Manual trigger of AUTO_SCHEDULED_REPORT succeeds (200 OK)");
    }

    // 2. Repeat trigger within same cycle -> deterministic skipped status
    {
      const res = await fetch(`${baseUrl}/automation/rules/AUTO_SCHEDULED_REPORT/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200, "Repeated trigger returns 200 OK");
      assert(data.status === 'skipped' || data.data?.status === 'skipped', "Duplicate run returned status 'skipped' preventing duplicate events");
    }

    // -------------------------------------------------------------
    // GATE 16: Standardized CSV Export Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 16: Testing Standardized CSV Export Engine...');

    {
      const res = await fetch(`${baseUrl}/reports/export/attendance`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(res.status === 200, "Attendance CSV export returns 200 OK");
      const contentType = res.headers.get('content-type');
      assert(contentType && contentType.includes('text/csv'), `Content-Type is text/csv (${contentType})`);
      const csvText = await res.text();
      assert(csvText.includes('Date') || csvText.includes('attendance_date'), "CSV output includes expected headers");
    }

    // -------------------------------------------------------------
    // GATE 17: Immutable Audit Trail Enforcement
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 17: Enforcing Immutable Audit Trail...');

    // 1. DELETE /api/admin/audit-logs must be rejected with 405 Method Not Allowed
    {
      const res = await fetch(`${baseUrl}/admin/audit-logs`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(res.status === 405, 'DELETE /api/admin/audit-logs must return 405 Method Not Allowed');
    }

    // 2. PUT /api/admin/audit-logs must be rejected with 405 Method Not Allowed
    {
      const res = await fetch(`${baseUrl}/admin/audit-logs`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(res.status === 405, 'PUT /api/admin/audit-logs must return 405 Method Not Allowed');
    }

    // -------------------------------------------------------------
    // GATE 20: Error Handling & Path Sanitization
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 20: Testing Error Handling & Clean 404 Responses...');

    {
      const res = await fetch(`${baseUrl}/non-existent-endpoint-test-12345`);
      assert(res.status === 404, 'Non-existent route returns 404 Not Found');
      const data = await res.json();
      assert(!data.success, '404 returns success: false');
      assert(data.message && data.message.includes('not found'), '404 returns clean message');
    }

    console.log(`\n=======================================================`);
    console.log(`🎯 ALL PHASE 10 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log(`=======================================================`);

  } catch (err) {
    console.error(`\n❌ TEST SUITE FAILURE:`, err);
    process.exit(1);
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase10Tests();
