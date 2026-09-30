import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- TESTING ID CARD SYSTEM END-TO-END ---');

  // 1. PUBLIC VERIFICATION ENDPOINT
  console.log('\n[1] Testing Public Verification Endpoint...');
  const verifyRes = await fetch(`${BASE_URL}/system/verify-id/JOWIS-INT-2026-001`);
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyRes.status, 200, 'Public verify returns 200 OK');
  assert.strictEqual(verifyData.verified, true, 'Credential is confirmed verified');
  assert.strictEqual(verifyData.data.institutionalId, 'JOWIS-INT-2026-001');
  assert.strictEqual(verifyData.data.fullName, 'David Adeleke');
  assert.strictEqual(verifyData.data.status, 'ACTIVE');
  console.log('✅ Public ID verification returned verified credential for David Adeleke:', verifyData.data.institutionalId);

  const invalidRes = await fetch(`${BASE_URL}/system/verify-id/NON-EXISTENT-CODE`);
  assert.strictEqual(invalidRes.status, 404, 'Invalid ID returns 404');
  console.log('✅ Invalid verification code correctly rejected with 404');

  // 2. AUTHENTICATION & ACCESS CONTROL
  console.log('\n[2] Testing Authentication & Role Guard on ID Card Settings...');
  const internLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
  });
  const internLoginData = await internLoginRes.json();
  const internToken = internLoginData.token;
  assert(internToken, 'Intern logged in successfully');

  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
  });
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.token;
  assert(adminToken, 'Admin logged in successfully');

  // Intern fetching card configs: Allowed
  const internGetConfigRes = await fetch(`${BASE_URL}/system/id-card-config`, {
    headers: { Authorization: `Bearer ${internToken}` }
  });
  assert.strictEqual(internGetConfigRes.status, 200, 'Intern can read ID card configuration');
  console.log('✅ Intern can fetch active institutional card designs (200 OK)');

  // Intern attempting to modify card configs: Blocked (403)
  const internMutateRes = await fetch(`${BASE_URL}/system/id-card-config`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${internToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ config: { test: true } })
  });
  assert.strictEqual(internMutateRes.status, 403, 'Intern is forbidden from editing card configs');
  console.log('✅ Intern is strictly blocked from editing ID card designs (403 Forbidden)');

  // Admin updating card configs: Allowed (200)
  console.log('\n[3] Testing Admin Design Customization Persistence for All Users...');
  const customConfigPayload = {
    intern: {
      title: 'ENGINEERING FELLOW (CUSTOM)',
      division: 'Product Engineering Directorate',
      portalAccent: '#06b6d4',
      signatureTitle: 'Director of Engineering',
      signatureName: 'Dr. J. Owis',
      returnAddress: 'Jowis Studio Headquarters, Lagos, Nigeria',
      supportHotline: '+234 800-JOWIS-HQ'
    }
  };

  const adminUpdateRes = await fetch(`${BASE_URL}/system/id-card-config`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ config: customConfigPayload })
  });
  const adminUpdateData = await adminUpdateRes.json();
  assert.strictEqual(adminUpdateRes.status, 200, 'Admin can update ID card configuration');
  assert.strictEqual(adminUpdateData.success, true);
  console.log('✅ Admin successfully saved custom ID card designs');

  // Now verify that the intern receives the updated design!
  const internRefreshedConfigRes = await fetch(`${BASE_URL}/system/id-card-config`, {
    headers: { Authorization: `Bearer ${internToken}` }
  });
  const internRefreshedConfig = await internRefreshedConfigRes.json();
  assert.strictEqual(internRefreshedConfig.data.intern.title, 'ENGINEERING FELLOW (CUSTOM)');
  assert.strictEqual(internRefreshedConfig.data.intern.division, 'Product Engineering Directorate');
  console.log('✅ Verified: Intern automatically inherits the updated design saved by Admin!');

  console.log('\n🎉 ALL ID CARD VERIFICATION AND MANAGEMENT TESTS PASSED!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
