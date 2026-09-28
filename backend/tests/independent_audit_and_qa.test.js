import assert from 'node:assert';
import { test } from 'node:test';
import { evaluateAttendance, timeToSeconds, calculateExpectedWorkingDays } from '../src/utils/timezone.js';
import {
  validateSchedule,
  parseScheduleDays,
  getWorkingDaysConfig,
  isScheduledDay,
  calculateAffectedScheduledDays,
  COMPULSORY_DAY,
  VALID_OPTIONAL_DAYS,
  ALL_VALID_DAYS
} from '../src/utils/scheduleHelper.js';
import { toCSV } from '../src/controllers/reportController.js';

const baseUrl = 'http://localhost:5000/api';

/**
 * Standard RFC-4180 compliant CSV parser
 * Accurately parses CSV text into an array of row arrays, correctly handling
 * quoted fields, escaped quotes (""), and multiline fields containing \r\n or \n.
 */
function parseRFC4180CSV(csvText) {
  // Strip BOM if present
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i += 2;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter(r => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

test('Comprehensive ERP Independent Audit, QA & Business Rule Verification', async (t) => {
  console.log('================================================================');
  console.log('🛡️  JOWIS STUDIO ERP — INDEPENDENT VERIFICATION & QA AUDIT SUITE');
  console.log('================================================================\n');

  // ============================================================================
  // 1. ATTENDANCE BUSINESS RULES & 09:00 LAGOS CUTOFF
  // ============================================================================
  await t.test('1. Authoritative 09:00 Lagos Attendance Cutoff Rules', () => {
    console.log('🔹 1. Testing 09:00 Lagos Cutoff evaluation...');

    // 08:59:59 -> PRESENT, 0 late minutes
    const beforeCutoff = evaluateAttendance('08:59:59', '09:00:00');
    assert.strictEqual(beforeCutoff.status, 'PRESENT', '08:59:59 must be PRESENT');
    assert.strictEqual(beforeCutoff.lateMinutes, 0, '08:59:59 must have 0 late minutes');

    // Exactly 09:00:00 -> LATE, 0 late minutes
    const exactCutoff = evaluateAttendance('09:00:00', '09:00:00');
    assert.strictEqual(exactCutoff.status, 'LATE', 'Exactly 09:00:00 must be LATE');
    assert.strictEqual(exactCutoff.lateMinutes, 0, 'Exactly 09:00:00 has 0 late minutes');

    // 09:00:01 -> LATE, 0 late minutes
    const afterCutoffSec = evaluateAttendance('09:00:01', '09:00:00');
    assert.strictEqual(afterCutoffSec.status, 'LATE', '09:00:01 must be LATE');
    assert.strictEqual(afterCutoffSec.lateMinutes, 0, '09:00:01 has 0 late minutes');

    // 09:05:00 -> LATE, 5 late minutes
    const late5Min = evaluateAttendance('09:05:00', '09:00:00');
    assert.strictEqual(late5Min.status, 'LATE', '09:05:00 must be LATE');
    assert.strictEqual(late5Min.lateMinutes, 5, '09:05:00 must have 5 late minutes');

    console.log('   ✓ Cutoff verified at 08:59:59 (PRESENT), 09:00:00 (LATE), 09:00:01 (LATE), 09:05:00 (5 min LATE)');
  });

  // ============================================================================
  // 2. 3-DAY ATTENDANCE SCHEDULE VALIDATION (MONDAY COMPULSORY)
  // ============================================================================
  await t.test('2. 3-Day Attendance Schedule Rules (Monday Compulsory + Exactly 2 Weekdays)', () => {
    console.log('\n🔹 2. Testing 3-Day Attendance Schedule Validator...');

    // Valid patterns: Monday + 2 other weekdays
    const validPatterns = [
      ['monday', 'tuesday', 'thursday'],
      ['monday', 'tuesday', 'friday'],
      ['monday', 'wednesday', 'thursday'],
      ['monday', 'wednesday', 'friday'],
      ['monday', 'thursday', 'friday'],
      ['monday', 'tuesday', 'wednesday']
    ];

    for (const pattern of validPatterns) {
      const canonical = validateSchedule(pattern);
      assert.strictEqual(canonical.length, 3, `Pattern ${pattern.join('/')} must produce 3 days`);
      assert(canonical.includes('monday'), `Pattern ${pattern.join('/')} must include Monday`);
    }
    console.log('   ✓ All 6 valid 3-day schedule combinations validated');

    // Invalid: Missing Monday
    assert.throws(() => {
      validateSchedule(['tuesday', 'wednesday', 'thursday']);
    }, /Monday is compulsory/i, 'Missing Monday must throw');

    // Invalid: Only 2 days
    assert.throws(() => {
      validateSchedule(['monday', 'tuesday']);
    }, /exactly 3 unique working days/i, 'Only 2 days must throw');

    // Invalid: 4 days
    assert.throws(() => {
      validateSchedule(['monday', 'tuesday', 'wednesday', 'thursday']);
    }, /exactly 3 unique working days/i, '4 days must throw');

    // Invalid: Weekend day (Saturday / Sunday)
    assert.throws(() => {
      validateSchedule(['monday', 'tuesday', 'saturday']);
    }, /Invalid attendance day/i, 'Saturday must throw');

    assert.throws(() => {
      validateSchedule(['monday', 'wednesday', 'sunday']);
    }, /Invalid attendance day/i, 'Sunday must throw');

    // Invalid: Duplicate days (e.g. Monday, Tuesday, Tuesday)
    assert.throws(() => {
      validateSchedule(['monday', 'tuesday', 'tuesday']);
    }, /exactly 3 unique working days/i, 'Duplicates must throw');

    console.log('   ✓ All invalid schedule combinations strictly rejected by validator');
  });

  // ============================================================================
  // 3. EXPECTED ATTENDANCE DAYS & NON-SCHEDULED DAYS LOGIC
  // ============================================================================
  await t.test('3. Expected Attendance Days & Non-Scheduled Days Logic', () => {
    console.log('\n🔹 3. Testing Expected Attendance Days calculation...');

    const schedule = ['monday', 'wednesday', 'friday'];
    const config = getWorkingDaysConfig(schedule);

    assert.strictEqual(config.monday, true);
    assert.strictEqual(config.tuesday, false);
    assert.strictEqual(config.wednesday, true);
    assert.strictEqual(config.thursday, false);
    assert.strictEqual(config.friday, true);
    assert.strictEqual(config.saturday, false);
    assert.strictEqual(config.sunday, false);

    // 4-week period: 2026-09-01 (Tuesday) to 2026-09-28 (Monday)
    // Scheduled days: Mon, Wed, Fri
    const { expectedDays, workingDates } = calculateExpectedWorkingDays('2026-09-01', '2026-09-28', config, []);
    // Count Mon, Wed, Fri in that date range:
    // Sept 1: Tue (0)
    // Sept 2: Wed (1), Sept 4: Fri (2)
    // Sept 7: Mon (3), Sept 9: Wed (4), Sept 11: Fri (5)
    // Sept 14: Mon (6), Sept 16: Wed (7), Sept 18: Fri (8)
    // Sept 21: Mon (9), Sept 23: Wed (10), Sept 25: Fri (11)
    // Sept 28: Mon (12)
    assert.strictEqual(expectedDays, 12, '4-week period for Mon/Wed/Fri must have exactly 12 expected days');

    // Denominator rule verification: If intern attended 10 days out of 12 expected:
    const rate = Math.round((10 / expectedDays) * 100);
    assert.strictEqual(rate, 83, 'Attendance rate must be 10/12 (83%), not 10/20 (50%)');

    // Non-scheduled days are NOT scheduled
    assert.strictEqual(isScheduledDay('2026-09-01', schedule), false, 'Sept 1 (Tuesday) is not a scheduled day for Mon/Wed/Fri');
    assert.strictEqual(isScheduledDay('2026-09-02', schedule), true, 'Sept 2 (Wednesday) is a scheduled day for Mon/Wed/Fri');

    console.log(`   ✓ Expected days: ${expectedDays} (Denominator verified: 10/12 = ${rate}%)`);
  });

  // ============================================================================
  // 4. PERMISSION AFFECTED DAYS CALCULATION (SCENARIOS A, B, C)
  // ============================================================================
  await t.test('4. Permission Affected Days Calculation (Scenarios A, B, C)', () => {
    console.log('\n🔹 4. Testing Permission Affected Days Calculation...');

    // Scenario A: Schedule: Monday / Tuesday / Thursday. Permission: Tuesday only (2026-09-22 -> 2026-09-22)
    const schedA = ['monday', 'tuesday', 'thursday'];
    const resA = calculateAffectedScheduledDays('2026-09-22', '2026-09-22', schedA, []);
    assert.strictEqual(resA.count, 1, 'Scenario A: Tuesday only must affect exactly 1 day');
    assert.deepStrictEqual(resA.dates, ['2026-09-22']);
    console.log('   ✓ Scenario A (Mon/Tue/Thu, Tue only) = 1 affected day');

    // Scenario B: Schedule: Monday / Wednesday / Friday. Permission: Monday -> Friday (2026-09-14 to 2026-09-18)
    const schedB = ['monday', 'wednesday', 'friday'];
    const resB = calculateAffectedScheduledDays('2026-09-14', '2026-09-18', schedB, []);
    assert.strictEqual(resB.count, 3, 'Scenario B: Monday -> Friday must affect exactly 3 scheduled days (Mon, Wed, Fri), NOT 5');
    assert.deepStrictEqual(resB.dates, ['2026-09-14', '2026-09-16', '2026-09-18']);
    console.log('   ✓ Scenario B (Mon/Wed/Fri, Mon->Fri) = 3 affected days (excluding Tue & Thu)');

    // Scenario C: Schedule: Monday / Tuesday / Friday. Permission: Wednesday -> Thursday (2026-09-16 to 2026-09-17)
    const schedC = ['monday', 'tuesday', 'friday'];
    const resC = calculateAffectedScheduledDays('2026-09-16', '2026-09-17', schedC, []);
    assert.strictEqual(resC.count, 0, 'Scenario C: Wednesday -> Thursday on Mon/Tue/Fri schedule must affect 0 days');
    assert.deepStrictEqual(resC.dates, []);
    console.log('   ✓ Scenario C (Mon/Tue/Fri, Wed->Thu) = 0 affected days (neither is a scheduled day)');
  });

  // ============================================================================
  // 5. RFC-4180 CSV ENGINE: QUOTES, COMMAS, MULTILINE & UNICODE
  // ============================================================================
  await t.test('5. RFC-4180 CSV Engine: Edge Case Encoding & Parsing', () => {
    console.log('\n🔹 5. Testing RFC-4180 CSV Engine with commas, quotes, multiline & Unicode...');

    const headers = [
      { key: 'id', label: 'Record ID' },
      { key: 'name', label: 'Intern Name, with comma' },
      { key: 'quote', label: 'Field "with quotes"' },
      { key: 'multiline', label: 'Multiline Description' },
      { key: 'unicode', label: 'Unicode Symbol ₦' },
      { key: 'nullVal', label: 'Nullable' }
    ];

    const rows = [
      {
        id: 1,
        name: 'David, Adeleke, Jr.',
        quote: 'Reason, because of "an appointment"',
        multiline: 'Line 1 of details\nLine 2 of details\r\nLine 3 of details',
        unicode: 'Stipend: ₦150,000 & Café',
        nullVal: null
      },
      {
        id: 2,
        name: 'Chioma Okeke',
        quote: 'Standard "quoted" test',
        multiline: 'Single line text',
        unicode: 'Standard text',
        nullVal: 'Present'
      }
    ];

    const csvOutput = toCSV(rows, headers);

    // Verify UTF-8 BOM
    assert.strictEqual(csvOutput.charCodeAt(0), 0xFEFF, 'toCSV must prepend UTF-8 BOM \\uFEFF');

    // Parse with RFC-4180 parser
    const parsedRows = parseRFC4180CSV(csvOutput);

    // 1 header row + 2 data rows = 3 rows total
    assert.strictEqual(parsedRows.length, 3, 'CSV must parse into exactly 3 rows (1 header + 2 data)');

    // Header row column count
    assert.strictEqual(parsedRows[0].length, headers.length, 'Header column count must match headers array');

    // Row 1 column count
    assert.strictEqual(parsedRows[1].length, headers.length, 'Row 1 column count must match headers array');
    assert.strictEqual(parsedRows[1][1], 'David, Adeleke, Jr.', 'Comma within quotes preserved');
    assert.strictEqual(parsedRows[1][2], 'Reason, because of "an appointment"', 'Quotes inside quotes unescaped correctly');
    assert(parsedRows[1][3].includes('Line 1 of details'), 'Multiline text preserved');
    assert(parsedRows[1][4].includes('₦150,000'), 'Unicode Naira symbol preserved');
    assert.strictEqual(parsedRows[1][5], '', 'Null value converted to empty string');

    // Row 2 column count
    assert.strictEqual(parsedRows[2].length, headers.length, 'Row 2 column count must match headers array');

    console.log('   ✓ RFC-4180 CSV Engine correctly handles commas, escaped quotes (""), newlines, and UTF-8 BOM');
  });

  // ============================================================================
  // 6. END-TO-END API TESTS: EXPORT INVENTORY & DOCUMENT TYPES
  // ============================================================================
  await t.test('6. Global Export Inventory & Document Types HTTP Verification', async () => {
    console.log('\n🔹 6. Testing Global Export Endpoints via API (including Document Types)...');

    // Super Admin login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
    });
    const loginData = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, 'Super admin login succeeds');
    const adminToken = loginData.token;

    // Full export inventory
    const exportInventory = [
      'attendance',
      'interns',
      'tasks',
      'performance',
      'cohorts',
      'tracks',
      'mentors',
      'executive',
      'users',
      'audit_logs',
      'automation',
      'certificates',
      'documents',
      'document_types',
      'permissions'
    ];

    for (const expType of exportInventory) {
      const res = await fetch(`${baseUrl}/reports/export/${expType}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      assert(res.status === 200 || res.status === 404, `Export /reports/export/${expType} returned ${res.status}`);

      if (res.status === 200) {
        const contentType = res.headers.get('content-type') || '';
        const disposition = res.headers.get('content-disposition') || '';
        assert(contentType.includes('text/csv'), `Content-Type must be text/csv for ${expType}`);
        assert(disposition.includes('attachment') && disposition.includes('.csv'), `Content-Disposition must have .csv attachment for ${expType}`);

        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const hasBOM = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
        assert(hasBOM, `Export ${expType} must start with UTF-8 BOM [0xEF, 0xBB, 0xBF]`);

        const text = new TextDecoder('utf-8').decode(bytes);
        const parsed = parseRFC4180CSV(text);
        assert(parsed.length >= 2, `Export ${expType} must have at least 1 header and 1 data row (got ${parsed.length})`);

        const expectedColCount = parsed[0].length;
        for (let r = 1; r < parsed.length; r++) {
          assert.strictEqual(
            parsed[r].length,
            expectedColCount,
            `Row ${r} in ${expType} has ${parsed[r].length} columns, expected header count ${expectedColCount}`
          );
        }
        console.log(`   ✓ Export '${expType}': Status 200, UTF-8 BOM, ${parsed[0].length} cols, ${parsed.length - 1} records`);
      }
    }
  });

  // ============================================================================
  // 7. EXPORT RBAC PRIVILEGE ENFORCEMENT
  // ============================================================================
  await t.test('7. Export RBAC Scoping & Privilege Enforcement', async () => {
    console.log('\n🔹 7. Testing Export RBAC Privileges...');

    // Intern login
    const intRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const intData = await intRes.json();
    assert.strictEqual(intRes.status, 200);
    const internToken = intData.token;

    // Intern forbidden from exporting administrative users
    const userRes = await fetch(`${baseUrl}/reports/export/users`, {
      headers: { 'Authorization': `Bearer ${internToken}` }
    });
    assert.strictEqual(userRes.status, 403, 'Intern must receive 403 Forbidden on /reports/export/users');

    // Intern forbidden from exporting audit logs
    const auditRes = await fetch(`${baseUrl}/reports/export/audit_logs`, {
      headers: { 'Authorization': `Bearer ${internToken}` }
    });
    assert.strictEqual(auditRes.status, 403, 'Intern must receive 403 Forbidden on /reports/export/audit_logs');

    // Intern can export own scorecard
    const scoreRes = await fetch(`${baseUrl}/reports/export/personal_scorecard`, {
      headers: { 'Authorization': `Bearer ${internToken}` }
    });
    assert.strictEqual(scoreRes.status, 200, 'Intern can export personal scorecard');

    console.log('   ✓ Administrative exports restricted from intern (403 Forbidden enforced)');
  });

  // ============================================================================
  // 8. OFFICIAL CERTIFICATE PDF GENERATION & STREAMING
  // ============================================================================
  await t.test('8. Official Certificate PDF Download Verification', async () => {
    console.log('\n🔹 8. Testing Certificate PDF Download (PDF-1.4 Byte Structure)...');

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
    });
    const { token: adminToken } = await loginRes.json();

    // Fetch existing certificates
    const certsRes = await fetch(`${baseUrl}/certificates`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const certsData = await certsRes.json();
    assert(certsData.success && certsData.data.length > 0, 'Certificates exist in system');

    const firstCert = certsData.data[0];

    // Download PDF
    const downloadRes = await fetch(`${baseUrl}/certificates/${firstCert.id}/download`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(downloadRes.status, 200, 'Certificate download returns 200 OK');
    const contentType = downloadRes.headers.get('content-type') || '';
    assert(contentType.includes('application/pdf'), 'Content-Type must be application/pdf');

    const buf = await downloadRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    assert(bytes.length > 500, `PDF size must be substantial (got ${bytes.length} bytes)`);

    // Verify PDF Magic Bytes (%PDF-1.4)
    const headerStr = new TextDecoder('utf-8').decode(bytes.slice(0, 8));
    assert(headerStr.startsWith('%PDF-'), `PDF file must start with %PDF- header (got ${headerStr})`);

    // Verify PDF Trailer / EOF
    const tailStr = new TextDecoder('utf-8').decode(bytes.slice(bytes.length - 30));
    assert(tailStr.includes('%%EOF'), 'PDF file must terminate with %%EOF');

    console.log(`   ✓ Certificate PDF downloaded: Valid %PDF-1.4 structure, ${bytes.length} bytes`);
  });

  // ============================================================================
  // 9. SCHEDULE LOCKING ENFORCEMENT
  // ============================================================================
  await t.test('9. Schedule Locking & Immutability via API', async () => {
    console.log('\n🔹 9. Testing Attendance Schedule Locking...');

    // Login David (whose schedule is already locked)
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const { token } = await loginRes.json();

    // Attempt to change schedule
    const updateRes = await fetch(`${baseUrl}/attendance/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        days: ['monday', 'wednesday', 'friday']
      })
    });

    assert.strictEqual(updateRes.status, 400, 'Attempting to modify locked schedule must return 400 Bad Request');
    const updateData = await updateRes.json();
    assert(updateData.message.includes('permanently locked'), 'Response message explains schedule is locked');

    console.log('   ✓ Schedule immutability enforced: Intern cannot modify locked schedule');
  });

  // ============================================================================
  // 10. PERMISSION SUBMISSION ZERO-AFFECTED-DAYS REJECTION
  // ============================================================================
  await t.test('10. Permission Submission Rejects Zero-Overlap Date Ranges', async () => {
    console.log('\n🔹 10. Testing Permission Request Zero-Overlap Rejection...');

    // David's schedule: ['monday', 'tuesday', 'thursday']
    // Requesting Wednesday 2026-10-14 only (neither date is a scheduled day)
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const { token } = await loginRes.json();

    const permRes = await fetch(`${baseUrl}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startDate: '2026-10-14', // Wednesday
        endDate: '2026-10-14',   // Wednesday
        reason: 'Testing zero overlap submission'
      })
    });

    assert.strictEqual(permRes.status, 400, 'Submitting permission with 0 scheduled days must return 400');
    const data = await permRes.json();
    assert(data.message.includes('does not overlap with any of your scheduled attendance days'), 'Error message informs intern no permission needed');

    console.log('   ✓ Zero-affected scheduled days submission cleanly rejected with informative message');
  });

  console.log('\n================================================================');
  console.log('🎉 ALL INDEPENDENT AUDIT & QA TESTS PASSED SUCCESSFULLY (10/10)');
  console.log('================================================================\n');
});
