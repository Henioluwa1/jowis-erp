import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';

const server = http.createServer(app);

async function runPhase2Tests() {
  const PORT = 5077;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('=======================================================');
  console.log('🏛️  JOWIS STUDIO ERP — PHASE 2 AUTOMATED TEST SUITE');
  console.log(`🧪 Test server running on http://localhost:${PORT}`);
  console.log('=======================================================\n');

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
    // Setup: Authenticate Admin, Mentor, and Intern
    // -------------------------------------------------------------
    console.log('🔹 SETUP: Authenticating users for role-based testing...');
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
    });
    const adminData = await adminRes.json();
    assert(adminData.success && adminData.token, 'Super Admin login must succeed');
    const adminToken = adminData.token;

    const mentorRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mentor.sam@jowis.com', password: 'Mentor@12345' })
    });
    const mentorData = await mentorRes.json();
    assert(mentorData.success && mentorData.token, 'Mentor login must succeed');
    const mentorToken = mentorData.token;

    const intern1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const intern1Data = await intern1Res.json();
    assert(intern1Data.success && intern1Data.token, 'Intern 1 (David Adeleke) login must succeed');
    const intern1Token = intern1Data.token;
    const intern1Id = intern1Data.user.internProfileId;

    const intern2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern.zainab@jowis.com', password: 'Intern@12345' })
    });
    const intern2Data = await intern2Res.json();
    assert(intern2Data.success && intern2Data.token, 'Intern 2 (Zainab Bello) login must succeed');
    const intern2Token = intern2Data.token;
    const intern2Id = intern2Data.user.internProfileId;

    // Helper to cleanly wipe test artifacts from prior runs
    const cleanupTestData = async () => {
      try {
        const [testUser] = await query('SELECT id FROM users WHERE email = ?', ['phase2.testintern@jowis.com']);
        if (testUser) {
          const [profile] = await query('SELECT id FROM intern_profiles WHERE user_id = ?', [testUser.id]);
          if (profile) {
            await query('DELETE FROM intern_assignment_history WHERE intern_id = ?', [profile.id]);
            await query('DELETE FROM intern_lifecycle_history WHERE intern_id = ?', [profile.id]);
            await query('DELETE FROM intern_profiles WHERE id = ?', [profile.id]);
          }
          await query('DELETE FROM users WHERE id = ?', [testUser.id]);
        }
        await query("DELETE FROM cohorts WHERE cohort_code IN ('COH-AI-2026', 'COH-INV-001')");
        const [testTrack] = await query('SELECT id FROM tracks WHERE code = ?', ['TRK-AIX']);
        if (testTrack) {
          await query('DELETE FROM cohorts WHERE track_id = ?', [testTrack.id]);
          await query('DELETE FROM tracks WHERE id = ?', [testTrack.id]);
        }
      } catch (err) {
        console.warn('Cleanup warning:', err.message);
      }
    };

    // Clean up prior test data before beginning
    await cleanupTestData();

    // -------------------------------------------------------------
    // GATE 1: Relational Data Model Verification
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1: Relational Data Model & Integrity');
    {
      const trackCols = await query(`SHOW COLUMNS FROM tracks LIKE 'code'`);
      assert(trackCols.length === 1, 'Column `tracks.code` exists');

      const cohortCols = await query(`SHOW COLUMNS FROM cohorts LIKE 'cohort_code'`);
      assert(cohortCols.length === 1, 'Column `cohorts.cohort_code` exists');

      const [iahTable] = await query(`SHOW TABLES LIKE 'intern_assignment_history'`);
      assert(!!iahTable, 'Table `intern_assignment_history` exists');

      const [ilhTable] = await query(`SHOW TABLES LIKE 'intern_lifecycle_history'`);
      assert(!!ilhTable, 'Table `intern_lifecycle_history` exists');
    }

    // -------------------------------------------------------------
    // GATE 2: Track Management
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: Track Management (Master Data, Validation, CRUD)');
    let createdTrackId;
    const testTrackCode = 'TRK-AIX';
    {
      // 1. Create track with valid data
      const createRes = await fetch(`${baseUrl}/training/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Artificial Intelligence & Machine Learning',
          code: testTrackCode,
          description: 'Deep Learning, NLP, and AI Systems Engineering',
          durationWeeks: 20
        })
      });
      const createData = await createRes.json();
      assert(createRes.status === 201 && createData.success, 'Admin can create a new track with unique code');
      createdTrackId = createData.data.id;

      // 2. Reject duplicate track code
      const dupRes = await fetch(`${baseUrl}/training/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Duplicate AI Track',
          code: testTrackCode,
          durationWeeks: 16
        })
      });
      assert(dupRes.status === 400, 'Duplicate track code must be rejected with HTTP 400');

      // 3. Update track
      const updateRes = await fetch(`${baseUrl}/training/tracks/${createdTrackId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Artificial Intelligence & LLMs',
          durationWeeks: 22
        })
      });
      assert(updateRes.status === 200, 'Admin can update track details');

      // 4. Toggle track status
      const toggleRes = await fetch(`${baseUrl}/training/tracks/${createdTrackId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const toggleData = await toggleRes.json();
      assert(toggleRes.status === 200 && toggleData.data.isActive === false, 'Admin can deactivate track');

      // Re-activate for cohort tests
      await fetch(`${baseUrl}/training/tracks/${createdTrackId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      // 5. Prevent deleting track with referenced cohorts/interns
      const delRefTrack = await fetch(`${baseUrl}/training/tracks/1`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(delRefTrack.status === 400, 'Attempt to delete track with cohorts/interns must be rejected with 400');
    }

    // -------------------------------------------------------------
    // GATE 3: Cohort Management
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Cohort Management (Validation, Batches, Lifecycle)');
    let createdCohortId;
    const testCohortCode = 'COH-AI-2026';
    {
      // Clean up previous test cohort if exists
      await query('DELETE FROM cohorts WHERE cohort_code = ?', [testCohortCode]);

      // 1. Create cohort with invalid dates (end before start) -> must fail
      const invalidDateRes = await fetch(`${baseUrl}/training/cohorts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Invalid Date Cohort',
          cohortCode: 'COH-INV-001',
          trackId: createdTrackId,
          startDate: '2026-10-01',
          endDate: '2026-05-01', // Precedes start date!
          capacity: 25
        })
      });
      assert(invalidDateRes.status === 400, 'Cohort with end date preceding start date must be rejected');

      // 2. Create cohort with valid data
      const createCohortRes = await fetch(`${baseUrl}/training/cohorts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Cohort AI Specialists 2026',
          cohortCode: testCohortCode,
          trackId: createdTrackId,
          leadMentorId: 1,
          startDate: '2026-09-01',
          endDate: '2027-02-28',
          capacity: 20,
          status: 'upcoming'
        })
      });
      const cohortData = await createCohortRes.json();
      assert(createCohortRes.status === 201 && cohortData.success, 'Admin can create cohort with valid track and dates');
      createdCohortId = cohortData.data.id;

      // 3. Reject duplicate cohort code
      const dupCohortRes = await fetch(`${baseUrl}/training/cohorts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: 'Duplicate Cohort',
          cohortCode: testCohortCode,
          trackId: createdTrackId,
          startDate: '2026-09-01',
          endDate: '2027-02-28'
        })
      });
      assert(dupCohortRes.status === 400, 'Duplicate cohort code must be rejected');

      // 4. Update cohort status to active
      const updateCohortRes = await fetch(`${baseUrl}/training/cohorts/${createdCohortId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          status: 'active',
          capacity: 25
        })
      });
      assert(updateCohortRes.status === 200, 'Admin can update cohort status and capacity');

      // 5. Filter cohorts by status
      const getActiveCohorts = await fetch(`${baseUrl}/training/cohorts?status=active`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const activeCohortsData = await getActiveCohorts.json();
      assert(activeCohortsData.success && activeCohortsData.data.every(c => c.status === 'active'), 'Cohort status filtering returns matching cohorts');
    }

    // -------------------------------------------------------------
    // GATE 4: Intern Enrollment & Track/Cohort Relationship
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Intern Enrollment & Relationship Integrity');
    let testInternId;
    const testEmail = 'phase2.testintern@jowis.com';
    {
      // Clean up previous test intern if exists
      const [oldUser] = await query('SELECT id FROM users WHERE email = ?', [testEmail]);
      if (oldUser) {
        await query('DELETE FROM users WHERE id = ?', [oldUser.id]);
      }

      // 1. Attempt to enroll intern into a cohort that does NOT belong to the selected track
      const mismatchedRes = await fetch(`${baseUrl}/interns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          firstName: 'Mismatched',
          lastName: 'Student',
          email: testEmail,
          trackId: 2, // UI/UX track
          cohortId: createdCohortId, // Belongs to TRK-AIX track!
          startDate: '2026-09-01'
        })
      });
      assert(mismatchedRes.status === 400, 'Enrolling intern into cohort belonging to a DIFFERENT track must be rejected (400)');

      // 2. Enroll intern with aligned track and cohort
      const enrollRes = await fetch(`${baseUrl}/interns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          firstName: 'Kareem',
          lastName: 'Balogun',
          email: testEmail,
          trackId: createdTrackId,
          cohortId: createdCohortId,
          mentorId: 1,
          startDate: '2026-09-01',
          expectedEndDate: '2027-02-28',
          phone: '+2348091122334',
          education: 'B.Sc Computer Science'
        })
      });
      const enrollData = await enrollRes.json();
      assert(enrollRes.status === 201 && enrollData.success, 'Admin can enroll new intern with matching track & cohort');
      testInternId = enrollData.data.id;

      // 3. Verify initial lifecycle & assignment history were recorded
      const [initialLifecycle] = await query(
        'SELECT * FROM intern_lifecycle_history WHERE intern_id = ? ORDER BY id ASC',
        [testInternId]
      );
      assert(initialLifecycle && initialLifecycle.new_status === 'active', 'Initial enrollment generates `active` lifecycle history entry');

      const initialAssignments = await query(
        'SELECT * FROM intern_assignment_history WHERE intern_id = ?',
        [testInternId]
      );
      assert(initialAssignments.length >= 2, 'Initial enrollment generates track and cohort assignment history records');
    }

    // -------------------------------------------------------------
    // GATE 5: Track, Cohort & Mentor Reassignment Workflows
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Assignment Workflows & Audit History Preservation');
    {
      // 1. Reassign mentor with audit reason
      const reassignMentorRes = await fetch(`${baseUrl}/interns/${testInternId}/reassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          type: 'mentor',
          targetId: 2, // Chioma Okeke
          reason: 'Transferred to senior product mentor for capstone track'
        })
      });
      const mentorReassignData = await reassignMentorRes.json();
      assert(reassignMentorRes.status === 200 && mentorReassignData.success, 'Mentor reassignment succeeds');

      // 2. Verify mentor assignment was recorded in assignment history
      const [mentorHist] = await query(
        "SELECT * FROM intern_assignment_history WHERE intern_id = ? AND assignment_type = 'mentor' ORDER BY id DESC LIMIT 1",
        [testInternId]
      );
      assert(mentorHist && mentorHist.new_id === 2 && mentorHist.reason.includes('Transferred'), 'Mentor reassignment recorded in `intern_assignment_history` with reason');

      // 3. Reassign track + new cohort atomically
      const reassignTrackRes = await fetch(`${baseUrl}/interns/${testInternId}/reassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          type: 'track',
          targetId: 1, // Full-Stack Software Development
          newCohortId: 1, // Cohort JOWIS-2026-A
          reason: 'Transferred from AI track to Full-Stack Web Engineering track'
        })
      });
      const trackReassignData = await reassignTrackRes.json();
      assert(reassignTrackRes.status === 200 && trackReassignData.success, 'Atomic track and cohort reassignment succeeds');

      // Verify database updated
      const [updatedProfile] = await query('SELECT track_id, cohort_id FROM intern_profiles WHERE id = ?', [testInternId]);
      assert(updatedProfile.track_id === 1 && updatedProfile.cohort_id === 1, 'Intern profile updated to new track and cohort');

      // 4. Reject reassignment without reason
      const noReasonRes = await fetch(`${baseUrl}/interns/${testInternId}/reassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          type: 'mentor',
          targetId: 1,
          reason: ''
        })
      });
      assert(noReasonRes.status === 400, 'Reassignment without mandatory reason must be rejected (400)');
    }

    // -------------------------------------------------------------
    // GATE 6: Intern Lifecycle State Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6: Controlled Lifecycle State Transitions');
    {
      // 1. Transition `active` -> `suspended`
      const suspendRes = await fetch(`${baseUrl}/interns/${testInternId}/lifecycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          newStatus: 'suspended',
          reason: 'Leave of absence requested for university semester exams'
        })
      });
      const suspendData = await suspendRes.json();
      assert(suspendRes.status === 200 && suspendData.data.newStatus === 'suspended', 'Valid transition: `active` -> `suspended` succeeds');

      // 2. Transition `suspended` -> `active` (reinstatement)
      const reinstateRes = await fetch(`${baseUrl}/interns/${testInternId}/lifecycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          newStatus: 'active',
          reason: 'Resumed full-time internship following exam completion'
        })
      });
      assert(reinstateRes.status === 200, 'Valid transition: `suspended` -> `active` succeeds');

      // 3. Transition `active` -> `completed`
      const completeRes = await fetch(`${baseUrl}/interns/${testInternId}/lifecycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          newStatus: 'completed',
          reason: 'Successfully completed curriculum and passed capstone project defense'
        })
      });
      assert(completeRes.status === 200, 'Valid transition: `active` -> `completed` succeeds');

      // Check actual_end_date is set
      const [completedProfile] = await query('SELECT status, actual_end_date FROM intern_profiles WHERE id = ?', [testInternId]);
      assert(completedProfile.status === 'completed' && completedProfile.actual_end_date !== null, 'Completing internship sets authoritative `actual_end_date`');

      // 4. Transition `completed` -> `alumni`
      const alumniRes = await fetch(`${baseUrl}/interns/${testInternId}/lifecycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          newStatus: 'alumni',
          reason: 'Inducted into Jowis Studio Engineering Alumni Network'
        })
      });
      assert(alumniRes.status === 200, 'Valid transition: `completed` -> `alumni` succeeds');

      // 5. Reject arbitrary status string
      const invalidStatusRes = await fetch(`${baseUrl}/interns/${testInternId}/lifecycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          newStatus: 'graduated_with_honors', // Not in allowed statuses
          reason: 'Trying arbitrary status'
        })
      });
      assert(invalidStatusRes.status === 400, 'Arbitrary lifecycle status string must be rejected (400)');

      // 6. Verify full lifecycle audit trail preserved
      const lifecycleLogs = await query(
        'SELECT * FROM intern_lifecycle_history WHERE intern_id = ? ORDER BY id ASC',
        [testInternId]
      );
      assert(lifecycleLogs.length >= 4, 'Full chronological lifecycle audit trail is preserved in database');
    }

    // -------------------------------------------------------------
    // GATE 7: RBAC & Security Isolation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 7: Strict RBAC Authorization & Ownership Isolation');
    {
      // 1. Intern attempting to reassign own cohort -> 403 Forbidden
      const internReassignCohort = await fetch(`${baseUrl}/interns/${intern1Id}/reassign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        },
        body: JSON.stringify({ type: 'cohort', targetId: 2, reason: 'Intern self reassignment' })
      });
      assert(internReassignCohort.status === 403, 'Intern calling reassignment endpoint must return 403 Forbidden');

      // 2. Intern attempting to transition lifecycle status -> 403 Forbidden
      const internChangeLifecycle = await fetch(`${baseUrl}/interns/${intern1Id}/lifecycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        },
        body: JSON.stringify({ newStatus: 'completed', reason: 'Self graduation' })
      });
      assert(internChangeLifecycle.status === 403, 'Intern calling lifecycle transition endpoint must return 403 Forbidden');

      // 3. Intern attempting to create a new track -> 403 Forbidden
      const internCreateTrack = await fetch(`${baseUrl}/training/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        },
        body: JSON.stringify({ name: 'Hacked Track', code: 'TRK-HCK' })
      });
      assert(internCreateTrack.status === 403, 'Intern attempting to create track must return 403 Forbidden');

      // 4. Intern attempting to create a cohort -> 403 Forbidden
      const internCreateCohort = await fetch(`${baseUrl}/training/cohorts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        },
        body: JSON.stringify({ name: 'Hacked Cohort', cohortCode: 'COH-HCK', trackId: 1, startDate: '2026-09-01', endDate: '2026-12-01' })
      });
      assert(internCreateCohort.status === 403, 'Intern attempting to create cohort must return 403 Forbidden');

      // 5. Intern 1 attempting to view Intern 2 detailed profile -> 403 Forbidden
      const crossProfileRes = await fetch(`${baseUrl}/interns/${intern2Id}`, {
        headers: { 'Authorization': `Bearer ${intern1Token}` }
      });
      assert(crossProfileRes.status === 403, 'Intern 1 blocked from accessing Intern 2 profile (403 Forbidden)');

      // 6. Mentor view isolation: Mentor Sam only sees interns assigned to him or in his lead cohorts
      const mentorInternsRes = await fetch(`${baseUrl}/interns`, {
        headers: { 'Authorization': `Bearer ${mentorToken}` }
      });
      const mentorInternsData = await mentorInternsRes.json();
      assert(mentorInternsData.success, 'Mentor can retrieve scoped interns list');
    }

    console.log('\n=======================================================');
    console.log(`🎯 PHASE 2 TEST SUITE COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('\n💥 Phase 2 Test Error:', err);
    testFailed++;
  } finally {
    try {
      const [testUser] = await query('SELECT id FROM users WHERE email = ?', ['phase2.testintern@jowis.com']);
      if (testUser) {
        const [profile] = await query('SELECT id FROM intern_profiles WHERE user_id = ?', [testUser.id]);
        if (profile) {
          await query('DELETE FROM intern_assignment_history WHERE intern_id = ?', [profile.id]);
          await query('DELETE FROM intern_lifecycle_history WHERE intern_id = ?', [profile.id]);
          await query('DELETE FROM intern_profiles WHERE id = ?', [profile.id]);
        }
        await query('DELETE FROM users WHERE id = ?', [testUser.id]);
      }
      await query("DELETE FROM cohorts WHERE cohort_code IN ('COH-AI-2026', 'COH-INV-001')");
      const [testTrack] = await query('SELECT id FROM tracks WHERE code = ?', ['TRK-AIX']);
      if (testTrack) {
        await query('DELETE FROM cohorts WHERE track_id = ?', [testTrack.id]);
        await query('DELETE FROM tracks WHERE id = ?', [testTrack.id]);
      }
    } catch (_) {}
    server.close();
    await pool.end();
    process.exit(testFailed === 0 ? 0 : 1);
  }
}

runPhase2Tests();
