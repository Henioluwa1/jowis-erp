import { execSync } from 'child_process';

const testFiles = [
  'attendance.test.js',
  'api.test.js',
  'hardening.test.js',
  'phase2.test.js',
  'phase3.test.js',
  'phase4.test.js',
  'phase5.test.js',
  'phase6.test.js',
  'phase7.test.js',
  'phase8.test.js',
  'phase9.test.js',
  'phase10.test.js',
  'phase11.test.js',
  'phase12.test.js',
  'phase13.test.js',
  'frontend_pages_api_simulation.test.js',
  'frontend_actions_simulation.test.js',
  'upgrades_verification.test.js'
];

console.log('🏛️  JOWIS STUDIO ERP — MASTER TEST RUNNER 🏛️\n');
console.log(`Running all ${testFiles.length} automated test suites with controlled resource management...\n`);

let totalPassed = 0;
let totalFailed = 0;
const failedSuites = [];

for (const testFile of testFiles) {
  process.stdout.write(`▶️  Executing ${testFile}... `);
  const start = Date.now();
  try {
    execSync(`node tests/${testFile}`, {
      stdio: 'pipe',
      timeout: 90000,
      env: { ...process.env, NODE_ENV: 'test' }
    });
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ PASSED (${duration}s)`);
    totalPassed++;
  } catch (err) {
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`❌ FAILED (${duration}s)`);
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    console.error(`--- Error Output for ${testFile} ---`);
    console.error(stderr || stdout.slice(-800));
    console.error('------------------------------------\n');
    totalFailed++;
    failedSuites.push(testFile);
  }

  // 600ms grace cooldown to allow Windows socket teardown and DB connection release
  execSync('node -e "setTimeout(() => {}, 600)"');
}

console.log('\n======================================================');
console.log(`🎯 MASTER TEST SUMMARY: ${totalPassed} SUITES PASSED, ${totalFailed} FAILED.`);
if (failedSuites.length > 0) {
  console.log(`⚠️  Failed suites: ${failedSuites.join(', ')}`);
  process.exit(1);
} else {
  console.log('🏆 100% SUITE SUCCESS ACROSS ALL 18 PHASES & UPGRADES!');
  console.log('======================================================\n');
  process.exit(0);
}
