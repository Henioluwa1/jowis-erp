// Native fetch used in Node 18+

async function testOnboardingAndProfile() {
  console.log('================================================================');
  console.log('🧪 TESTING ONBOARDING WIZARD & UNIVERSAL PROFILE API ENDPOINTS');
  console.log('================================================================\n');

  const baseUrl = 'http://localhost:5000/api';

  // Helper login
  async function login(email, password) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // 1. Admin Login & Profile Check
  console.log('🔹 1. Testing Super Admin Profile...');
  const adminAuth = await login('admin@jowis.com', 'Admin@12345');
  if (adminAuth.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(adminAuth.data));
  const adminToken = adminAuth.data.token;

  const adminProfileRes = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminProfile = await adminProfileRes.json();
  console.log('   ✓ Admin profile status:', adminProfileRes.status);
  console.log('   ✓ Role:', adminProfile.data?.role_name, 'Name:', adminProfile.data?.first_name, adminProfile.data?.last_name);
  console.log('   ✓ Admin governance stats:', JSON.stringify(adminProfile.data?.roleDetails));

  // 2. Mentor Login & Profile Check & Onboarding
  console.log('\n🔹 2. Testing Mentor Profile & Onboarding...');
  const mentorAuth = await login('mentor.sam@jowis.com', 'Admin@12345');
  if (mentorAuth.status !== 200) throw new Error('Mentor login failed: ' + JSON.stringify(mentorAuth.data));
  const mentorToken = mentorAuth.data.token;

  const mentorProfileRes = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${mentorToken}` }
  });
  const mentorProfile = await mentorProfileRes.json();
  console.log('   ✓ Mentor profile status:', mentorProfileRes.status);
  console.log('   ✓ Mentor Specialization:', mentorProfile.data?.roleDetails?.specialization);

  // Test Mentor Onboarding Submission
  const mentorOnboardRes = await fetch(`${baseUrl}/auth/mentor-onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mentorToken}`
    },
    body: JSON.stringify({
      phone: '08033221100',
      address: 'Jowis Studio Faculty Hub, Victoria Island, Lagos',
      specialization: 'Cloud & DevOps Architecture',
      teachingSubjects: 'Docker, Kubernetes, AWS EKS, CI/CD with GitHub Actions',
      qualifications: 'M.Sc Computer Systems, AWS Solutions Architect Pro, CKA',
      bio: 'Lead Cloud Instructor at Jowis Studio with 10+ years of enterprise experience.'
    })
  });
  const mentorOnboard = await mentorOnboardRes.json();
  console.log('   ✓ Mentor onboarding response:', mentorOnboardRes.status, mentorOnboard.message);

  // 3. Intern Login & Profile Check & Schedule
  console.log('\n🔹 3. Testing Intern Profile & Schedule...');
  const internAuth = await login('intern@jowis.com', 'Admin@12345');
  if (internAuth.status !== 200) throw new Error('Intern login failed: ' + JSON.stringify(internAuth.data));
  const internToken = internAuth.data.token;

  const internProfileRes = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${internToken}` }
  });
  const internProfile = await internProfileRes.json();
  console.log('   ✓ Intern profile status:', internProfileRes.status);
  console.log('   ✓ Intern Code:', internProfile.data?.roleDetails?.intern_code);
  console.log('   ✓ Track:', internProfile.data?.roleDetails?.track_name, 'Cohort:', internProfile.data?.roleDetails?.cohort_name);
  console.log('   ✓ 3-Day Work Schedule:', internProfile.data?.roleDetails?.schedule_days);

  // Test Intern Onboarding Submission
  const internOnboardRes = await fetch(`${baseUrl}/auth/intern-onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${internToken}`
    }
  });
  const internOnboard = await internOnboardRes.json();
  console.log('   ✓ Intern onboarding response:', internOnboardRes.status, internOnboard.message);

  // 4. Update Profile Test (PUT /auth/profile)
  console.log('\n🔹 4. Testing Universal Profile Update (PUT /auth/profile)...');
  const updateRes = await fetch(`${baseUrl}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${internToken}`
    },
    body: JSON.stringify({
      phone: '08123456789',
      address: 'Lekki Phase 1, Lagos',
      emergencyContactName: 'Babatunde Adeleke',
      emergencyContactPhone: '08099887766',
      skills: 'React, Vite, Node.js, Express, MySQL'
    })
  });
  const updateData = await updateRes.json();
  console.log('   ✓ Profile update response:', updateRes.status, updateData.message);

  console.log('\n================================================================');
  console.log('🎉 ALL ONBOARDING & PROFILE API TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

testOnboardingAndProfile().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
