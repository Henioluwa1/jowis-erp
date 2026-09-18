import app from '../src/app.js';
import pool, { query } from '../src/config/db.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

const server = http.createServer(app);

async function runPhase6Tests() {
  const PORT = 5099;
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log('=======================================================');
  console.log('⚡  JOWIS STUDIO ERP — PHASE 6 AUTOMATED TEST SUITE');
  console.log('📜  DOCUMENTS, VERIFICATION & CERTIFICATES MANAGEMENT');
  console.log(`🧪  Test server running on http://localhost:${PORT}`);
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
    // SETUP: Authenticate All Roles
    // -------------------------------------------------------------
    console.log('🔹 SETUP: Authenticating users across roles...');

    // 1. Super Admin
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jowis.com', password: 'Admin@12345' })
    });
    const adminData = await adminRes.json();
    assert(adminData.success && adminData.token, 'Super Admin login must succeed');
    const adminToken = adminData.token;

    // 2. Mentor 1: Sam (Lead for Cohort 1 / Mentor for Intern 1)
    const mentor1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mentor.sam@jowis.com', password: 'Mentor@12345' })
    });
    const mentor1Data = await mentor1Res.json();
    assert(mentor1Data.success && mentor1Data.token, 'Mentor 1 (Samuel Adeyemi) login must succeed');
    const mentor1Token = mentor1Data.token;

    // 3. Mentor 2: Chioma (Lead for Cohort 2 / Mentor for Intern 2)
    const mentor2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mentor.chioma@jowis.com', password: 'Mentor@12345' })
    });
    const mentor2Data = await mentor2Res.json();
    assert(mentor2Data.success && mentor2Data.token, 'Mentor 2 (Chioma Okeke) login must succeed');
    const mentor2Token = mentor2Data.token;

    // 4. Intern 1: David Adeleke (Track 1 / Cohort 1)
    const intern1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern@jowis.com', password: 'Intern@12345' })
    });
    const intern1Data = await intern1Res.json();
    assert(intern1Data.success && intern1Data.token, 'Intern 1 (David Adeleke) login must succeed');
    const intern1Token = intern1Data.token;

    // 5. Intern 2: Zainab Bello (Track 2 / Cohort 2)
    const intern2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'intern.zainab@jowis.com', password: 'Intern@12345' })
    });
    const intern2Data = await intern2Res.json();
    assert(intern2Data.success && intern2Data.token, 'Intern 2 (Zainab Bello) login must succeed');
    const intern2Token = intern2Data.token;

    // Clean up test documents and certificates for clean isolation
    await query('DELETE FROM document_versions WHERE document_id IN (SELECT id FROM intern_documents WHERE intern_id = 1)');
    await query('DELETE FROM intern_documents WHERE intern_id = 1');
    await query('DELETE FROM certificates WHERE intern_id = 1');
    await query("UPDATE intern_profiles SET status = 'active' WHERE id = 1");

    // -------------------------------------------------------------
    // GATE 1 & 11: Schema & Data Model Validation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 1 & 11: Schema & Database Table Validation...');

    const tables = ['document_types', 'intern_documents', 'document_versions', 'certificate_types', 'certificates'];
    for (const table of tables) {
      const rows = await query(`
        SELECT COUNT(*) as count FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = ?
      `, [table]);
      assert(rows[0].count > 0, `Table \`${table}\` exists in database`);
    }

    const certCols = await query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'jowis_studio_erp' AND TABLE_NAME = 'certificates'
    `);
    const certColNames = certCols.map(c => c.COLUMN_NAME);
    assert(certColNames.includes('certificate_number'), 'Certificates table has `certificate_number`');
    assert(certColNames.includes('verification_code'), 'Certificates table has `verification_code`');
    assert(certColNames.includes('status'), 'Certificates table has `status`');
    assert(certColNames.includes('pdf_path'), 'Certificates table has `pdf_path`');

    // -------------------------------------------------------------
    // GATE 2: Secure Storage Directory Validation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 2: Secure Storage Directory Validation...');

    const storageRoot = path.join(process.cwd(), 'storage');
    const docsDir = path.join(storageRoot, 'documents');
    const certsDir = path.join(storageRoot, 'certificates');

    assert(fs.existsSync(docsDir), 'Document storage directory exists outside static routes');
    assert(fs.existsSync(certsDir), 'Certificate storage directory exists outside static routes');

    // -------------------------------------------------------------
    // GATE 3: Document Types Management
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 3: Document Types Management...');

    const docTypesRes = await fetch(`${baseUrl}/documents/types`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(docTypesRes.status === 200, 'GET /documents/types returns 200 OK');
    const docTypesData = await docTypesRes.json();
    assert(Array.isArray(docTypesData.data) && docTypesData.data.length >= 5, 'At least 5 default document types exist');

    const natIdType = docTypesData.data.find(d => d.code === 'NATIONAL_ID');
    assert(natIdType && natIdType.is_required === 1, 'Default type NATIONAL_ID exists and is required');

    // Admin creates new document type
    const testTypeCode = `PH6_TEST_${Date.now()}`;
    const createTypeRes = await fetch(`${baseUrl}/documents/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Phase 6 Test Document Type',
        code: testTypeCode,
        description: 'Test document type for Phase 6 test suite',
        category: 'other',
        is_required: 0,
        allowed_file_types: 'pdf,jpg,png',
        max_file_size: 5242880
      })
    });
    assert(createTypeRes.status === 201, 'Admin can create document type');
    const createTypeData = await createTypeRes.json();
    const createdTypeId = createTypeData.data.id;

    // Intern cannot create document type (RBAC)
    const internCreateTypeRes = await fetch(`${baseUrl}/documents/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${intern1Token}` },
      body: JSON.stringify({ name: 'Unauthorized', code: 'UNAUTH' })
    });
    assert(internCreateTypeRes.status === 403, 'Intern is forbidden from creating document types (403)');

    // -------------------------------------------------------------
    // GATE 4: Document Upload & Metadata Tracking
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 4: Document Upload & Metadata Tracking...');

    // Upload a valid PDF file as Intern 1
    const testPdfContent = '%PDF-1.4\n1 0 obj\n<< /Title (Test Document) >>\nendobj\ntrailer\n<< >>\n%%EOF';
    const blob1 = new Blob([testPdfContent], { type: 'application/pdf' });
    const formData1 = new FormData();
    formData1.append('file', blob1, 'test_national_id_v1.pdf');
    formData1.append('document_type_id', natIdType.id);
    formData1.append('title', 'David Adeleke National ID');

    const uploadRes = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${intern1Token}` },
      body: formData1
    });

    assert(uploadRes.status === 201, 'Intern 1 can upload document (201 Created)');
    const uploadData = await uploadRes.json();
    assert(uploadData.data.id, 'Uploaded document returns document ID');
    assert(uploadData.data.status === 'pending_verification', 'Uploaded document initial status is pending_verification');
    assert(uploadData.data.version === 1, 'First upload is version 1');
    const uploadedDocId = uploadData.data.id;

    // Verify stored file on disk
    const [storedDoc] = await query('SELECT * FROM intern_documents WHERE id = ?', [uploadedDocId]);
    assert(storedDoc && fs.existsSync(storedDoc.file_path), 'Uploaded file actually saved to secure disk path');

    // -------------------------------------------------------------
    // GATE 5: Document Verification Workflow (Reject & Verify)
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 5: Document Verification Workflow...');

    // Reject without reason should fail (400)
    const rejectNoReasonRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentor1Token}` },
      body: JSON.stringify({ status: 'rejected' })
    });
    assert(rejectNoReasonRes.status === 400, 'Rejecting document without reason fails (400)');

    // Reject with reason
    const rejectRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mentor1Token}` },
      body: JSON.stringify({ status: 'rejected', rejectionReason: 'Image scan is blurry. Please re-upload clearer copy.' })
    });
    assert(rejectRes.status === 200, 'Mentor 1 can reject document with reason');
    const [rejectedDoc] = await query('SELECT status, rejection_reason FROM intern_documents WHERE id = ?', [uploadedDocId]);
    assert(rejectedDoc.status === 'rejected', 'Document status updated to rejected in database');
    assert(rejectedDoc.rejection_reason.includes('blurry'), 'Rejection reason persisted');

    // Verify document by Admin
    const verifyRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'verified', notes: 'Manually inspected and verified by Admin' })
    });
    assert(verifyRes.status === 200, 'Admin can verify document (200 OK)');
    const [verifiedDoc] = await query('SELECT status, verified_by, verified_at FROM intern_documents WHERE id = ?', [uploadedDocId]);
    assert(verifiedDoc.status === 'verified', 'Document status updated to verified');
    assert(verifiedDoc.verified_by !== null, 'verified_by recorded');

    // -------------------------------------------------------------
    // GATE 6: Document Versioning & History
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 6: Document Versioning & History...');

    // Intern 1 uploads updated version (v2) of the same document type
    const blob2 = new Blob(['%PDF-1.4\nUpdated National ID scan version 2'], { type: 'application/pdf' });
    const formData2 = new FormData();
    formData2.append('file', blob2, 'test_national_id_v2.pdf');
    formData2.append('document_type_id', natIdType.id);
    formData2.append('title', 'David Adeleke National ID (Re-upload)');

    const uploadV2Res = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${intern1Token}` },
      body: formData2
    });
    assert(uploadV2Res.status === 201, 'Re-uploading same document type creates new version');
    const uploadV2Data = await uploadV2Res.json();
    assert(uploadV2Data.data.version === 2, 'Version incremented to 2');
    assert(uploadV2Data.data.status === 'pending_verification', 'New version resets status to pending_verification');

    // Verify version history endpoint
    const versionsRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/versions`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(versionsRes.status === 200, 'GET /documents/:id/versions returns 200 OK');
    const versionsData = await versionsRes.json();
    assert(versionsData.data.length >= 2, 'Version history contains both version 1 and version 2');

    // -------------------------------------------------------------
    // GATE 8: Document Completeness & Checklist
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 8: Document Completeness & Checklist...');

    const completenessRes = await fetch(`${baseUrl}/documents/completeness`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(completenessRes.status === 200, 'GET /documents/completeness returns 200 OK');
    const completenessData = await completenessRes.json();
    assert(completenessData.data.requiredCount >= 3, 'Completeness tracks required document count');
    assert(Array.isArray(completenessData.data.checklist), 'Checklist returned as array');

    // -------------------------------------------------------------
    // GATE 9: Document Security, Scoping & Download Isolation
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 9: Document Security & Access Control...');

    // Intern 2 attempts to download Intern 1's document (MUST FAIL 403)
    const unauthorizedDownloadRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/download`, {
      headers: { Authorization: `Bearer ${intern2Token}` }
    });
    assert(unauthorizedDownloadRes.status === 403, 'Intern 2 forbidden from downloading Intern 1 document (403)');

    // Mentor 2 (Chioma, Cohort 2) attempts to download Intern 1 (Cohort 1) document (MUST FAIL 403)
    const outOfScopeMentorDownload = await fetch(`${baseUrl}/documents/${uploadedDocId}/download`, {
      headers: { Authorization: `Bearer ${mentor2Token}` }
    });
    assert(outOfScopeMentorDownload.status === 403, 'Mentor 2 forbidden from accessing out-of-cohort intern document (403)');

    // Intern 1 downloads own document (MUST SUCCEED 200)
    const ownDownloadRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/download`, {
      headers: { Authorization: `Bearer ${intern1Token}` }
    });
    assert(ownDownloadRes.status === 200, 'Intern 1 can download own document (200 OK)');
    assert(ownDownloadRes.headers.get('content-type') === 'application/pdf', 'Content-Type is application/pdf');

    // Admin downloads Intern 1 document (MUST SUCCEED 200)
    const adminDownloadRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminDownloadRes.status === 200, 'Admin can download any document (200 OK)');

    // -------------------------------------------------------------
    // GATE 10: Certificate Types Management
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 10: Certificate Types Management...');

    const certTypesRes = await fetch(`${baseUrl}/certificates/types`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(certTypesRes.status === 200, 'GET /certificates/types returns 200 OK');
    const certTypesData = await certTypesRes.json();
    assert(certTypesData.data.length >= 3, 'Default certificate types present (>= 3)');

    const compCertType = certTypesData.data.find(c => c.code === 'INTERNSHIP_COMPLETION');
    assert(compCertType && compCertType.name.includes('Completion'), 'INTERNSHIP_COMPLETION certificate type exists');

    // -------------------------------------------------------------
    // GATE 12: Certificate Eligibility Engine
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 12: Certificate Eligibility Engine...');

    // Check eligibility for Intern 1 (Currently active, incomplete)
    const ineligRes = await fetch(`${baseUrl}/certificates/eligibility?internId=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(ineligRes.status === 200, 'GET /certificates/eligibility returns 200 OK');
    const ineligData = await ineligRes.json();
    assert(ineligData.data.isEligible === false, 'Incomplete intern is flagged as NOT eligible');
    assert(ineligData.data.reasons.length > 0, 'Ineligible evaluation provides explicit reasons');
    assert(ineligData.data.criteria.lifecycle !== undefined, 'Evaluation breakdown contains lifecycle criterion');
    assert(ineligData.data.criteria.tasks !== undefined, 'Evaluation breakdown contains tasks criterion');
    assert(ineligData.data.criteria.performance !== undefined, 'Evaluation breakdown contains performance criterion');
    assert(ineligData.data.criteria.documents !== undefined, 'Evaluation breakdown contains documents criterion');

    // -------------------------------------------------------------
    // GATE 13 & 14: Certificate Generation & Issuance
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 13 & 14: Certificate Generation & Issuance...');

    // Set up a dedicated graduated intern in database for full issuance testing
    // 1. Mark Intern 1 documents verified so doc requirement passes
    const reqDocTypes = await query('SELECT id FROM document_types WHERE is_required = 1 AND status = \'active\'');
    for (const rdt of reqDocTypes) {
      const [existing] = await query('SELECT id FROM intern_documents WHERE intern_id = 1 AND document_type_id = ?', [rdt.id]);
      if (existing) {
        await query('UPDATE intern_documents SET status = \'verified\', verified_by = 1, verified_at = NOW(), expiry_date = DATE_ADD(CURDATE(), INTERVAL 1 YEAR) WHERE id = ?', [existing.id]);
      } else {
        await query(`
          INSERT INTO intern_documents (intern_id, document_type_id, title, original_filename, stored_filename, file_path, mime_type, file_size, current_version, status, uploaded_by, verified_by, verified_at, expiry_date)
          VALUES (1, ?, 'Required Doc', 'doc.pdf', 'doc.pdf', 'storage/documents/doc.pdf', 'application/pdf', 1024, 1, 'verified', 1, 1, NOW(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR))
        `, [rdt.id]);
      }
    }

    // 2. Mark all tasks completed for Intern 1
    await query("UPDATE task_assignments SET status = 'completed' WHERE intern_id = 1 AND status != 'cancelled'");

    // 3. Ensure a finalized evaluation exists with score >= 60
    const [evalCheck] = await query("SELECT id FROM performance_evaluations WHERE intern_id = 1 AND status = 'finalized'");
    if (!evalCheck) {
      await query(`
        INSERT INTO performance_evaluations (intern_id, reviewer_id, period_id, overall_score, status, finalized_at)
        VALUES (1, 2, 1, 88.5, 'finalized', NOW())
      `);
    }

    // 4. Mark Intern 1 lifecycle status = 'completed'
    await query("UPDATE intern_profiles SET status = 'completed' WHERE id = 1");

    // Re-check eligibility: should now be 100% eligible!
    const eligPassRes = await fetch(`${baseUrl}/certificates/eligibility?internId=1`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const eligPassData = await eligPassRes.json();
    assert(eligPassData.data.isEligible === true, 'Fully qualified intern passes all 4 institutional criteria (isEligible=true)');

    // Issue Certificate
    // Clean up any existing certificate for intern 1 from prior runs to ensure fresh issuance
    await query('DELETE FROM certificates WHERE intern_id = 1');

    const issueRes = await fetch(`${baseUrl}/certificates/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        intern_id: 1,
        certificate_type_id: compCertType.id,
        signatory_name: 'Dr. John O. Williams',
        signatory_title: 'Executive Director, Jowis Studio'
      })
    });

    assert(issueRes.status === 201, 'Admin can issue certificate for eligible intern (201 Created)');
    const issueData = await issueRes.json();
    assert(issueData.data.certificateNumber.startsWith('JOWIS-'), 'Certificate number follows institutional format (JOWIS-YYYY-XXXXX)');
    assert(issueData.data.verificationCode.startsWith('JW-'), 'Verification code follows format (JW-XXXXXX)');
    const issuedCertNumber = issueData.data.certificateNumber;
    const issuedVerificationCode = issueData.data.verificationCode;
    const issuedCertId = issueData.data.id;

    // Verify PDF file was generated on disk
    const [certRow] = await query('SELECT pdf_path FROM certificates WHERE id = ?', [issuedCertId]);
    assert(certRow && fs.existsSync(certRow.pdf_path), 'Certificate PDF generated on disk');
    const pdfBytes = fs.readFileSync(certRow.pdf_path);
    assert(pdfBytes.slice(0, 5).toString() === '%PDF-', 'Certificate file is valid PDF (starts with %PDF-)');

    // Duplicate Issuance Prevention (Gate 13)
    const duplicateIssueRes = await fetch(`${baseUrl}/certificates/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        intern_id: 1,
        certificate_type_id: compCertType.id
      })
    });
    assert(duplicateIssueRes.status === 409, 'Duplicate certificate issuance for same type is prevented (409 Conflict)');

    // -------------------------------------------------------------
    // GATE 15: Public Certificate Verification (Strict Privacy)
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 15: Public Certificate Verification...');

    // Public verification without JWT
    const publicVerifyRes = await fetch(`${baseUrl}/certificates/verify/${issuedVerificationCode}`);
    assert(publicVerifyRes.status === 200, 'Public verification returns 200 OK without authentication');
    const publicVerifyData = await publicVerifyRes.json();
    assert(publicVerifyData.valid === true, 'Public verification confirms certificate is authentic (valid=true)');
    assert(publicVerifyData.data.recipientName.includes('David'), 'Public verification confirms recipient name');
    assert(publicVerifyData.data.certificateNumber === issuedCertNumber, 'Certificate number matches');

    // PRIVACY LEAK PROTECTION ASSERTIONS:
    assert(publicVerifyData.data.email === undefined, 'ZERO student email leaked in public verification');
    assert(publicVerifyData.data.phone === undefined, 'ZERO student phone leaked in public verification');
    assert(publicVerifyData.data.intern_id === undefined, 'ZERO internal intern_id leaked in public verification');
    assert(publicVerifyData.data.marks === undefined, 'ZERO student marks leaked in public verification');

    // Invalid verification code returns 404
    const invalidVerifyRes = await fetch(`${baseUrl}/certificates/verify/JW-INVALID-9999`);
    assert(invalidVerifyRes.status === 404, 'Non-existent verification code returns 404 Not Found');

    // -------------------------------------------------------------
    // GATE 16: Certificate Revocation Workflow
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 16: Certificate Revocation Workflow...');

    // Revocation without reason fails (400)
    const revokeNoReasonRes = await fetch(`${baseUrl}/certificates/${issuedCertId}/revoke`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({})
    });
    assert(revokeNoReasonRes.status === 400, 'Revoking certificate without reason fails (400)');

    // Revocation with reason succeeds
    const revokeRes = await fetch(`${baseUrl}/certificates/${issuedCertId}/revoke`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ revocationReason: 'Academic misconduct discovered post-graduation' })
    });
    assert(revokeRes.status === 200, 'Admin can revoke certificate with reason (200 OK)');

    // Re-checking public verification for revoked certificate
    const publicVerifyRevokedRes = await fetch(`${baseUrl}/certificates/verify/${issuedVerificationCode}`);
    assert(publicVerifyRevokedRes.status === 200, 'Public verification handles revoked certificate');
    const publicVerifyRevokedData = await publicVerifyRevokedRes.json();
    assert(publicVerifyRevokedData.valid === false, 'Revoked certificate valid is false');
    assert(publicVerifyRevokedData.status === 'revoked', 'Revoked certificate status is revoked');
    assert(publicVerifyRevokedData.data.revocationReason.includes('misconduct'), 'Revocation reason presented publicly');

    // Public download of revoked certificate is blocked (403)
    const publicDownloadRevokedRes = await fetch(`${baseUrl}/certificates/verify/${issuedVerificationCode}/download`);
    assert(publicDownloadRevokedRes.status === 403, 'Downloading revoked certificate via public URL is blocked (403)');

    // -------------------------------------------------------------
    // GATE 17: Certificate History & Download (Authenticated)
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 17: Certificate History & Download...');

    const certListRes = await fetch(`${baseUrl}/certificates`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(certListRes.status === 200, 'GET /certificates returns 200 OK');
    const certListData = await certListRes.json();
    assert(certListData.data.length > 0, 'Certificates registry contains issued/revoked records');

    const certDetailRes = await fetch(`${baseUrl}/certificates/${issuedCertId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(certDetailRes.status === 200, 'GET /certificates/:id returns 200 OK');
    const certDetailData = await certDetailRes.json();
    assert(certDetailData.data.status === 'revoked', 'Certificate details reflect revoked status');

    // -------------------------------------------------------------
    // GATE 18: Audit Logging & Traceability
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 18: Audit Logging & Traceability...');

    const docUploadLogs = await query("SELECT COUNT(*) as count FROM audit_logs WHERE action IN ('DOCUMENT_UPLOADED', 'UPLOAD_DOCUMENT')");
    assert(docUploadLogs[0].count > 0, 'DOCUMENT_UPLOADED audit log entry recorded');

    const docVerifyLogs = await query("SELECT COUNT(*) as count FROM audit_logs WHERE action IN ('DOCUMENT_VERIFIED', 'VERIFY_DOCUMENT')");
    assert(docVerifyLogs[0].count > 0, 'DOCUMENT_VERIFIED audit log entry recorded');

    const certIssueLogs = await query("SELECT COUNT(*) as count FROM audit_logs WHERE action = 'CERTIFICATE_ISSUED'");
    assert(certIssueLogs[0].count > 0, 'CERTIFICATE_ISSUED audit log entry recorded');

    const certRevokeLogs = await query("SELECT COUNT(*) as count FROM audit_logs WHERE action = 'CERTIFICATE_REVOKED'");
    assert(certRevokeLogs[0].count > 0, 'CERTIFICATE_REVOKED audit log entry recorded');

    // -------------------------------------------------------------
    // GATE 19: Path Traversal & Security Hardening
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 19: Path Traversal & Injection Security...');

    const pathTraversalRes = await fetch(`${baseUrl}/documents/..%2F..%2Fetc%2Fpasswd/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pathTraversalRes.status === 400 || pathTraversalRes.status === 404, 'Path traversal attempt rejected safely');

    // -------------------------------------------------------------
    // GATE 20: Regression Validation (Phases 1-5 Endpoints Intact)
    // -------------------------------------------------------------
    console.log('\n🔹 GATE 20: Regression Validation (Phases 1-5 Endpoints)...');

    const healthRes = await fetch(`${baseUrl}/health`);
    assert(healthRes.status === 200, 'Phase 1: /health endpoint 200 OK');

    const internsRes = await fetch(`${baseUrl}/interns`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(internsRes.status === 200, 'Phase 2: /interns endpoint 200 OK');

    const tasksRes = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(tasksRes.status === 200, 'Phase 3: /tasks endpoint 200 OK');

    const perfOverviewRes = await fetch(`${baseUrl}/performance/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(perfOverviewRes.status === 200, 'Phase 4: /performance/overview endpoint 200 OK');

    const reportExecRes = await fetch(`${baseUrl}/reports/executive`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(reportExecRes.status === 200, 'Phase 5: /reports/executive endpoint 200 OK');

    console.log('\n=======================================================');
    console.log(`🎯 ALL PHASE 6 TESTS COMPLETED: ${testPassed} PASSED, ${testFailed} FAILED.`);
    console.log('=======================================================\n');

  } catch (err) {
    console.error('Test Execution Terminated with Error:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      await query("UPDATE intern_profiles SET status = 'active' WHERE id = 1");
    } catch (e) {}
    server.close();
    await pool.end();
  }
}

runPhase6Tests();
