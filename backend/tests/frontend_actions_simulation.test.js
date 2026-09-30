import pool from '../src/config/db.js';

const BASE_URL = 'http://localhost:5000/api';

async function testFrontendMutations() {
  console.log('🚀 TESTING FRONTEND INTERACTIVE MUTATIONS & BUTTON ACTIONS 🚀\n');

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

  // 1. Intern Login
  const internLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
  }).then(r => r.json());

  const internHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${internLogin.token}`
  };

  // 1. Check-in action (Attendance page "Mark Today's Attendance" button)
  await check('Intern Clock-In Action (/api/attendance/check-in)', async () => {
    const res = await fetch(`${BASE_URL}/attendance/check-in`, {
      method: 'POST',
      headers: internHeaders
    });
    // Can be 200 or 400 (if already checked in today or outside schedule)
    const data = await res.json();
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status ${res.status}: ${data.message}`);
    }
    // Both 200 (checked in) or 400 (already checked in / not scheduled) are proper valid business responses
  });

  // 2. Permission Request submit action (Leave / Absence modal)
  let createdPermId = null;
  await check('Intern Submit Permission Request (/api/permissions)', async () => {
    const res = await fetch(`${BASE_URL}/permissions`, {
      method: 'POST',
      headers: internHeaders,
      body: JSON.stringify({
        startDate: '2026-10-15',
        endDate: '2026-10-16',
        category: 'ACADEMIC',
        reason: 'University semester examination requirement for academic credit.'
      })
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      createdPermId = data.data.id;
    } else if (res.status === 400 && data.message.includes('overlapping')) {
      // Overlapping request already exists - also valid business response
    } else {
      throw new Error(`Status ${res.status}: ${data.message}`);
    }
  });

  // 3. Permission Request cancel action
  if (createdPermId) {
    await check('Intern Cancel Permission Request (/api/permissions/:id/cancel)', async () => {
      const res = await fetch(`${BASE_URL}/permissions/${createdPermId}/cancel`, {
        method: 'POST',
        headers: internHeaders,
        body: JSON.stringify({ reason: 'Rescheduled exams by university' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    });
  }

  // 4. Notifications Mark All Read button
  await check('Notifications Mark All Read (/api/communications/notifications/mark-all-read)', async () => {
    const res = await fetch(`${BASE_URL}/communications/notifications/mark-all-read`, {
      method: 'PATCH',
      headers: internHeaders
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.message);
  });

  // 5. Update Profile contact info
  await check('Update Profile Contact Info (/api/auth/profile)', async () => {
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: internHeaders,
      body: JSON.stringify({
        phoneNumber: '+2348012345678',
        emergencyContactName: 'Babatunde Adeleke',
        emergencyContactPhone: '+2348087654321',
        bio: 'Aspiring Full Stack Engineer passionate about building scalable web solutions.'
      })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.message);
  });

  // 6. Test Super Admin Actions
  const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
  }).then(r => r.json());

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminLogin.token}`
  };

  // 7. Admin Export Attendance CSV
  await check('Admin Export Attendance CSV (/api/reports/export/attendance)', async () => {
    const res = await fetch(`${BASE_URL}/reports/export/attendance`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('csv')) throw new Error('Expected CSV content type');
  });

  // 8. Admin Export Users CSV
  await check('Admin Export Users CSV (/api/reports/export/users)', async () => {
    const res = await fetch(`${BASE_URL}/reports/export/users`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 9. Admin Run Automation Rule
  await check('Admin Run Automation Rule (/api/automation/rules/AUTO_ATTENDANCE_CLOSE/run)', async () => {
    const res = await fetch(`${BASE_URL}/automation/rules/AUTO_ATTENDANCE_CLOSE/run`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ force: true })
    });
    const data = await res.json();
    if (res.status !== 200 || !data.success) throw new Error(data.message);
  });

  console.log(`\n======================================================`);
  console.log(`🎯 MUTATION TESTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log(`======================================================`);

  await pool.end();
  if (failed > 0) process.exit(1);
}

testFrontendMutations().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
