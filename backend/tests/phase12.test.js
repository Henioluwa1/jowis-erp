import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';
import bcrypt from 'bcryptjs';
import { generateSecureTemporaryPassword, validatePasswordPolicy } from '../src/utils/passwordGenerator.js';

const server = http.createServer(app);

async function runPhase12Tests() {
  const PORT = 5099;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`================================================================`);
  console.log(`⚡  JOWIS STUDIO ERP — PHASE 12 AUTOMATED COMPREHENSIVE SUITE`);
  console.log(`🔐  USER PROVISIONING, TEMPORARY CREDENTIALS & GLOBAL EXPORTS`);
  console.log(`🧪 Test server running on http://localhost:${PORT}`);
  console.log(`================================================================\n`);

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
    // Helper: Login and get token
    // -------------------------------------------------------------
    async function loginUser(email, password) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return { status: res.status, data };
    }

    // -------------------------------------------------------------
    // SECTION 1: PASSWORD GENERATOR & POLICY VALIDATOR UNIT TESTS
    // -------------------------------------------------------------
    console.log('🔹 SECTION 1: Password Generator & Policy Validator...');
    {
      const pwd = generateSecureTemporaryPassword(14);
      assert(pwd.length === 14, 'Generated password has requested length of 14');
      assert(/[A-Z]/.test(pwd), 'Generated password contains uppercase letter');
      assert(/[a-z]/.test(pwd), 'Generated password contains lowercase letter');
      assert(/[0-9]/.test(pwd), 'Generated password contains number');
      assert(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pwd), 'Generated password contains special character');

      const weakCheck1 = validatePasswordPolicy('short1!');
      assert(!weakCheck1.valid, 'Policy rejects password under 8 characters');

      const weakCheck2 = validatePasswordPolicy('nocapitals123!');
      assert(!weakCheck2.valid, 'Policy rejects password without uppercase');

      const weakCheck3 = validatePasswordPolicy('NOLOWERCASE123!');
      assert(!weakCheck3.valid, 'Policy rejects password without lowercase');

      const weakCheck4 = validatePasswordPolicy('NoSpecialChar123');
      assert(!weakCheck4.valid, 'Policy rejects password without special character');

      const weakCheck5 = validatePasswordPolicy('NoNumberHere!@#');
      assert(!weakCheck5.valid, 'Policy rejects password without number');

      const strongCheck = validatePasswordPolicy('Secure@P4ssw0rd!');
      assert(strongCheck.valid, 'Policy accepts compliant strong password');
    }

    // -------------------------------------------------------------
    // SECTION 2: SUPER ADMIN AUTHENTICATION
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 2: Super Admin Authentication...');
    let superAdminToken = '';
    {
      const res = await loginUser('admin@jowis.com', 'Admin@12345');
      assert(res.status === 200, 'Super admin login returns 200 OK');
      assert(Boolean(res.data.token), 'Super admin token received');
      assert(res.data.user?.role === 'super_admin', 'Role is super_admin');
      assert(res.data.mustChangePassword === false, 'Super admin seed has mustChangePassword = false');
      superAdminToken = res.data.token;
    }

    // -------------------------------------------------------------
    // SECTION 3: USER ACCOUNT PROVISIONING & TEMPORARY CREDENTIALS
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 3: User Provisioning with Secure Temporary Password...');
    const testMentorEmail = `test.mentor.${Date.now()}@jowis.com`;
    let tempMentorPassword = '';
    let createdMentorId = null;

    {
      const res = await fetch(`${baseUrl}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          firstName: 'Automated',
          lastName: 'Mentor',
          email: testMentorEmail,
          roleName: 'mentor',
          phone: '+2348001112222'
        })
      });

      assert(res.status === 201, 'POST /api/admin/users returns 201 Created');
      const body = await res.json();
      assert(body.success === true, 'Response indicates success');
      assert(body.data?.user?.email === testMentorEmail, 'User email matches requested identifier');
      assert(Boolean(body.data?.temporaryPassword), 'Temporary password returned to administrator');
      assert(body.data?.user?.mustChangePassword === true, 'Response flags mustChangePassword = true');

      tempMentorPassword = body.data.temporaryPassword;
      createdMentorId = body.data.user.id;

      // Verify DB state: password must NOT be stored in plaintext
      const [dbUser] = await query('SELECT password_hash, must_change_password FROM users WHERE id = ?', [createdMentorId]);
      assert(dbUser.password_hash !== tempMentorPassword, 'Password is NOT stored in plaintext in database');
      assert(dbUser.password_hash.startsWith('$2'), 'Password hash is valid bcrypt hash');
      assert(dbUser.must_change_password === 1, 'Database flags must_change_password = 1');

      // Verify audit log has no plaintext password
      const [auditLog] = await query(
        "SELECT new_value FROM audit_logs WHERE action = 'CREATE_USER' AND entity_id = ? ORDER BY id DESC LIMIT 1",
        [createdMentorId]
      );
      assert(auditLog && !auditLog.new_value.includes(tempMentorPassword), 'Audit log NEVER contains temporary password');
    }

    // -------------------------------------------------------------
    // SECTION 4: FIRST-LOGIN AUTHENTICATION & API ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 4: First-Login State & API Access Barrier...');
    let tempMentorToken = '';
    {
      // 1. Authenticate with temporary credentials
      const loginRes = await loginUser(testMentorEmail, tempMentorPassword);
      assert(loginRes.status === 200, 'User can log in using email + temporary password');
      assert(loginRes.data.mustChangePassword === true, 'Login response flags mustChangePassword = true');
      tempMentorToken = loginRes.data.token;

      // 2. /api/auth/me should succeed and return mustChangePassword: true
      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${tempMentorToken}` }
      });
      assert(meRes.status === 200, 'GET /api/auth/me succeeds for onboarding user');
      const meData = await meRes.json();
      assert(meData.data?.mustChangePassword === true, '/api/auth/me indicates mustChangePassword = true');

      // 3. Operational API requests MUST be strictly blocked with 403 MUST_CHANGE_PASSWORD
      const blockedRes1 = await fetch(`${baseUrl}/admin/overview`, {
        headers: { 'Authorization': `Bearer ${tempMentorToken}` }
      });
      assert(blockedRes1.status === 403, 'Operational endpoint returns 403 Forbidden before password change');
      const blockedData1 = await blockedRes1.json();
      assert(blockedData1.code === 'MUST_CHANGE_PASSWORD', 'Error code is MUST_CHANGE_PASSWORD');

      const blockedRes2 = await fetch(`${baseUrl}/tasks`, {
        headers: { 'Authorization': `Bearer ${tempMentorToken}` }
      });
      assert(blockedRes2.status === 403, 'Tasks endpoint is blocked with 403');
    }

    // -------------------------------------------------------------
    // SECTION 5: FIRST-LOGIN PASSWORD CHANGE FLOW & ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 5: Password Change Validation & State Transition...');
    const newPermanentPassword = 'M3nt0r@Secured2026!';
    {
      // 1. Attempt changing to weak password
      const weakRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempMentorToken}`
        },
        body: JSON.stringify({
          currentPassword: tempMentorPassword,
          newPassword: 'weak'
        })
      });
      assert(weakRes.status === 400, 'Weak password rejected with 400 Bad Request');

      // 2. Attempt reusing the exact same temporary password
      const reuseRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempMentorToken}`
        },
        body: JSON.stringify({
          currentPassword: tempMentorPassword,
          newPassword: tempMentorPassword
        })
      });
      assert(reuseRes.status === 400, 'Reusing temporary password rejected with 400 Bad Request');

      // 3. Successfully change to compliant permanent password
      const successRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempMentorToken}`
        },
        body: JSON.stringify({
          currentPassword: tempMentorPassword,
          newPassword: newPermanentPassword
        })
      });
      assert(successRes.status === 200, 'POST /api/auth/change-password succeeds with 200 OK');
      const successData = await successRes.json();
      assert(successData.success === true, 'Response confirms password changed');
      assert(successData.mustChangePassword === false, 'Response confirms mustChangePassword is now false');

      // 4. Verify DB state: must_change_password is now 0
      const [dbUserUpdated] = await query('SELECT must_change_password FROM users WHERE id = ?', [createdMentorId]);
      assert(dbUserUpdated.must_change_password === 0, 'Database confirms must_change_password = 0');

      // 5. Old temporary password must no longer work
      const oldLogin = await loginUser(testMentorEmail, tempMentorPassword);
      assert(oldLogin.status === 401, 'Old temporary password fails with 401 Unauthorized');

      // 6. New permanent password works
      const newLogin = await loginUser(testMentorEmail, newPermanentPassword);
      assert(newLogin.status === 200, 'New permanent password authenticates with 200 OK');
      assert(newLogin.data.mustChangePassword === false, 'mustChangePassword is false upon subsequent login');

      // 7. Operational endpoints are now unlocked
      const unlockedToken = newLogin.data.token;
      const unlockedRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${unlockedToken}` }
      });
      assert(unlockedRes.status === 200, 'Operational profile endpoint functions normally');
    }

    // -------------------------------------------------------------
    // SECTION 6: ADMINISTRATIVE PASSWORD RESET
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 6: Administrative Password Reset...');
    {
      const resetRes = await fetch(`${baseUrl}/admin/users/${createdMentorId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          reason: 'Automated administrative reset test'
        })
      });
      assert(resetRes.status === 200, 'POST /api/admin/users/:id/reset-password returns 200');
      const resetData = await resetRes.json();
      assert(Boolean(resetData.data?.temporaryPassword), 'Reset generates new temporary password');
      assert(resetData.data?.mustChangePassword === true, 'Reset sets mustChangePassword = true');

      const resetTemp = resetData.data.temporaryPassword;

      // Verify user must change password again
      const reloginRes = await loginUser(testMentorEmail, resetTemp);
      assert(reloginRes.status === 200, 'Can log in with new reset temporary password');
      assert(reloginRes.data.mustChangePassword === true, 'Account is flagged mustChangePassword = true again');
    }

    // -------------------------------------------------------------
    // SECTION 7: INTERN PROVISIONING WITH TEMPORARY PASSWORD
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 7: Intern Creation with Temporary Password...');
    const testInternEmail = `test.intern.${Date.now()}@jowis.com`;
    let createdInternId = null;
    let tempInternPass = '';
    {
      // Grab cohort and its matching track
      const [cohort] = await query('SELECT id, track_id FROM cohorts WHERE status != "archived" LIMIT 1');
      const trackId = cohort.track_id;
      const cohortId = cohort.id;

      const res = await fetch(`${baseUrl}/interns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          firstName: 'Automated',
          lastName: 'Intern',
          email: testInternEmail,
          trackId: trackId,
          cohortId: cohortId,
          startDate: '2026-09-01'
        })
      });

      const body = await res.json();
      if (res.status !== 201) console.log('INTERN CREATION ERROR:', body);
      assert(res.status === 201, 'POST /api/interns returns 201 Created');
      assert(Boolean(body.data?.temporaryPassword), 'Temporary password generated for new intern');
      assert(body.data?.mustChangePassword === true, 'Intern flagged mustChangePassword = true');
      tempInternPass = body.data.temporaryPassword;
      createdInternId = body.data.userId;

      // Login as intern
      const intLogin = await loginUser(testInternEmail, tempInternPass);
      assert(intLogin.status === 200, 'Intern can log in with temporary credentials');
      assert(intLogin.data.user.role === 'intern', 'Role is intern');
      assert(intLogin.data.mustChangePassword === true, 'Intern onboarding modal required');
    }

    // -------------------------------------------------------------
    // SECTION 8: GLOBAL EXPORT AUDIT & ENDPOINT VERIFICATION
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 8: Global Export Endpoints & RFC-4180 / UTF-8 Verification...');
    const exportTypes = [
      'attendance',
      'interns',
      'tasks',
      'performance',
      'cohorts',
      'tracks',
      'mentors',
      'executive',
      'users',
      'audit_logs',
      'automation',
      'certificates',
      'documents'
    ];

    for (const expType of exportTypes) {
      const res = await fetch(`${baseUrl}/reports/export/${expType}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });

      // Status should be 200 with CSV content, or 404 with empty message
      if (res.status === 200) {
        const arrayBuf = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        const hasBOM = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
        const text = new TextDecoder().decode(bytes);
        const disposition = res.headers.get('content-disposition') || '';
        assert(disposition.includes('.csv'), `Export /reports/export/${expType} has .csv Content-Disposition`);
        assert(hasBOM, `Export /reports/export/${expType} contains UTF-8 BOM prefix [0xEF, 0xBB, 0xBF] for Excel`);
        assert(text.includes('\n'), `Export /reports/export/${expType} contains CSV rows`);
        console.log(`    📊 ${expType.toUpperCase()} export verified (${text.split('\n').length} rows)`);
      } else if (res.status === 404) {
        const data = await res.json();
        assert(data.message.includes('No records match'), `Export /reports/export/${expType} cleanly handles empty set`);
      } else {
        throw new Error(`Unexpected export status ${res.status} for ${expType}`);
      }
    }

    // -------------------------------------------------------------
    // SECTION 9: EXPORT RBAC SCOPING TESTS
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 9: Export RBAC Scoping & Privilege Enforcement...');
    {
      // 1. Intern login token (change password first to unblock)
      const intLogin = await loginUser(testInternEmail, tempInternPass);
      const internToken = intLogin.data.token;
      await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internToken}`
        },
        body: JSON.stringify({
          currentPassword: tempInternPass,
          newPassword: 'Intern@Password2026!'
        })
      });
      const activeIntLogin = await loginUser(testInternEmail, 'Intern@Password2026!');
      const activeInternToken = activeIntLogin.data.token;

      // Intern accessing personal scorecard export: MUST succeed
      const scorecardRes = await fetch(`${baseUrl}/reports/export/personal_scorecard`, {
        headers: { 'Authorization': `Bearer ${activeInternToken}` }
      });
      assert(scorecardRes.status === 200, 'Intern can export their personal scorecard');
      const scorecardText = await scorecardRes.text();
      assert(scorecardText.includes(testInternEmail), 'Personal scorecard contains intern own identity');

      // Intern accessing attendance export: MUST succeed and contain ONLY their own data
      const intAttRes = await fetch(`${baseUrl}/reports/export/attendance`, {
        headers: { 'Authorization': `Bearer ${activeInternToken}` }
      });
      if (intAttRes.status === 200) {
        const attText = await intAttRes.text();
        assert(!attText.includes('admin@jowis.com'), 'Intern attendance export NEVER exposes other users data');
      }

      // Intern accessing unauthorized administrative exports: MUST be blocked with 403
      const blockedTypes = ['audit_logs', 'automation', 'users', 'executive'];
      for (const bType of blockedTypes) {
        const bRes = await fetch(`${baseUrl}/reports/export/${bType}`, {
          headers: { 'Authorization': `Bearer ${activeInternToken}` }
        });
        assert(bRes.status === 403, `Intern accessing ${bType} export is blocked with 403 Forbidden`);
      }
    }

    // -------------------------------------------------------------
    // SECTION 10: CLEANUP TEST DATA
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 10: Clean Up Test Artifacts...');
    {
      if (createdMentorId) {
        await query('DELETE FROM notifications WHERE user_id = ?', [createdMentorId]);
        await query('DELETE FROM users WHERE id = ?', [createdMentorId]);
      }
      if (createdInternId) {
        await query('DELETE FROM notifications WHERE user_id = ?', [createdInternId]);
        await query('DELETE FROM intern_lifecycle_history WHERE intern_id IN (SELECT id FROM intern_profiles WHERE user_id = ?)', [createdInternId]);
        await query('DELETE FROM intern_assignment_history WHERE intern_id IN (SELECT id FROM intern_profiles WHERE user_id = ?)', [createdInternId]);
        await query('DELETE FROM intern_profiles WHERE user_id = ?', [createdInternId]);
        await query('DELETE FROM users WHERE id = ?', [createdInternId]);
      }
      console.log('  ✅ Test users cleanly removed.');
    }

    console.log(`\n================================================================`);
    console.log(`🎉 ALL PHASE 12 AUTOMATED TESTS PASSED!`);
    console.log(`   Passed: ${testPassed}`);
    console.log(`   Failed: ${testFailed}`);
    console.log(`================================================================\n`);
  } catch (err) {
    console.error(`\n❌ TEST SUITE FAILED:`, err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase12Tests();
