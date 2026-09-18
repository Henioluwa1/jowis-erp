import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runPhase8Tests() {
  const PORT = 5097;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`=======================================================`);
  console.log(`🏛️  JOWIS STUDIO ERP — PHASE 8 AUTOMATED TEST SUITE`);
  console.log(`🛡️  ADMINISTRATION, AUDIT & SYSTEM GOVERNANCE ENGINE`);
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
    // SETUP: Authenticate Users Across Roles
    // -------------------------------------------------------------
    console.log('🔹 SETUP: Authenticating users across roles...');
    let superAdminToken, adminToken, mentorToken, internToken;
    let superAdminId, adminId, internId;

    {
      // Super Admin
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Super Admin login must succeed');
      superAdminToken = data.token;
      superAdminId = data.user.id;
    }

    {
      // Operational Admin (Blessing Johnson)
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'operations@jowis.com', password: 'Admin@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Operational Admin login must succeed');
      adminToken = data.token;
      adminId = data.user.id;
    }

    {
      // Mentor 1 (Samuel Adeyemi)
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'mentor.sam@jowis.com', password: 'Mentor@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Mentor login must succeed');
      mentorToken = data.token;
    }

    {
      // Intern 1 (David Adeleke)
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
      });
      const data = await res.json();
      assert(res.status === 200 && data.token, 'Intern login must succeed');
      internToken = data.token;
      internId = data.user.id;
    }

    // -------------------------------------------------------------
    // GATE 1 & 4: Relational Schema & Permission Matrix Verification
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1 & 4: Relational Schema & Permissions Architecture...');
    {
      const permTable = await query(`SHOW TABLES LIKE 'permissions'`);
      assert(permTable.length > 0, 'Table `permissions` exists in database');

      const rolePermTable = await query(`SHOW TABLES LIKE 'role_permissions'`);
      assert(rolePermTable.length > 0, 'Table `role_permissions` exists in database');

      const auditCols = await query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'
      `);
      const auditNames = auditCols.map(c => c.COLUMN_NAME.toLowerCase());
      assert(auditNames.includes('reason'), 'Table `audit_logs` has `reason` column');
      assert(auditNames.includes('status'), 'Table `audit_logs` has `status` column');
      assert(auditNames.includes('user_agent'), 'Table `audit_logs` has `user_agent` column');

      const userCols = await query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
      `);
      const userNames = userCols.map(c => c.COLUMN_NAME.toLowerCase());
      assert(userNames.includes('deactivation_reason'), 'Table `users` has `deactivation_reason` column');
    }

    // -------------------------------------------------------------
    // GATE 5: Governance & Administrative Overview Dashboard
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Administrative Dashboard & System Indicators...');
    {
      const res = await fetch(`${baseUrl}/admin/overview`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200 && data.success, 'Super Admin can access governance overview (200 OK)');
      assert(typeof data.data.summary.totalUsers === 'number', 'Summary contains total users KPI');
      assert(typeof data.data.summary.activeUsers === 'number', 'Summary contains active users KPI');
      assert(Array.isArray(data.data.usersByRole), 'Overview provides users grouped by role');
      assert(data.data.systemHealth?.database === 'jowis_studio_erp', 'System health reports active database');
      assert(data.data.systemHealth?.timezone.includes('Africa/Lagos'), 'System health confirms Lagos authoritative timezone');
      assert(Array.isArray(data.data.recentActivity), 'Overview includes recent administrative activity stream');
    }

    // -------------------------------------------------------------
    // GATE 2: User Administration (Listing, Search, Filter, Profile)
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: User Administration & Profile Oversight...');
    let createdTestUserId;
    {
      // 1. List users
      const res = await fetch(`${baseUrl}/admin/users?page=1&limit=10`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const data = await res.json();
      assert(res.status === 200 && data.success, 'Can retrieve paginated users list (200 OK)');
      assert(Array.isArray(data.data) && data.data.length > 0, 'Users returned as non-empty array');
      assert(data.pagination.total >= 4, 'Total users count is at least 4');

      // Sensitive field check: ZERO password hashes exposed!
      const leakedHash = data.data.some(u => u.password_hash || u.password);
      assert(!leakedHash, 'Strict Data Protection: ZERO password hashes exposed in users listing');

      // 2. Filter by role
      const mentorRes = await fetch(`${baseUrl}/admin/users?role=mentor`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const mentorData = await mentorRes.json();
      assert(mentorData.success, 'Filter by role=mentor succeeds');
      assert(mentorData.data.every(u => u.role_name === 'mentor'), 'All returned records have role_name=mentor');

      // 3. Search by keyword
      const searchRes = await fetch(`${baseUrl}/admin/users?search=David`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const searchData = await searchRes.json();
      assert(searchData.success && searchData.data.length > 0, 'Search for user "David" returns matching user');
      assert(searchData.data[0].first_name === 'David', 'First name matches searched keyword');

      // 4. Create new user account
      const uniqueEmail = `test.governance.${Date.now()}@jowis.com`;
      const createRes = await fetch(`${baseUrl}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          firstName: 'Amaka',
          lastName: 'Eze',
          email: uniqueEmail,
          password: 'SecurePassword@2026',
          roleName: 'mentor',
          phone: '+234 812 345 6789'
        })
      });
      const createData = await createRes.json();
      assert(createRes.status === 201 && createData.success, 'Admin can create user account (201 Created)');
      assert(createData.data.id && createData.data.email === uniqueEmail, 'Created user returned with valid ID and email');
      createdTestUserId = createData.data.id;

      // Duplicate email rejection
      const dupRes = await fetch(`${baseUrl}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          firstName: 'Amaka',
          lastName: 'Eze',
          email: uniqueEmail,
          password: 'SecurePassword@2026',
          roleName: 'mentor'
        })
      });
      assert(dupRes.status === 409, 'Duplicate user creation rejected with 409 Conflict');

      // 5. Inspect single user profile
      const detailRes = await fetch(`${baseUrl}/admin/users/${createdTestUserId}`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const detailData = await detailRes.json();
      assert(detailRes.status === 200 && detailData.data.first_name === 'Amaka', 'Can retrieve single user details');
      assert(!detailData.data.password_hash, 'Single user profile NEVER exposes password hash');
    }

    // -------------------------------------------------------------
    // GATE 2 & 11 & 12: Account Activation, Deactivation & Justification
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2 & 11 & 12: Controlled Activation / Deactivation & Reason Mandate...');
    {
      // Missing reason must be rejected
      const noReasonRes = await fetch(`${baseUrl}/admin/users/${createdTestUserId}/status`, {
        method: 'POST', // or PATCH
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ isActive: false, reason: '' })
      });
      assert(noReasonRes.status === 400, 'Deactivation without mandatory reason is rejected (400 Bad Request)');

      // Deactivation with valid reason
      const deactRes = await fetch(`${baseUrl}/admin/users/${createdTestUserId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ isActive: false, reason: 'Temporary administrative leave pending onboarding review' })
      });
      const deactData = await deactRes.json();
      assert(deactRes.status === 200 && deactData.data.isActive === 0, 'User account successfully deactivated (200 OK)');
      assert(deactData.data.deactivationReason.includes('Temporary administrative leave'), 'Deactivation reason saved in user record');

      // Verify self-deactivation protection
      const selfDeactRes = await fetch(`${baseUrl}/admin/users/${superAdminId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ isActive: false, reason: 'Accidental self deactivation attempt' })
      });
      assert(selfDeactRes.status === 400, 'Self-deactivation by Administrator is strictly prohibited (400 Bad Request)');

      // Reactivate user
      const reactRes = await fetch(`${baseUrl}/admin/users/${createdTestUserId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ isActive: true, reason: 'Completed onboarding verification successfully' })
      });
      const reactData = await reactRes.json();
      assert(reactRes.status === 200 && reactData.data.isActive === 1, 'User account reactivated successfully');
      assert(reactData.data.deactivationReason === null, 'Deactivation reason cleared on reactivation');
    }

    // -------------------------------------------------------------
    // GATE 3: Role Administration & Privilege Escalation Protection
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Role Management & Privilege Escalation Guards...');
    {
      // 1. Fetch system roles
      const rolesRes = await fetch(`${baseUrl}/admin/roles`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const rolesData = await rolesRes.json();
      assert(rolesRes.status === 200 && rolesData.data.length >= 4, 'Can retrieve system roles list (>= 4 roles)');

      // 2. Operational Admin attempting to promote user to super_admin (MUST FAIL)
      const escalateRes = await fetch(`${baseUrl}/admin/users/${createdTestUserId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}` // Calling as operational admin
        },
        body: JSON.stringify({
          roleName: 'super_admin',
          reason: 'Unauthorized attempt to promote account to super_admin'
        })
      });
      assert(escalateRes.status === 403, 'Privilege Escalation Blocked: Operational Admin CANNOT promote anyone to super_admin (403 Forbidden)');

      // 3. User attempting to modify their own role (MUST FAIL)
      const selfEscalateRes = await fetch(`${baseUrl}/admin/users/${adminId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          roleName: 'super_admin',
          reason: 'Self-escalation attempt'
        })
      });
      assert(selfEscalateRes.status === 400, 'Self-role modification is strictly prohibited (400 Bad Request)');

      // 4. Valid role transition by Super Admin with justification
      const roleChangeRes = await fetch(`${baseUrl}/admin/users/${createdTestUserId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          roleName: 'intern',
          reason: 'Re-assigned to intern training cohort after departmental re-structuring'
        })
      });
      const roleChangeData = await roleChangeRes.json();
      assert(roleChangeRes.status === 200 && roleChangeData.data.newRole === 'intern', 'Super Admin can change user role with justification (200 OK)');
    }

    // -------------------------------------------------------------
    // GATE 2: Administrative Password Reset Flow
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: Secure Administrative Password Reset...');
    {
      const resetRes = await fetch(`${baseUrl}/admin/users/${createdTestUserId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          newPassword: 'NewSecurePassword@2026',
          reason: 'User reported forgotten credentials; administrative reset executed'
        })
      });
      const resetData = await resetRes.json();
      assert(resetRes.status === 200 && resetData.success, 'Administrative password reset succeeds (200 OK)');

      // Verify the user can login with the new password
      const [testUser] = await query('SELECT email FROM users WHERE id = ?', [createdTestUserId]);
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUser.email, password: 'NewSecurePassword@2026' })
      });
      const loginData = await loginRes.json();
      assert(loginRes.status === 200 && loginData.token, 'User can log in with administratively reset password');
    }

    // -------------------------------------------------------------
    // GATE 4: Permission Matrix Governance
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Permission Matrix & Multi-Domain Governance...');
    {
      const permRes = await fetch(`${baseUrl}/admin/permissions`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const permData = await permRes.json();
      assert(permRes.status === 200 && permData.success, 'Can retrieve centralized permissions matrix (200 OK)');
      assert(Array.isArray(permData.data.matrix), 'Permissions matrix returned as array');
      assert(permData.data.permissions.length >= 20, 'Canonical permission matrix includes all institutional capabilities (>= 20)');

      // Verify super_admin has users:read and settings:update
      const usersRead = permData.data.matrix.find(m => m.slug === 'users:read');
      assert(usersRead && usersRead.roles.super_admin === true, 'Super Admin holds `users:read` permission');
      assert(usersRead.roles.intern === false, 'Intern DOES NOT hold `users:read` permission');
    }

    // -------------------------------------------------------------
    // GATE 6 & 7: Organization & System Configuration Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6 & 7: Organization & System Configuration...');
    {
      // 1. Retrieve all settings
      const settRes = await fetch(`${baseUrl}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const settData = await settRes.json();
      assert(settRes.status === 200 && Array.isArray(settData.data), 'Can retrieve administrative settings (200 OK)');

      // Verify organization fields exist
      const orgName = settData.data.find(s => s.setting_key === 'organization_name');
      assert(orgName && orgName.setting_value === 'Jowis Studio', 'Authoritative organization name is preserved: "Jowis Studio"');

      const tzSetting = settData.data.find(s => s.setting_key === 'app_timezone');
      assert(tzSetting && tzSetting.setting_value === 'Africa/Lagos', 'Authoritative timezone setting is preserved: "Africa/Lagos"');

      // 2. Update setting with validation
      const updateRes = await fetch(`${baseUrl}/admin/settings/organization_contact_phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({
          value: '+234 800 569 4738',
          reason: 'Updated primary switchboard telephone line'
        })
      });
      const updateData = await updateRes.json();
      assert(updateRes.status === 200 && updateData.success, 'Super Admin can update organization setting (200 OK)');

      // 3. Type validation: invalid number must be rejected
      const invalidNumRes = await fetch(`${baseUrl}/admin/settings/weight_attendance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ value: 'not-a-number', reason: 'Invalid number test' })
      });
      assert(invalidNumRes.status === 400, 'Non-numeric value for numeric setting is rejected (400 Bad Request)');

      // 4. Type validation: invalid time format rejected
      const invalidTimeRes = await fetch(`${baseUrl}/admin/settings/attendance_cutoff_time`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ value: '25:99:99', reason: 'Invalid time format test' })
      });
      assert(invalidTimeRes.status === 400, 'Invalid time string for time setting is rejected (400 Bad Request)');
    }

    // -------------------------------------------------------------
    // GATE 8, 9, 10: Audit Log Architecture & Immutability Protection
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 8, 9, 10: Audit Log Architecture & Immutability Protection...');
    {
      // 1. Fetch audit logs with filtering
      const auditRes = await fetch(`${baseUrl}/admin/audit-logs?page=1&limit=15`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const auditData = await auditRes.json();
      assert(auditRes.status === 200 && auditData.success, 'Can retrieve paginated audit logs (200 OK)');
      assert(Array.isArray(auditData.data) && auditData.data.length > 0, 'Audit records returned as array');
      assert(auditData.pagination.total >= 1, 'Audit log total count is positive');

      // Verify captured fields
      const firstLog = auditData.data[0];
      assert(firstLog.action !== undefined, 'Audit record contains action');
      assert(firstLog.entity_type !== undefined, 'Audit record contains entity_type');
      assert(firstLog.status !== undefined, 'Audit record contains status');

      // 2. Filter audit log by action
      const filterRes = await fetch(`${baseUrl}/admin/audit-logs?action=CREATE_USER`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      const filterData = await filterRes.json();
      assert(filterData.success, 'Filter audit logs by action=CREATE_USER succeeds');
      assert(filterData.data.every(l => l.action === 'CREATE_USER'), 'All filtered logs match action CREATE_USER');

      // 3. Immutability Enforcement (Gate 9): DELETE / PUT MUST BE REJECTED
      const deleteAuditRes = await fetch(`${baseUrl}/admin/audit-logs/1`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(deleteAuditRes.status === 405, 'Audit Immutability: DELETE on audit log is prohibited (405 Method Not Allowed)');

      const putAuditRes = await fetch(`${baseUrl}/admin/audit-logs/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${superAdminToken}`
        },
        body: JSON.stringify({ action: 'TAMPERED_ACTION' })
      });
      assert(putAuditRes.status === 405, 'Audit Immutability: PUT mutation on audit log is prohibited (405 Method Not Allowed)');
    }

    // -------------------------------------------------------------
    // GATE 13 & 17: Direct API Security, Scope Isolation & Unauthorized Rejection
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 13 & 17: Direct API Security & Scope Penetration Testing...');
    {
      // 1. Missing Token (401)
      const noTokenRes = await fetch(`${baseUrl}/admin/users`);
      assert(noTokenRes.status === 401, 'Request without Bearer token returns 401 Unauthorized');

      // 2. Forged / Invalid Token (401)
      const fakeTokenRes = await fetch(`${baseUrl}/admin/users`, {
        headers: { 'Authorization': 'Bearer forged.invalid.token' }
      });
      assert(fakeTokenRes.status === 401, 'Request with forged token returns 401 Unauthorized');

      // 3. Intern attempting to access administrative API (403)
      const internBlockRes = await fetch(`${baseUrl}/admin/users`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      assert(internBlockRes.status === 403, 'Intern calling /admin/users returns 403 Forbidden');

      // 4. Mentor attempting to access administrative API (403)
      const mentorBlockRes = await fetch(`${baseUrl}/admin/users`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      assert(mentorBlockRes.status === 403, 'Mentor calling /admin/users returns 403 Forbidden');

      // 5. Mentor calling /admin/audit-logs (403)
      const mentorAuditRes = await fetch(`${baseUrl}/admin/audit-logs`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      assert(mentorAuditRes.status === 403, 'Mentor calling /admin/audit-logs returns 403 Forbidden');

      // 6. SQL Injection Resilience in search parameters
      const sqliRes = await fetch(`${baseUrl}/admin/users?search=%27%20OR%201=1%20--`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(sqliRes.status === 200, 'SQL injection attempt in user search handled safely with parameterized queries');
    }

    // -------------------------------------------------------------
    // GATE 20: Regression Validation Across Phases 1–7
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 20: Regression Validation (Phases 1-7 Endpoints)...');
    {
      // Phase 1
      const p1 = await fetch(`${baseUrl}/health`);
      assert(p1.status === 200, 'Phase 1: /api/health returns 200 OK');

      // Phase 2
      const p2 = await fetch(`${baseUrl}/interns`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p2.status === 200, 'Phase 2: /api/interns returns 200 OK');

      // Phase 3
      const p3 = await fetch(`${baseUrl}/tasks`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p3.status === 200, 'Phase 3: /api/tasks returns 200 OK');

      // Phase 4
      const p4 = await fetch(`${baseUrl}/performance/overview`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p4.status === 200, 'Phase 4: /api/performance/overview returns 200 OK');

      // Phase 5
      const p5 = await fetch(`${baseUrl}/reports/executive`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p5.status === 200, 'Phase 5: /api/reports/executive returns 200 OK');

      // Phase 6
      const p6a = await fetch(`${baseUrl}/documents/types`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p6a.status === 200, 'Phase 6: /api/documents/types returns 200 OK');

      const p6b = await fetch(`${baseUrl}/certificates/types`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p6b.status === 200, 'Phase 6: /api/certificates/types returns 200 OK');

      // Phase 7
      const p7a = await fetch(`${baseUrl}/communications/announcements`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p7a.status === 200, 'Phase 7: /api/communications/announcements returns 200 OK');

      const p7b = await fetch(`${baseUrl}/communications/notifications`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(p7b.status === 200, 'Phase 7: /api/communications/notifications returns 200 OK');
    }

    console.log('\n=======================================================');
    console.log(`🎯 ALL PHASE 8 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('\n❌ PHASE 8 TEST SUITE ABORTED WITH ERROR:', err);
    testFailed++;
  } finally {
    server.close();
    await pool.end();
    process.exit(testFailed === 0 ? 0 : 1);
  }
}

runPhase8Tests();
