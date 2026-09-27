import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateSchedule,
  parseScheduleDays,
  calculateAffectedScheduledDays,
  isScheduledDay,
  COMPULSORY_DAY
} from '../src/utils/scheduleHelper.js';
import { documentStorageDir } from '../src/utils/documentUpload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const server = http.createServer(app);

async function runPhase13Tests() {
  const PORT = 5098;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`================================================================`);
  console.log(`⚡  JOWIS STUDIO ERP — PHASE 13 AUTOMATED TEST SUITE`);
  console.log(`📅  INTERN 3-DAY SCHEDULE, PERMISSIONS WORKFLOW & EXPORT AUDIT`);
  console.log(`🧪  Test server running on http://localhost:${PORT}`);
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
    async function login(email, password) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return { status: res.status, data };
    }

    // -------------------------------------------------------------
    // SECTION 1: UNIT TESTS - ATTENDANCE SCHEDULE HELPER
    // -------------------------------------------------------------
    console.log('🔹 SECTION 1: Intern Attendance Schedule Helper Rules...');
    {
      // 1. Valid 3-day schedule with compulsory Monday
      const valid = validateSchedule(['monday', 'tuesday', 'thursday']);
      assert(valid.length === 3, 'Valid schedule has exactly 3 days');
      assert(valid[0] === 'monday', 'First day is canonical Monday');
      assert(valid.includes('tuesday') && valid.includes('thursday'), 'Includes chosen optional days');

      // 2. Reject schedule without compulsory Monday
      let rejectedNoMonday = false;
      try {
        validateSchedule(['tuesday', 'wednesday', 'thursday']);
      } catch (e) {
        rejectedNoMonday = true;
      }
      assert(rejectedNoMonday, 'Schedule without compulsory Monday is strictly rejected');

      // 3. Reject schedule with more than 3 days
      let rejectedTooMany = false;
      try {
        validateSchedule(['monday', 'tuesday', 'wednesday', 'thursday']);
      } catch (e) {
        rejectedTooMany = true;
      }
      assert(rejectedTooMany, 'Schedule with more than 3 days is strictly rejected');

      // 4. Reject schedule with fewer than 3 days
      let rejectedTooFew = false;
      try {
        validateSchedule(['monday', 'tuesday']);
      } catch (e) {
        rejectedTooFew = true;
      }
      assert(rejectedTooFew, 'Schedule with fewer than 3 days is strictly rejected');

      // 5. Reject weekends in schedule
      let rejectedWeekend = false;
      try {
        validateSchedule(['monday', 'tuesday', 'saturday']);
      } catch (e) {
        rejectedWeekend = true;
      }
      assert(rejectedWeekend, 'Schedule containing weekend day is strictly rejected');

      // 6. Test isScheduledDay helper
      assert(isScheduledDay('2026-09-28', ['monday', 'tuesday', 'thursday']) === true, '2026-09-28 (Monday) is scheduled');
      assert(isScheduledDay('2026-09-30', ['monday', 'tuesday', 'thursday']) === false, '2026-09-30 (Wednesday) is NOT scheduled');
    }

    // -------------------------------------------------------------
    // SECTION 2: UNIT TESTS - AFFECTED SCHEDULED WORKING DAYS CALCULATION
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 2: Affected Scheduled Working Days Calculation...');
    {
      const schedule = ['monday', 'tuesday', 'thursday'];
      // Range: 2026-09-28 (Mon) to 2026-10-02 (Fri) - 5 calendar weekdays
      // Scheduled days: Mon 28, Tue 29, Thu 01 = 3 days
      const { count, dates } = calculateAffectedScheduledDays('2026-09-28', '2026-10-02', schedule, []);
      assert(count === 3, '5-day calendar span for Mon/Tue/Thu intern strictly counts as 3 working days');
      assert(dates.length === 3, 'Returned affected dates array has exactly 3 dates');
      assert(dates.includes('2026-09-28') && dates.includes('2026-09-29') && dates.includes('2026-10-01'),
        'Affected dates match Mon, Tue, Thu dates exactly');

      // Range on non-scheduled days only: 2026-09-30 (Wed) to 2026-09-30 (Wed)
      const nonScheduledCalc = calculateAffectedScheduledDays('2026-09-30', '2026-09-30', schedule, []);
      assert(nonScheduledCalc.count === 0, 'Non-scheduled day calculates to 0 affected days');

      // Excluding Company Holidays
      const holidayCalc = calculateAffectedScheduledDays('2026-09-28', '2026-10-02', schedule, ['2026-09-28']);
      assert(holidayCalc.count === 2, 'Scheduled day that is a Company Holiday is excluded from affected count');
      assert(!holidayCalc.dates.includes('2026-09-28'), 'Holiday date excluded from affected dates array');
    }

    // -------------------------------------------------------------
    // SECTION 3: AUTHENTICATION ACROSS ROLES
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 3: Role-Based Authentication...');
    const superAdminAuth = await login('admin@jowis.com', 'Admin@12345');
    assert(superAdminAuth.status === 200, 'Super admin login successful');
    const superAdminToken = superAdminAuth.data.token;

    const opAdminAuth = await login('operations@jowis.com', 'Admin@12345');
    assert(opAdminAuth.status === 200, 'Operations admin login successful');
    const adminToken = opAdminAuth.data.token;

    const mentorAuth = await login('mentor.sam@jowis.com', 'Admin@12345');
    assert(mentorAuth.status === 200, 'Mentor login successful');
    const mentorToken = mentorAuth.data.token;

    const internAuth = await login('intern@jowis.com', 'Admin@12345');
    assert(internAuth.status === 200, 'Intern David Adeleke login successful');
    const internToken = internAuth.data.token;

    // -------------------------------------------------------------
    // SECTION 4: INTERN ATTENDANCE SCHEDULE API & LOCK ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 4: Intern Schedule API & Lock Enforcement...');
    {
      // 1. Fetch David's schedule
      const getSchRes = await fetch(`${baseUrl}/attendance/schedule`, {
        headers: { 'Authorization': `Bearer ${internToken}` }
      });
      const getSchData = await getSchRes.json();
      assert(getSchRes.status === 200, 'GET /attendance/schedule returns 200 OK');
      assert(getSchData.data?.locked === true, 'Intern schedule is locked');
      assert(Array.isArray(getSchData.data?.scheduleDays), 'scheduleDays is an array');
      assert(getSchData.data?.scheduleDays.includes('monday'), 'Schedule includes compulsory Monday');

      // 2. Attempt to modify locked schedule -> MUST FAIL WITH 400
      const modifyRes = await fetch(`${baseUrl}/attendance/schedule`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ days: ['monday', 'wednesday', 'friday'] })
      });
      assert(modifyRes.status === 400, 'Attempting to modify locked schedule returns 400 Bad Request');
      const modifyData = await modifyRes.json();
      assert(modifyData.message?.toLowerCase().includes('locked'), 'Error message specifies schedule is locked');
    }

    // -------------------------------------------------------------
    // SECTION 5: DYNAMIC CALCULATION ENDPOINT
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 5: Dynamic Working Days Calculation API (/permissions/calculate-days)...');
    {
      const calcRes = await fetch(`${baseUrl}/permissions/calculate-days`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: '2026-10-12', // Monday
          endDate: '2026-10-16'    // Friday
        })
      });
      const calcData = await calcRes.json();
      assert(calcRes.status === 200, 'POST /permissions/calculate-days returns 200 OK');
      assert(calcData.data?.affectedDaysCount === 3, 'Correctly calculates 3 affected scheduled days for Mon/Tue/Thu intern');
      assert(Array.isArray(calcData.data?.affectedDates), 'affectedDates is returned as array');
    }

    // -------------------------------------------------------------
    // SECTION 6: PERMISSION REQUEST SUBMISSION & VALIDATION
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 6: Permission Request Submission Workflow...');
    let createdPermId = null;
    let createdPermCode = null;
    {
      // 1. Submit on dates that have ZERO scheduled days -> MUST FAIL
      const invalidReqRes = await fetch(`${baseUrl}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: '2026-10-14', // Wednesday (non-scheduled for Mon/Tue/Thu)
          endDate: '2026-10-14',
          reason: 'Attempting leave on a rest day'
        })
      });
      assert(invalidReqRes.status === 400, 'Submitting request on non-scheduled day returns 400 error');

      // 2. Submit valid permission request
      const validReqRes = await fetch(`${baseUrl}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestType: 'academic',
          startDate: '2026-10-19', // Monday
          endDate: '2026-10-23',   // Friday
          reason: 'Automated Test Academic Defense',
          message: 'Final project defense session with academic committee.'
        })
      });
      const validReqData = await validReqRes.json();
      assert(validReqRes.status === 201, 'POST /permissions returns 201 Created');
      assert(Boolean(validReqData.data?.requestCode), 'Unique request code generated');
      assert(validReqData.data?.affectedDaysCount === 3, 'Affected working days count recorded as 3');
      assert(validReqData.data?.status === 'PENDING', 'Initial request status is PENDING');

      createdPermId = validReqData.data?.id;
      createdPermCode = validReqData.data?.requestCode;
    }

    // -------------------------------------------------------------
    // SECTION 7: TWO-STAGE APPROVAL WORKFLOW (MENTOR -> ADMIN)
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 7: Two-Stage Approval Workflow & Attendance Excuse Integration...');
    {
      // 1. Intern cannot self-approve -> MUST FAIL (403)
      const selfApproveRes = await fetch(`${baseUrl}/permissions/${createdPermId}/final-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${internToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'APPROVED', notes: 'Self approval attempt' })
      });
      assert(selfApproveRes.status === 403, 'Intern self-approval is blocked with 403 Forbidden');

      // 2. Mentor reviews and recommends request
      const mentorReviewRes = await fetch(`${baseUrl}/permissions/${createdPermId}/mentor-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mentorToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'RECOMMENDED',
          notes: 'Defense schedule verified with academic department. Strongly recommended.'
        })
      });
      const mentorReviewData = await mentorReviewRes.json();
      assert(mentorReviewRes.status === 200, 'Mentor review returns 200 OK');
      assert(mentorReviewData.data?.mentor_review_status === 'RECOMMENDED', 'Mentor review status set to RECOMMENDED');

      // 3. Admin final determination: APPROVED
      const adminReviewRes = await fetch(`${baseUrl}/permissions/${createdPermId}/final-review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'APPROVED',
          notes: 'Official permission granted. Affected scheduled days excused.'
        })
      });
      const adminReviewData = await adminReviewRes.json();
      assert(adminReviewRes.status === 200, 'Admin final review returns 200 OK');
      assert(adminReviewData.data?.status === 'APPROVED', 'Final status set to APPROVED');

      // 4. Verify that affected scheduled dates in attendance table are EXCUSED
      const excusedAttRows = await query(`
        SELECT attendance_date, status, notes
        FROM attendance
        WHERE intern_id = ? AND attendance_date IN ('2026-10-19', '2026-10-20', '2026-10-22')
      `, [internAuth.data.user?.internProfileId || 1]);

      assert(excusedAttRows.length === 3, 'All 3 affected scheduled dates inserted into attendance table');
      assert(excusedAttRows.every(r => r.status === 'EXCUSED'), 'All 3 affected attendance records have status = EXCUSED');

      // 5. Verify attendance audit logs entry was recorded
      const auditRows = await query(`
        SELECT * FROM attendance_audit_logs
        WHERE intern_id = ? AND new_status = 'EXCUSED'
      `, [internAuth.data.user?.internProfileId || 1]);
      assert(auditRows.length >= 3, 'Attendance audit logs record entries for each excused date');
    }

    // -------------------------------------------------------------
    // SECTION 8: GLOBAL CSV EXPORTS WITH UTF-8 BOM & RFC-4180
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 8: Global CSV Export Audit & Document Types Export Fix...');
    {
      // 1. Export Document Types (The fixed endpoint)
      const docTypesRes = await fetch(`${baseUrl}/reports/export/document_types`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(docTypesRes.status === 200, 'GET /reports/export/document_types returns 200 OK');
      const docTypesBuffer = Buffer.from(await docTypesRes.arrayBuffer());
      assert(docTypesBuffer[0] === 0xEF && docTypesBuffer[1] === 0xBB && docTypesBuffer[2] === 0xBF,
        'Document Types export contains UTF-8 BOM (\\uFEFF)');
      const docTypesCsv = docTypesBuffer.toString('utf-8');
      assert(docTypesCsv.includes('Document Type Name') || docTypesCsv.includes('Code'),
        'Document Types CSV contains valid institutional headers');

      // 2. Export Permissions (The new endpoint)
      const permRes = await fetch(`${baseUrl}/reports/export/permissions`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(permRes.status === 200, 'GET /reports/export/permissions returns 200 OK');
      const permBuffer = Buffer.from(await permRes.arrayBuffer());
      assert(permBuffer[0] === 0xEF && permBuffer[1] === 0xBB && permBuffer[2] === 0xBF,
        'Permissions export contains UTF-8 BOM');
      const permCsv = permBuffer.toString('utf-8');
      assert(permCsv.includes('Request Code') && permCsv.includes('Affected Working Days'),
        'Permissions CSV contains request code and affected working days headers');

      // 3. Export Attendance (Includes schedule_label)
      const attRes = await fetch(`${baseUrl}/reports/export/attendance`, {
        headers: { 'Authorization': `Bearer ${superAdminToken}` }
      });
      assert(attRes.status === 200, 'GET /reports/export/attendance returns 200 OK');
      const attBuffer = Buffer.from(await attRes.arrayBuffer());
      assert(attBuffer[0] === 0xEF && attBuffer[1] === 0xBB && attBuffer[2] === 0xBF,
        'Attendance export contains UTF-8 BOM');
      const attCsv = attBuffer.toString('utf-8');
      assert(attCsv.includes('Schedule Days') || attCsv.includes('Attendance Date'),
        'Attendance CSV contains Schedule Days column');
    }

    // -------------------------------------------------------------
    // SECTION 9: REPAIRED PDF STORAGE VALIDATION
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 9: Document Storage PDF Integrity Validation...');
    {
      const files = fs.readdirSync(documentStorageDir).filter(f => f.endsWith('.pdf'));
      assert(files.length > 0, 'PDF files exist in storage/documents directory');

      let allValid = true;
      for (const file of files) {
        const fullPath = path.join(documentStorageDir, file);
        const buffer = fs.readFileSync(fullPath);
        const header = buffer.subarray(0, 8).toString('utf-8');
        const trailer = buffer.subarray(Math.max(0, buffer.length - 64)).toString('utf-8');

        if (!header.startsWith('%PDF-1.') || !trailer.includes('%%EOF')) {
          allValid = false;
          console.error(`  Corrupt file detected: ${file}`);
          break;
        }
      }
      assert(allValid, 'All PDF files in storage/documents are valid PDF-1.4 documents with %%EOF');
    }

    // -------------------------------------------------------------
    // SECTION 10: FULL SYSTEM TEST DATA CRITERIA VERIFICATION
    // -------------------------------------------------------------
    console.log('\n🔹 SECTION 10: Full System Seed Data Integrity Check...');
    {
      const [superAdminCount] = await query(
        'SELECT COUNT(*) as cnt FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = "super_admin"'
      );
      assert(superAdminCount.cnt >= 1, '>= 1 Super Admin verified');

      const [adminCount] = await query(
        'SELECT COUNT(*) as cnt FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = "admin"'
      );
      assert(adminCount.cnt >= 2, '>= 2 Admins verified');

      const [mentorCount] = await query(
        'SELECT COUNT(*) as cnt FROM mentors'
      );
      assert(mentorCount.cnt >= 3, '>= 3 Mentors verified');

      const statusRows = await query(
        'SELECT DISTINCT status FROM intern_profiles'
      );
      const distinctStatuses = new Set(statusRows.map(r => r.status));
      const requiredStatuses = ['applied', 'screening', 'accepted', 'onboarding', 'active', 'suspended', 'completed', 'dropped', 'alumni'];
      const missingStatuses = requiredStatuses.filter(s => !distinctStatuses.has(s));
      assert(missingStatuses.length === 0, `All 9 lifecycle statuses populated: ${requiredStatuses.join(', ')}`);

      const [totalInterns] = await query('SELECT COUNT(*) as cnt FROM intern_profiles');
      assert(totalInterns.cnt >= 10, '>= 10 Intern profiles populated');

      const [lockedSchedules] = await query('SELECT COUNT(*) as cnt FROM intern_profiles WHERE schedule_locked = 1');
      assert(lockedSchedules.cnt >= 4, 'Multiple interns have locked 3-day schedules');
    }

    console.log('\n================================================================');
    console.log(`🎉 ALL PHASE 13 TESTS PASSED: ${testPassed} / ${testPassed}`);
    console.log(`================================================================\n`);
  } catch (err) {
    console.error('\n❌ TEST RUN ABORTED WITH ERROR:\n', err);
    testFailed++;
  } finally {
    server.close();
    process.exit(testFailed > 0 ? 1 : 0);
  }
}

runPhase13Tests();
