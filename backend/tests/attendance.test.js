import { evaluateAttendance } from '../src/utils/timezone.js';

console.log('--- RUNNING AUTHORITATIVE ATTENDANCE TEST SUITE ---');

const testCases = [
  { time: '08:00:00', expectedStatus: 'PRESENT', expectedLateMinutes: 0 },
  { time: '08:30:00', expectedStatus: 'PRESENT', expectedLateMinutes: 0 },
  { time: '08:59:59', expectedStatus: 'PRESENT', expectedLateMinutes: 0 },
  { time: '09:00:00', expectedStatus: 'LATE', expectedLateMinutes: 0 },
  { time: '09:01:00', expectedStatus: 'LATE', expectedLateMinutes: 1 },
  { time: '09:17:00', expectedStatus: 'LATE', expectedLateMinutes: 17 },
  { time: '09:30:00', expectedStatus: 'LATE', expectedLateMinutes: 30 },
  { time: '10:00:00', expectedStatus: 'LATE', expectedLateMinutes: 60 },
  { time: '11:15:30', expectedStatus: 'LATE', expectedLateMinutes: 135 },
];

let failed = 0;

for (const tc of testCases) {
  const result = evaluateAttendance(tc.time, '09:00:00');
  const statusPassed = result.status === tc.expectedStatus;
  const latePassed = result.lateMinutes === tc.expectedLateMinutes;

  if (statusPassed && latePassed) {
    console.log(`✅ PASS: ${tc.time} => ${result.status} (${result.lateMinutes} min late)`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${tc.time} => got ${result.status} (${result.lateMinutes} min), expected ${tc.expectedStatus} (${tc.expectedLateMinutes} min)`);
  }
}

if (failed === 0) {
  console.log('🎯 ALL ATTENDANCE CUTOFF TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error(`💥 ${failed} TEST(S) FAILED!`);
  process.exit(1);
}
