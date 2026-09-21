import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { backupDatabase } from '../src/scripts/backup_db.js';
import { restoreDatabase } from '../src/scripts/restore_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(app);

async function runPhase11Tests() {
  const PORT = 5098;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`=======================================================`);
  console.log(`⚡  JOWIS STUDIO ERP — PHASE 11 COMPREHENSIVE TEST SUITE`);
  console.log(`🛡️  PRODUCTION DEPLOYMENT, ENVIRONMENT HARDENING & GO-LIVE`);
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

  let testBackupPath = null;
  const testDbName = 'jowis_p11_restore_test';

  try {
    // -------------------------------------------------------------
    // GATE 1: Live Health Check with MySQL Query Verification
    // -------------------------------------------------------------
    console.log('🔹 GATE 1: Live Database Health Check (/api/health)...');
    {
      const res = await fetch(`${baseUrl}/health`);
      assert(res.status === 200, 'GET /api/health returns 200 OK');
      const data = await res.json();
      assert(data.status === 'ok', 'Health status is ok');
      assert(data.database === 'connected', 'Database status indicates connected');
      assert(typeof data.uptime === 'number' && data.uptime >= 0, 'Uptime is reported as a positive number');
      assert(data.timezone === 'Africa/Lagos', 'Operational timezone is Africa/Lagos');
      assert(Boolean(data.timestamp), 'Timestamp is provided');
    }

    // -------------------------------------------------------------
    // GATE 2: Database Connection & Charset Hardening
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: Database Connection & Charset Configuration...');
    {
      const [rows] = await pool.query(`SHOW VARIABLES LIKE 'character_set_connection'`);
      assert(rows.length > 0, 'Can query MySQL system variables');
      const charset = rows[0].Value.toLowerCase();
      assert(charset.includes('utf8'), `Connection charset is utf-8 compatible (${charset})`);
    }

    // -------------------------------------------------------------
    // GATE 3: Production Error Sanitization
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Production Error Sanitization & Clean Responses...');
    {
      const res = await fetch(`${baseUrl}/non-existent-production-route-404`);
      assert(res.status === 404, 'Unknown route returns 404');
      const data = await res.json();
      assert(!data.success, 'Response indicates success: false');
      assert(data.message && data.message.includes('not found'), 'Response has clean message');
      assert(!data.stack, '404 response does not leak stack trace');
    }

    // -------------------------------------------------------------
    // GATE 4: Static File Serving & Directory Traversal Protection
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Static File Serving Hardening...');
    {
      // Directory listing must be rejected / not exposed
      const res = await fetch(`http://localhost:${PORT}/uploads/`);
      assert(res.status === 404 || res.status === 403, 'Directory index listing on /uploads/ is denied or 404');

      // Dotfiles should be ignored
      const dotRes = await fetch(`http://localhost:${PORT}/uploads/.gitkeep`);
      assert(dotRes.status === 404 || dotRes.status === 403, 'Dotfiles are not served by static middleware');
    }

    // -------------------------------------------------------------
    // GATE 4B: CORS Origin Policy Verification
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4B: CORS Policy Verification...');
    {
      // Allowed origin
      const allowedRes = await fetch(`${baseUrl}/health`, {
        headers: { Origin: 'http://localhost:5173' }
      });
      assert(allowedRes.headers.get('access-control-allow-origin') === 'http://localhost:5173', 
        'Permitted origin receives Access-Control-Allow-Origin header');

      // Untrusted external origin is rejected
      const blockedRes = await fetch(`${baseUrl}/health`, {
        headers: { Origin: 'https://attacker-unauthorized-domain.com' }
      });
      assert(blockedRes.status >= 400, 'Untrusted origin request is rejected by CORS policy');
    }

    // -------------------------------------------------------------
    // GATE 5: Database Backup & Recovery Script Execution Rehearsal
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Database Backup & Recovery Rehearsal...');
    {
      testBackupPath = path.resolve(__dirname, `test_p11_backup_${Date.now()}.sql`);
      const backupResult = await backupDatabase({ outputPath: testBackupPath });

      assert(fs.existsSync(testBackupPath), 'Backup file exists on disk');
      assert(backupResult.tablesCount >= 39, `Backup exported all tables (${backupResult.tablesCount} tables)`);
      assert(backupResult.rowsCount > 0, `Backup exported table data (${backupResult.rowsCount} rows)`);
      assert(backupResult.sizeBytes > 10000, `Backup file size is non-trivial (${backupResult.sizeBytes} bytes)`);

      // Verify restore into temporary database
      const restoreResult = await restoreDatabase({
        filePath: testBackupPath,
        database: testDbName
      });

      assert(restoreResult.tablesRestored === backupResult.tablesCount, 
        `Restored table count (${restoreResult.tablesRestored}) matches backup table count (${backupResult.tablesCount})`);

      // Connect to restored database and verify data integrity
      const testConn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: testDbName
      });

      const [[{ userCount }]] = await testConn.query('SELECT COUNT(*) as userCount FROM users');
      assert(userCount >= 6, `Restored database has valid users data (${userCount} users)`);

      const [[{ roleCount }]] = await testConn.query('SELECT COUNT(*) as roleCount FROM roles');
      assert(roleCount >= 4, `Restored database has valid roles (${roleCount} roles)`);

      // Clean up test database
      await testConn.query(`DROP DATABASE \`${testDbName}\``);
      await testConn.end();
      console.log(`  ✅ Restored test database \`${testDbName}\` verified and dropped cleanly.`);
    }

    // -------------------------------------------------------------
    // GATE 6: Demo Accounts Authentication & Credential Integrity
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6: Verifying Demo Accounts Authentication...');
    const demoAccounts = [
      { role: 'super_admin', email: 'admin@jowis.com', pass: 'Admin@12345' },
      { role: 'admin', email: 'operations@jowis.com', pass: 'Admin@12345' },
      { role: 'mentor', email: 'mentor.sam@jowis.com', pass: 'Mentor@12345' },
      { role: 'mentor', email: 'mentor.chioma@jowis.com', pass: 'Mentor@12345' },
      { role: 'intern', email: 'intern@jowis.com', pass: 'Intern@12345' },
      { role: 'intern', email: 'intern.zainab@jowis.com', pass: 'Intern@12345' }
    ];

    let superAdminToken, adminToken, mentorToken, internToken;

    for (const acc of demoAccounts) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: acc.email, password: acc.pass })
      });
      assert(res.status === 200, `Login for ${acc.email} returns 200 OK`);
      const data = await res.json();
      assert(Boolean(data.token), `Login returns JWT token for ${acc.email}`);
      assert(data.user && !data.user.password_hash, `Password hash is omitted for ${acc.email}`);
      assert(data.user.role === acc.role, `User role is verified as ${acc.role} for ${acc.email}`);

      if (acc.email === 'admin@jowis.com') superAdminToken = data.token;
      if (acc.email === 'operations@jowis.com') adminToken = data.token;
      if (acc.email === 'mentor.sam@jowis.com') mentorToken = data.token;
      if (acc.email === 'intern@jowis.com') internToken = data.token;
    }

    // -------------------------------------------------------------
    // GATE 7: RBAC Access Control Enforcement
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 7: RBAC Access Control Enforcement...');
    {
      // 1. Unauthenticated request to protected endpoint
      const unauthRes = await fetch(`${baseUrl}/admin/audit-logs`);
      assert(unauthRes.status === 401, 'Unauthenticated request to /api/admin/audit-logs returns 401');

      // 2. Intern accessing admin endpoint
      const internRes = await fetch(`${baseUrl}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${internToken}` }
      });
      assert(internRes.status === 403, 'Intern accessing /api/admin/audit-logs returns 403 Forbidden');

      // 3. Mentor accessing admin endpoint
      const mentorRes = await fetch(`${baseUrl}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${mentorToken}` }
      });
      assert(mentorRes.status === 403, 'Mentor accessing /api/admin/audit-logs returns 403 Forbidden');

      // 4. Admin accessing admin endpoint
      const adminRes = await fetch(`${baseUrl}/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(adminRes.status === 200, 'Admin accessing /api/admin/audit-logs returns 200 OK');

      // 5. Admin accessing super_admin restricted system endpoint
      const adminSysRes = await fetch(`${baseUrl}/system/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(adminSysRes.status === 403, 'Admin accessing super_admin-only /api/system/audit-logs returns 403 Forbidden');

      // 6. Super Admin accessing system audit-logs
      const superAdminRes = await fetch(`${baseUrl}/system/audit-logs`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert(superAdminRes.status === 200, 'Super Admin accessing /api/system/audit-logs returns 200 OK');
    }

    // -------------------------------------------------------------
    // GATE 8: Core Operational Endpoints Smoke Test
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 8: Core Operational Endpoints Smoke Test...');
    {
      // Auth me
      const meRes = await fetch(`${baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert(meRes.status === 200, 'GET /api/auth/me returns 200');

      // Admin Dashboard
      const dashRes = await fetch(`${baseUrl}/dashboard/admin`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert(dashRes.status === 200, 'GET /api/dashboard/admin returns 200');

      // Attendance overview
      const attRes = await fetch(`${baseUrl}/attendance/admin/overview`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert(attRes.status === 200, 'GET /api/attendance/admin/overview returns 200');

      // Document types
      const docsRes = await fetch(`${baseUrl}/documents/types`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert(docsRes.status === 200, 'GET /api/documents/types returns 200');

      // Notifications
      const notifRes = await fetch(`${baseUrl}/communications/notifications`, {
        headers: { Authorization: `Bearer ${superAdminToken}` }
      });
      assert(notifRes.status === 200, 'GET /api/communications/notifications returns 200');
    }

    console.log(`\n=======================================================`);
    console.log(`🎯 ALL PHASE 11 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log(`=======================================================`);

  } catch (err) {
    console.error(`\n❌ TEST SUITE FAILURE:`, err);
    process.exit(1);
  } finally {
    if (testBackupPath && fs.existsSync(testBackupPath)) {
      try {
        fs.unlinkSync(testBackupPath);
        console.log(`🧹 Cleaned up temporary test backup: ${testBackupPath}`);
      } catch (e) {
        // ignore
      }
    }
    server.close();
    await pool.end();
  }
}

runPhase11Tests();
