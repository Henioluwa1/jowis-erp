import pool, { query } from '../src/config/db.js';

const BASE_URL = 'http://localhost:5000/api';

async function testFrontendAPIs() {
  console.log('🚀 TESTING ALL FRONTEND PORTAL ENDPOINTS SIMULATION 🚀\n');

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // 1. Authenticate Intern
  console.log('🔹 [1/4] TESTING INTERN PAGES ENDPOINTS...');
  const internLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
  }).then(r => r.json());

  if (!internLogin.success || !internLogin.token) {
    throw new Error('Failed to login as intern: ' + internLogin.message);
  }
  const internToken = internLogin.token;
  const internHeaders = { 'Authorization': `Bearer ${internToken}` };

  // Intern Dashboard
  await check('Intern Dashboard (/api/dashboard/intern)', async () => {
    const res = await fetch(`${BASE_URL}/dashboard/intern`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
  });

  // Intern Attendance Page
  await check('Intern Attendance Summary (/api/attendance/me/summary)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/me/summary`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Attendance Records (/api/attendance/me?limit=50)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/me?limit=50`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Attendance Analytics (/api/attendance/me/analytics)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/me/analytics`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Schedule (/api/attendance/schedule)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/schedule`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Permissions (/api/permissions)', async () => {
    const res = await fetch(`${BASE_URL}/permissions`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // Intern Tasks Page
  await check('Intern Tasks Me (/api/tasks/me)', async () => {
    const res = await fetch(`${BASE_URL}/tasks/me`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // Intern Performance Page
  await check('Intern Performance Me (/api/performance/me)', async () => {
    const res = await fetch(`${BASE_URL}/performance/me`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // Intern Reports Page
  await check('Intern Reports Me (/api/reports/me)', async () => {
    const res = await fetch(`${BASE_URL}/reports/me`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // Intern Documents Page
  await check('Intern Documents Completeness (/api/documents/completeness)', async () => {
    const res = await fetch(`${BASE_URL}/documents/completeness`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Documents List (/api/documents)', async () => {
    const res = await fetch(`${BASE_URL}/documents`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Documents Types (/api/documents/types)', async () => {
    const res = await fetch(`${BASE_URL}/documents/types`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // Intern Certificates Page
  await check('Intern Certificates Eligibility (/api/certificates/eligibility)', async () => {
    const res = await fetch(`${BASE_URL}/certificates/eligibility`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Certificates List (/api/certificates)', async () => {
    const res = await fetch(`${BASE_URL}/certificates`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // Intern Announcements & Notifications
  await check('Intern Announcements (/api/communications/announcements?limit=50)', async () => {
    const res = await fetch(`${BASE_URL}/communications/announcements?limit=50`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Notifications (/api/communications/notifications)', async () => {
    const res = await fetch(`${BASE_URL}/communications/notifications`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Intern Profile (/api/auth/profile)', async () => {
    const res = await fetch(`${BASE_URL}/auth/profile`, { headers: internHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 2. Authenticate Mentor
  console.log('\n🔹 [2/4] TESTING MENTOR PAGES ENDPOINTS...');
  const mentorLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mentor.sam@jowis.com', password: 'Mentor@12345' })
  }).then(r => r.json());

  if (!mentorLogin.success || !mentorLogin.token) {
    throw new Error('Failed to login as mentor: ' + mentorLogin.message);
  }
  const mentorToken = mentorLogin.token;
  const mentorHeaders = { 'Authorization': `Bearer ${mentorToken}` };

  await check('Mentor Admin Dashboard (/api/dashboard/admin)', async () => {
    const res = await fetch(`${BASE_URL}/dashboard/admin`, { headers: mentorHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Mentor Interns List (/api/interns)', async () => {
    const res = await fetch(`${BASE_URL}/interns`, { headers: mentorHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Mentor Tasks Overview (/api/tasks/operations-dashboard)', async () => {
    const res = await fetch(`${BASE_URL}/tasks/operations-dashboard`, { headers: mentorHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Mentor Tasks List (/api/tasks)', async () => {
    const res = await fetch(`${BASE_URL}/tasks`, { headers: mentorHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Mentor Performance Workspace (/api/performance/mentor-workspace)', async () => {
    const res = await fetch(`${BASE_URL}/performance/mentor-workspace`, { headers: mentorHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 3. Authenticate Super Admin
  console.log('\n🔹 [3/4] TESTING ADMIN PAGES ENDPOINTS...');
  const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
  }).then(r => r.json());

  if (!adminLogin.success || !adminLogin.token) {
    throw new Error('Failed to login as admin: ' + adminLogin.message);
  }
  const adminToken = adminLogin.token;
  const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

  await check('Admin Dashboard (/api/dashboard/admin)', async () => {
    const res = await fetch(`${BASE_URL}/dashboard/admin`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Attendance Overview (/api/attendance/admin/overview)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/admin/overview`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Attendance Register (/api/attendance/admin/register)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/admin/register`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Attendance Audit Logs (/api/attendance/admin/audit-logs)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/admin/audit-logs`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Company Holidays (/api/attendance/holidays)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/holidays`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Training Tracks (/api/training/tracks)', async () => {
    const res = await fetch(`${BASE_URL}/training/tracks`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Training Cohorts (/api/training/cohorts)', async () => {
    const res = await fetch(`${BASE_URL}/training/cohorts`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Training Modules (/api/training/modules)', async () => {
    const res = await fetch(`${BASE_URL}/training/modules`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Performance Overview (/api/performance/overview)', async () => {
    const res = await fetch(`${BASE_URL}/performance/overview`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Performance Criteria (/api/performance/criteria)', async () => {
    const res = await fetch(`${BASE_URL}/performance/criteria`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Performance Periods (/api/performance/periods)', async () => {
    const res = await fetch(`${BASE_URL}/performance/periods`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Reports Executive (/api/reports/executive)', async () => {
    const res = await fetch(`${BASE_URL}/reports/executive`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Governance Overview (/api/admin/overview)', async () => {
    const res = await fetch(`${BASE_URL}/admin/overview`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Governance Users (/api/admin/users?page=1&limit=10)', async () => {
    const res = await fetch(`${BASE_URL}/admin/users?page=1&limit=10`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Governance Roles (/api/admin/roles)', async () => {
    const res = await fetch(`${BASE_URL}/admin/roles`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Governance Permissions (/api/admin/permissions)', async () => {
    const res = await fetch(`${BASE_URL}/admin/permissions`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Governance Settings (/api/admin/settings)', async () => {
    const res = await fetch(`${BASE_URL}/admin/settings`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Governance Audit Logs (/api/admin/audit-logs?page=1&limit=10)', async () => {
    const res = await fetch(`${BASE_URL}/admin/audit-logs?page=1&limit=10`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Automation Rules (/api/automation/rules)', async () => {
    const res = await fetch(`${BASE_URL}/automation/rules`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Automation Executions (/api/automation/executions)', async () => {
    const res = await fetch(`${BASE_URL}/automation/executions`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Automation Alerts (/api/automation/alerts)', async () => {
    const res = await fetch(`${BASE_URL}/automation/alerts`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Security Stats (/api/admin/security/stats)', async () => {
    const res = await fetch(`${BASE_URL}/admin/security/stats`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });
  await check('Admin Security Logs (/api/admin/security/logs)', async () => {
    const res = await fetch(`${BASE_URL}/admin/security/logs`, { headers: adminHeaders });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 4. Public Certificate Verification
  console.log('\n🔹 [4/4] TESTING PUBLIC CERTIFICATE VERIFICATION...');
  // Find an issued certificate in database to test
  const [certs] = await pool.query("SELECT verification_code FROM certificates WHERE status = 'issued' LIMIT 1");
  if (certs.length > 0) {
    const testCode = certs[0].verification_code;
    await check(`Public Certificate Verification (/api/certificates/verify/${testCode})`, async () => {
      const res = await fetch(`${BASE_URL}/certificates/verify/${testCode}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    });
  } else {
    console.log('  ⚠️ Note: No issued certificates in DB currently to test verification code lookup.');
  }

  console.log(`\n======================================================`);
  console.log(`🎯 TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log(`======================================================`);

  await pool.end();
  if (failed > 0) {
    process.exit(1);
  }
}

testFrontendAPIs().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
