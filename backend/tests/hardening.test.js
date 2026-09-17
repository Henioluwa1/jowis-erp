import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import { evaluateAttendance, calculateExpectedWorkingDays, getLagosNow } from '../src/utils/timezone.js';
import http from 'http';

const server = http.createServer(app);

async function runHardeningTests() {
  const PORT = 5066;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`=======================================================`);
  console.log(`🛡️  JOWIS STUDIO ERP — PHASE 1 HARDENING TEST SUITE`);
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
    // 1. Authoritative Cutoff Rules (08:59:59 vs 09:00:00 vs 09:17:00)
    // -------------------------------------------------------------
    console.log('🔹 TEST GROUP 1: Attendance Cutoff Rules & Late Minute Precision');
    {
      const p1 = evaluateAttendance('08:59:59', '09:00:00');
      assert(p1.status === 'PRESENT' && p1.lateMinutes === 0, '08:59:59 must be PRESENT with 0 late minutes');

      const l0 = evaluateAttendance('09:00:00', '09:00:00');
      assert(l0.status === 'LATE' && l0.lateMinutes === 0, '09:00:00 must be LATE with 0 late minutes');

      const l1 = evaluateAttendance('09:01:00', '09:00:00');
      assert(l1.status === 'LATE' && l1.lateMinutes === 1, '09:01:00 must be LATE with 1 late minute');

      const l17 = evaluateAttendance('09:17:00', '09:00:00');
      assert(l17.status === 'LATE' && l17.lateMinutes === 17, '09:17:00 must be LATE with 17 late minutes');

      const customCutoff = evaluateAttendance('09:29:59', '09:30:00');
      assert(customCutoff.status === 'PRESENT', '09:29:59 with 09:30:00 cutoff must be PRESENT');
    }

    // -------------------------------------------------------------
    // 2. Working Days & Expected Attendance Calculation
    // -------------------------------------------------------------
    console.log('\n🔹 TEST GROUP 2: Expected Attendance Days Formula & Holiday Deductions');
    {
      const workingDays = { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
      
      // 2026-09-07 (Mon) to 2026-09-11 (Fri) = 5 working days
      const daysMonToFri = calculateExpectedWorkingDays('2026-09-07', '2026-09-11', workingDays, new Set()).expectedDays;
      assert(daysMonToFri === 5, 'Mon to Fri without holidays must equal 5 expected days');

      // 2026-09-07 (Mon) to 2026-09-13 (Sun) = 5 working days (Sat & Sun excluded)
      const daysWithWeekend = calculateExpectedWorkingDays('2026-09-07', '2026-09-13', workingDays, new Set()).expectedDays;
      assert(daysWithWeekend === 5, 'Full 7-day week must exclude Sat/Sun and equal 5 expected days');

      // Add a holiday on Wednesday 2026-09-09
      const holidaySet = new Set(['2026-09-09']);
      const daysWithHoliday = calculateExpectedWorkingDays('2026-09-07', '2026-09-11', workingDays, holidaySet).expectedDays;
      assert(daysWithHoliday === 4, 'Mon to Fri with 1 holiday on Wed must equal 4 expected days');

      // Holiday falling on Saturday should NOT reduce working days
      const holidayOnSat = new Set(['2026-09-12']);
      const daysSatHoliday = calculateExpectedWorkingDays('2026-09-07', '2026-09-13', workingDays, holidayOnSat).expectedDays;
      assert(daysSatHoliday === 5, 'Holiday falling on a weekend must not reduce expected working days');
    }

    // -------------------------------------------------------------
    // 3. User Authentication & Token Acquisition
    // -------------------------------------------------------------
    console.log('\n🔹 TEST GROUP 3: Authentication & Token Issuance');
    let adminToken, intern1Token, intern2Token, intern1Id, intern2Id;
    {
      const adminRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
      });
      const adminData = await adminRes.json();
      assert(adminData.success && adminData.token, 'Super Admin login must succeed');
      adminToken = adminData.token;

      const intern1Res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
      });
      const intern1Data = await intern1Res.json();
      assert(intern1Data.success && intern1Data.token, 'Intern 1 (David Adeleke) login must succeed');
      intern1Token = intern1Data.token;
      intern1Id = intern1Data.user.internProfileId;

      const intern2Res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'intern.zainab@jowis.com', password: 'Intern@12345' })
      });
      const intern2Data = await intern2Res.json();
      assert(intern2Data.success && intern2Data.token, 'Intern 2 (Zainab Bello) login must succeed');
      intern2Token = intern2Data.token;
      intern2Id = intern2Data.user.internProfileId;
    }

    // -------------------------------------------------------------
    // 4. Server Time Security & Anti-Spoofing Verification
    // -------------------------------------------------------------
    console.log('\n🔹 TEST GROUP 4: Server Time Security & Anti-Spoofing');
    {
      // Clean up today's test record for intern 2 if exists
      const lagosNow = getLagosNow();
      await query('DELETE FROM attendance WHERE intern_id = ? AND attendance_date = ?', [intern2Id, lagosNow.lagosDate]);

      // Attempt spoofed check-in with false client parameters
      const spoofedPayload = {
        check_in_time: '08:00:00',
        status: 'PRESENT',
        late_minutes: 0,
        attendance_date: '2020-01-01'
      };

      const checkInRes = await fetch(`${baseUrl}/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern2Token}`
        },
        body: JSON.stringify(spoofedPayload)
      });
      const checkInData = await checkInRes.json();
      assert(checkInRes.status === 201 || checkInRes.status === 200, 'Check-in request processed');
      assert(checkInData.success === true, 'Check-in returned success');

      // Verify the record in DB: check_in_time and attendance_date MUST reflect Lagos server time, NOT spoofed values
      const [savedRecord] = await query(
        'SELECT * FROM attendance WHERE intern_id = ? AND attendance_date = ?',
        [intern2Id, lagosNow.lagosDate]
      );
      assert(!!savedRecord, 'Record saved under authoritative Lagos server date');
      assert(savedRecord.attendance_date !== '2020-01-01', 'Database did NOT accept client-spoofed attendance_date');
      assert(savedRecord.check_in_time !== '08:00:00', 'Database did NOT accept client-spoofed check_in_time (08:00:00)');
      console.log(`    ℹ️ Authoritative server time recorded: ${savedRecord.check_in_time}, Status: ${savedRecord.status}, Late min: ${savedRecord.late_minutes}`);
    }

    // -------------------------------------------------------------
    // 5. Duplicate Check-in Prevention (Idempotency / Single daily record)
    // -------------------------------------------------------------
    console.log('\n🔹 TEST GROUP 5: Duplicate Check-In Rejection');
    {
      const dupRes = await fetch(`${baseUrl}/attendance/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern2Token}`
        },
        body: JSON.stringify({})
      });
      const dupData = await dupRes.json();
      assert(dupRes.status === 400, 'Duplicate check-in attempt on same date must return HTTP 400 Bad Request');
      assert(dupData.message && dupData.message.toLowerCase().includes('already'), 'Duplicate response message clarifies attendance already recorded');
    }

    // -------------------------------------------------------------
    // 6. Strict RBAC & Horizontal Ownership Security
    // -------------------------------------------------------------
    console.log('\n🔹 TEST GROUP 6: RBAC Authorization & Ownership Isolation');
    {
      // Intern attempting Admin manual attendance
      const adminManualRes = await fetch(`${baseUrl}/attendance/admin/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        },
        body: JSON.stringify({ intern_id: intern2Id, attendance_date: '2026-09-17', status: 'PRESENT' })
      });
      assert(adminManualRes.status === 403, 'Intern calling Admin manual attendance must return 403 Forbidden');

      // Intern attempting Admin register
      const adminRegRes = await fetch(`${baseUrl}/attendance/admin/register`, {
        headers: { 'Authorization': `Bearer ${intern1Token}` }
      });
      assert(adminRegRes.status === 403, 'Intern accessing Admin attendance register must return 403 Forbidden');

      // Intern attempting to close attendance
      const adminCloseRes = await fetch(`${baseUrl}/attendance/admin/close-day`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        }
      });
      assert(adminCloseRes.status === 403, 'Intern calling close-day must return 403 Forbidden');

      // Intern attempting to modify system settings
      const settingsRes = await fetch(`${baseUrl}/system/settings/working_days`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        },
        body: JSON.stringify({ value: 'test' })
      });
      assert(settingsRes.status === 403, 'Intern modifying system settings must return 403 Forbidden');

      // Intern 1 attempting to view Intern 2 profile
      const crossProfileRes = await fetch(`${baseUrl}/interns/${intern2Id}`, {
        headers: { 'Authorization': `Bearer ${intern1Token}` }
      });
      assert(crossProfileRes.status === 403, 'Intern 1 accessing Intern 2 profile must return 403 Forbidden (Strict Ownership)');
    }

    // -------------------------------------------------------------
    // 7. Company Holidays CRUD & Expected Attendance Dynamic Impact
    // -------------------------------------------------------------
    console.log('\n🔹 TEST GROUP 7: Company Holidays Architecture & Dynamic Rate Impact');
    {
      const testHolidayDate = '2026-11-20';
      // Clean up if exists
      await query('DELETE FROM company_holidays WHERE holiday_date = ?', [testHolidayDate]);

      // Intern attempting to create holiday must be rejected (403)
      const internCreateHoliday = await fetch(`${baseUrl}/attendance/holidays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${intern1Token}`
        },
        body: JSON.stringify({ holiday_date: testHolidayDate, name: 'Malicious Intern Holiday' })
      });
      assert(internCreateHoliday.status === 403, 'Intern creating company holiday must be rejected (403 Forbidden)');

      // Admin creating holiday
      const adminCreateHoliday = await fetch(`${baseUrl}/attendance/holidays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ holiday_date: testHolidayDate, name: 'Jowis Innovation Day', description: 'Annual hackathon holiday' })
      });
      const createData = await adminCreateHoliday.json();
      assert(adminCreateHoliday.status === 201 && createData.success, 'Admin creating company holiday must succeed (201 Created)');
      const holidayId = createData.data.id;

      // Fetch holidays list
      const getHolidaysRes = await fetch(`${baseUrl}/attendance/holidays`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const holidaysData = await getHolidaysRes.json();
      assert(holidaysData.success && holidaysData.data.some(h => h.holiday_date.startsWith(testHolidayDate)), 'Holiday appears in active holidays list');

      // Admin deleting holiday
      const deleteRes = await fetch(`${baseUrl}/attendance/holidays/${holidayId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(deleteRes.status === 200, 'Admin deleting company holiday must succeed (200 OK)');
    }

    // -------------------------------------------------------------
    // 8. Admin Attendance Register & Close Day Action
    // -------------------------------------------------------------
    console.log('\n🔹 TEST GROUP 8: Admin Attendance Register & Daily Close Verification');
    {
      const registerRes = await fetch(`${baseUrl}/attendance/admin/register?page=1&limit=10`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const regData = await registerRes.json();
      assert(regData.success && Array.isArray(regData.data), 'Admin attendance register returns paginated records');

      // Test Close-day attendance
      const closeRes = await fetch(`${baseUrl}/attendance/admin/close-day`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({})
      });
      const closeData = await closeRes.json();
      assert(closeRes.status === 200 && closeData.success, 'Admin close-day attendance executed successfully');
      console.log(`    ℹ️ Close day result: ${closeData.message}, marked absent count: ${closeData.markedAbsentCount}`);
    }

    console.log('\n=======================================================');
    console.log(`🎯 HARDENING AUDIT COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('\n💥 Test suite execution error:', err);
    testFailed++;
  } finally {
    server.close();
    await pool.end();
    process.exit(testFailed === 0 ? 0 : 1);
  }
}

runHardeningTests();
