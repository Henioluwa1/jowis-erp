import app from '../src/app.js';
import pool from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runApiTests() {
  const PORT = 5055;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`🧪 Test server listening on http://localhost:${PORT}`);

  try {
    const baseUrl = `http://localhost:${PORT}/api`;

    // 1. Health check
    console.log('\n--- 1. Testing GET /api/health ---');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('Health Response:', healthData);
    if (healthData.status !== 'ok') throw new Error('Health check failed');
    console.log('✅ Health check passed.');

    // 2. Admin Login
    console.log('\n--- 2. Testing Super Admin Login (admin@jowis.com) ---');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
    });
    const adminLoginData = await adminLoginRes.json();
    if (!adminLoginData.success || !adminLoginData.token) {
      throw new Error(`Admin login failed: ${adminLoginData.message}`);
    }
    console.log(`✅ Admin login passed. Role: ${adminLoginData.user.role}, Name: ${adminLoginData.user.firstName}`);
    const adminToken = adminLoginData.token;

    // 3. Intern Login
    console.log('\n--- 3. Testing Intern Login (intern@jowis.com) ---');
    const internLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const internLoginData = await internLoginRes.json();
    if (!internLoginData.success || !internLoginData.token) {
      throw new Error(`Intern login failed: ${internLoginData.message}`);
    }
    console.log(`✅ Intern login passed. Role: ${internLoginData.user.role}, Code: ${internLoginData.user.internCode}`);
    const internToken = internLoginData.token;

    // 4. Intern Accessing Admin Endpoint (Must be 403 Forbidden)
    console.log('\n--- 4. Testing Role Security: Intern attempting to access Admin Attendance Overview ---');
    const forbiddenRes = await fetch(`${baseUrl}/attendance/admin/overview`, {
      headers: { 'Authorization': `Bearer ${internToken}` }
    });
    if (forbiddenRes.status === 403) {
      console.log('✅ Security passed: Intern was correctly blocked (403 Forbidden).');
    } else {
      throw new Error(`Expected 403 Forbidden, but got status ${forbiddenRes.status}`);
    }

    // 5. Admin Accessing Admin Attendance Overview (Must be 200 OK)
    console.log('\n--- 5. Testing Admin Accessing Admin Attendance Overview ---');
    const adminOverviewRes = await fetch(`${baseUrl}/attendance/admin/overview`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminOverviewData = await adminOverviewRes.json();
    if (!adminOverviewData.success) throw new Error('Admin overview failed');
    console.log('✅ Admin attendance overview passed:', adminOverviewData.data);

    // 6. Intern Fetching Own Attendance Summary
    console.log('\n--- 6. Testing Intern Fetching Own Attendance Summary ---');
    const internSummaryRes = await fetch(`${baseUrl}/attendance/me/summary`, {
      headers: { 'Authorization': `Bearer ${internToken}` }
    });
    const internSummaryData = await internSummaryRes.json();
    if (!internSummaryData.success) throw new Error('Intern attendance summary failed');
    console.log('✅ Intern attendance summary passed:', internSummaryData.data.stats);

    // 7. Security: Intern A accessing Intern B's profile
    console.log('\n--- 7. Testing Ownership Security: Intern 1 (David) accessing Intern 2 (Zainab) ---');
    const internOwnershipRes = await fetch(`${baseUrl}/interns/2`, {
      headers: { 'Authorization': `Bearer ${internToken}` }
    });
    if (internOwnershipRes.status === 403) {
      console.log("✅ Ownership check passed: Intern 1 blocked from accessing Intern 2's profile (403 Forbidden).");
    } else {
      throw new Error(`Expected 403 Forbidden on foreign profile, got ${internOwnershipRes.status}`);
    }

    // 8. Admin Dashboard Data
    console.log('\n--- 8. Testing Admin Dashboard Aggregation ---');
    const adminDashRes = await fetch(`${baseUrl}/dashboard/admin`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminDashData = await adminDashRes.json();
    if (!adminDashData.success) throw new Error('Admin dashboard failed');
    console.log('✅ Admin dashboard passed. Total Interns:', adminDashData.data.interns.total, 'Active:', adminDashData.data.interns.active);

    console.log('\n🎉 ALL BACKEND API & ROLE-BASED SECURITY TESTS PASSED PERFECTLY! 🎉\n');
  } finally {
    server.close();
    await pool.end();
    process.exit(0);
  }
}

runApiTests().catch(err => {
  console.error('❌ API Test Failed:', err);
  server.close();
  pool.end();
  process.exit(1);
});
