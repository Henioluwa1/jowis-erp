import axios from 'axios';

async function testEnrollAndExport() {
  console.log('Testing Intern Enrollment and CSV Exports...');
  
  // 1. Login as super_admin
  const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
    email: 'admin@jowis.com',
    password: 'Admin@12345'
  });
  
  const token = loginRes.data.token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('✓ Logged in as super_admin successfully.');

  // 2. Test enrolling an intern with today as startDate and null/calculated expectedEndDate
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(today);
  d.setMonth(d.getMonth() + 6);
  const futureEnd = d.toISOString().split('T')[0];

  const internEmail = `test.candidate.${Date.now()}@jowis.com`;
  console.log(`\nTesting enrollment with startDate: ${today}, expectedEndDate: ${futureEnd}...`);
  
  const enrollRes = await axios.post('http://localhost:5000/api/interns', {
    firstName: 'Candidate',
    lastName: 'Tester',
    email: internEmail,
    phone: '08099887766',
    trackId: 1,
    cohortId: 1,
    mentorId: 1,
    startDate: today,
    expectedEndDate: futureEnd,
    gender: 'male',
    education: 'B.Sc Software Engineering',
    skills: 'React, Node.js, SQL'
  }, { headers });

  console.log('✓ Enrollment response:', enrollRes.data.success, 'Intern Code:', enrollRes.data.data?.internCode);
  console.log('  Temporary Password generated:', Boolean(enrollRes.data.data?.temporaryPassword) ? 'YES' : 'NO');

  const newUserId = enrollRes.data.data?.user?.id;
  const newInternId = enrollRes.data.data?.internId;
  console.log(`  Cleaning up temporary test intern ID: ${newInternId}, user ID: ${newUserId}...`);
  
  // 3. Test all CSV exports
  console.log('\nTesting CSV export endpoints:');
  const exportTypes = ['attendance', 'interns', 'mentors', 'cohorts', 'permissions', 'document_types', 'documents', 'audit_logs'];
  
  for (const type of exportTypes) {
    try {
      const res = await axios.get(`http://localhost:5000/api/reports/export/${type}`, {
        headers,
        responseType: 'arraybuffer'
      });
      const bom = Buffer.from(res.data.slice(0, 3)).toString('hex');
      const isUtf8Bom = bom === 'efbbbf';
      const textPreview = Buffer.from(res.data).toString('utf-8').slice(0, 100).replace(/\r?\n/g, ' ');
      console.log(`  ✓ /reports/export/${type}: Status ${res.status}, Size ${res.data.byteLength} bytes, UTF-8 BOM: ${isUtf8Bom ? 'YES' : 'NO'}`);
      console.log(`     Preview: ${textPreview.slice(0, 75)}...`);
    } catch (err) {
      console.error(`  ✗ /reports/export/${type}: Failed with status ${err.response?.status} - ${err.response?.data?.message || err.message}`);
    }
  }

  // Cleanup helper
  if (newInternId) {
    const pool = (await import('../config/db.js')).default;
    const { query } = await import('../config/db.js');
    await query('DELETE FROM notifications WHERE user_id = ?', [newUserId]);
    await query('DELETE FROM audit_logs WHERE user_id = ?', [newUserId]);
    await query('DELETE FROM intern_profiles WHERE id = ?', [newInternId]);
    await query('DELETE FROM users WHERE id = ?', [newUserId]);
    await pool.end();
    console.log('✓ Test candidate cleaned up cleanly from database.');
  }
}

testEnrollAndExport().catch(err => {
  console.error('Test execution failed:', err.response?.data || err.message);
  process.exit(1);
});
