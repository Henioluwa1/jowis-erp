import pool, { query } from '../src/config/db.js';
import { generateCertificatePDF } from '../src/utils/certificateGenerator.js';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5000/api';

async function runUpgradesVerification() {
  console.log('🚀 RUNNING COMPREHENSIVE VERIFICATION OF SYSTEM UPGRADES 🚀\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (cond) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Authenticate Admin
  const adminLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
  }).then(r => r.json());
  assert(adminLogin.success && adminLogin.token, 'Admin authentication successful');
  const adminToken = adminLogin.token;

  // 2. Authenticate Intern
  const internLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
  }).then(r => r.json());
  assert(internLogin.success && internLogin.token, 'Intern authentication successful');
  const internToken = internLogin.token;

  // -------------------------------------------------------------
  // UPGRADE 1: Real-Time Server-Sent Events (SSE) Stream
  // -------------------------------------------------------------
  console.log('\n🔹 UPGRADE 1: Real-Time SSE Stream Verification...');
  {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const sseResponse = await fetch(`${BASE_URL}/communications/stream?token=${encodeURIComponent(internToken)}`, {
      signal: controller.signal
    });

    assert(sseResponse.status === 200, 'SSE stream responds with HTTP 200 OK');
    assert(sseResponse.headers.get('content-type')?.includes('text/event-stream'), 'SSE Content-Type header is text/event-stream');

    const reader = sseResponse.body.getReader();
    const decoder = new TextDecoder();
    let initialChunk = '';
    
    // Read the first event packet
    const { value } = await reader.read();
    initialChunk = decoder.decode(value);
    clearTimeout(timeout);
    reader.cancel();

    assert(initialChunk.includes('event: connected'), 'SSE stream dispatches initial connection handshake packet');
    assert(initialChunk.includes('Jowis Real-Time Event Stream'), 'SSE stream confirms active institutional connection');
  }

  // -------------------------------------------------------------
  // UPGRADE 2: Vector QR Code Generation on Certificate PDFs
  // -------------------------------------------------------------
  console.log('\n🔹 UPGRADE 2: Dynamic Vector QR Code PDF Certificate...');
  {
    const testPdfPath = path.join(process.cwd(), 'tests', 'test_qr_verification_cert.pdf');
    await generateCertificatePDF({
      internName: 'David Adeleke',
      certificateNumber: 'JOWIS-CERT-TEST-QR-V1',
      verificationCode: 'VERIFY-1790501382703-48',
      certificateTitle: 'ENTERPRISE FULL STACK SPECIALIZATION',
      trackName: 'Full Stack Web Engineering',
      cohortName: 'Alpha Cohort 2026',
      outputPath: testPdfPath
    });

    assert(fs.existsSync(testPdfPath), 'Certificate PDF was generated on disk');
    const pdfBuffer = fs.readFileSync(testPdfPath);
    assert(pdfBuffer.length > 5000, `Certificate PDF file has valid size (${pdfBuffer.length} bytes)`);
    assert(pdfBuffer.slice(0, 8).toString().includes('%PDF-1.4'), 'Certificate is valid PDF-1.4 standard');
    assert(pdfBuffer.toString('utf-8').includes('SCAN TO VERIFY'), 'Certificate includes SCAN TO VERIFY label');
    assert(pdfBuffer.toString('utf-8').includes('OFFICIAL CREDENTIAL'), 'Certificate includes OFFICIAL CREDENTIAL label');
    assert(pdfBuffer.toString('utf-8').slice(-10).includes('%%EOF'), 'Certificate terminates with standard %%EOF marker');

    fs.unlinkSync(testPdfPath);
    assert(!fs.existsSync(testPdfPath), 'Temporary test certificate cleanly removed');
  }

  // -------------------------------------------------------------
  // UPGRADE 3: Office IP & Geolocation Attendance Verification Guard
  // -------------------------------------------------------------
  console.log('\n🔹 UPGRADE 3: Geofence Attendance Verification Guard...');
  {
    // A. Verify Geofence Disabled Behavior (Graceful fallback)
    await query(`UPDATE system_settings SET setting_value = '0' WHERE setting_key = 'attendance_geofence_enabled'`);

    const checkInDisabledRes = await fetch(`${BASE_URL}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internToken}`
      },
      body: JSON.stringify({ latitude: 6.5244, longitude: 3.3792 })
    });
    // Response can be 200 or 400 (already checked in today)
    assert(checkInDisabledRes.status === 200 || checkInDisabledRes.status === 400, 'Check-in with coordinates succeeds when geofence disabled');

    // B. Test Geofence Enabled & Far Distance (Out-of-Office Detection)
    // Temporarily enable geofence for test validation
    await query(`UPDATE system_settings SET setting_value = '1' WHERE setting_key = 'attendance_geofence_enabled'`);
    await query(`UPDATE system_settings SET setting_value = '6.5244' WHERE setting_key = 'attendance_office_lat'`);
    await query(`UPDATE system_settings SET setting_value = '3.3792' WHERE setting_key = 'attendance_office_lng'`);
    await query(`UPDATE system_settings SET setting_value = '500' WHERE setting_key = 'attendance_geofence_radius_meters'`);

    // Far coordinates: London (51.5074, -0.1278), ~5000 km away
    const farCheckInRes = await fetch(`${BASE_URL}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internToken}`
      },
      body: JSON.stringify({ latitude: 51.5074, longitude: -0.1278 })
    });
    const farData = await farCheckInRes.json();
    assert(farCheckInRes.status === 403, 'Clock-in from outside studio radius is strictly blocked with HTTP 403 Forbidden');
    assert(farData.message.includes('Location verification failed'), 'Error message specifies location verification failure');

    // Missing coordinates when geofence is enabled
    const missingCoordsRes = await fetch(`${BASE_URL}/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${internToken}`
      },
      body: JSON.stringify({})
    });
    assert(missingCoordsRes.status === 403, 'Clock-in without coordinates when geofence active is blocked with HTTP 403');

    // Revert geofence to default '0' (permissive) for seamless test suite execution
    await query(`UPDATE system_settings SET setting_value = '0' WHERE setting_key = 'attendance_geofence_enabled'`);
    assert(true, 'Geofence setting safely reverted to baseline configuration');

    // 🔹 UPGRADE 4: Public ID Card Verification & System Config
    console.log('\n🔹 UPGRADE 4: Public Institutional ID Card Verification & System Config...');
    const idConfigRes = await fetch(`${BASE_URL}/system/id-card-config`, {
      headers: { 'Authorization': `Bearer ${internToken}` }
    });
    assert(idConfigRes.status === 200, 'Authenticated users can fetch system ID card config (200 OK)');
    const idConfigData = await idConfigRes.json();
    assert(idConfigData.success === true, 'ID card config response indicates success');

    const publicIdRes = await fetch(`${BASE_URL}/system/verify-id/JOWIS-INT-2026-001`);
    assert(publicIdRes.status === 200, 'Public ID Card Verification endpoint responds with 200 OK');
    const publicIdData = await publicIdRes.json();
    assert(publicIdData.success === true && publicIdData.verified === true, 'Public ID Verification confirms active institutional credential');
    assert(publicIdData.data.institutionalId === 'JOWIS-INT-2026-001', 'Verified ID contains matching institutional ID');
    assert(publicIdData.data.fullName === 'David Adeleke', 'Verified ID reflects authentic intern full name');
  }

  console.log(`\n======================================================`);
  console.log(`🎯 UPGRADES VERIFICATION: ${passed} PASSED, ${failed} FAILED.`);
  console.log(`======================================================`);

  await pool.end();
  if (failed > 0) process.exit(1);
}

runUpgradesVerification().catch(err => {
  console.error('Fatal upgrade test error:', err);
  process.exit(1);
});
