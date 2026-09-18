import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';
import { certificateStorageDir } from '../utils/documentUpload.js';
import { generateCertificatePDF } from '../utils/certificateGenerator.js';

/**
 * Helper to get intern profile ID for a given user ID
 */
const getInternProfileIdForUser = async (userId) => {
  const [profile] = await query(
    'SELECT id FROM intern_profiles WHERE user_id = ?',
    [userId]
  );
  return profile ? profile.id : null;
};

/**
 * Helper: Check if user is an Admin (Super Admin or Admin)
 */
const isAdminRole = (role) => ['super_admin', 'admin'].includes(role);

/**
 * Helper to get mentor ID for a user
 */
const getMentorIdForUser = async (userId) => {
  const [mentor] = await query('SELECT id FROM mentors WHERE user_id = ?', [userId]);
  return mentor ? mentor.id : null;
};

// ==========================================
// 1. CERTIFICATE TYPES MANAGEMENT (Gate 10)
// ==========================================

export const getCertificateTypes = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const { status } = req.query;

    let sql = `
      SELECT ct.*, 
             u.first_name as creator_first, u.last_name as creator_last,
             (SELECT COUNT(*) FROM certificates c WHERE c.certificate_type_id = ct.id) as total_issued
      FROM certificate_types ct
      LEFT JOIN users u ON ct.created_by = u.id
    `;
    const params = [];
    const conditions = [];

    // Non-admins can only see active types
    if (!isAdminRole(userRole)) {
      conditions.push("ct.status = 'active'");
    } else if (status) {
      conditions.push('ct.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY ct.id ASC';

    const types = await query(sql, params);
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('getCertificateTypes error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve certificate types.' });
  }
};

export const createCertificateType = async (req, res) => {
  try {
    const { name, code, description, template_layout, signatory_name, signatory_title } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Certificate type name and code are required.'
      });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    const [existing] = await query(
      'SELECT id FROM certificate_types WHERE code = ?',
      [cleanCode]
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Certificate type with code "${cleanCode}" already exists.`
      });
    }

    const insertResult = await query(`
      INSERT INTO certificate_types 
        (name, code, description, template_layout, signatory_name, signatory_title, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `, [
      name.trim(),
      cleanCode,
      description || null,
      template_layout || 'standard',
      signatory_name || 'Dr. John O. Williams',
      signatory_title || 'Executive Director, Jowis Studio',
      req.user.id
    ]);

    await recordAuditLog(
      req.user.id,
      'CERTIFICATE_TYPE_CREATED',
      'certificate_type',
      insertResult.insertId,
      null,
      { name, code: cleanCode },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Certificate type created successfully.',
      data: { id: insertResult.insertId, name, code: cleanCode }
    });
  } catch (error) {
    console.error('createCertificateType error:', error);
    res.status(500).json({ success: false, message: 'Failed to create certificate type.' });
  }
};

// ==========================================
// 2. ELIGIBILITY ENGINE (Gate 12)
// ==========================================

export const evaluateInternEligibility = async (internId, certificateTypeId = null) => {
  // 1. Fetch Intern Profile
  const [intern] = await query(`
    SELECT ip.id, ip.user_id, ip.intern_code, ip.status, ip.start_date, ip.expected_end_date, ip.actual_end_date,
           u.first_name, u.last_name, u.email,
           t.id as track_id, t.name as track_name, t.code as track_code,
           c.id as cohort_id, c.name as cohort_name, c.cohort_code
    FROM intern_profiles ip
    JOIN users u ON ip.user_id = u.id
    JOIN tracks t ON ip.track_id = t.id
    JOIN cohorts c ON ip.cohort_id = c.id
    WHERE ip.id = ?
  `, [internId]);

  if (!intern) {
    return {
      found: false,
      isEligible: false,
      reasons: ['Intern profile not found.'],
      criteria: null
    };
  }

  // 2. Fetch Certificate Type if provided
  let certType = null;
  if (certificateTypeId) {
    const [ct] = await query('SELECT * FROM certificate_types WHERE id = ?', [certificateTypeId]);
    certType = ct;
  } else {
    // Default to INTERNSHIP_COMPLETION
    const [ct] = await query("SELECT * FROM certificate_types WHERE code = 'INTERNSHIP_COMPLETION' LIMIT 1");
    certType = ct;
  }

  const reasons = [];

  // CRITERION 1: Lifecycle Completion
  // Must be 'completed'
  const isLifecyclePassed = intern.status === 'completed';
  if (!isLifecyclePassed) {
    reasons.push(`Internship lifecycle status is "${intern.status}". Must be formally marked as "completed" to graduate.`);
  }

  // CRITERION 2: Tasks Completion
  const [tasksRow] = await query(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as pending_tasks
    FROM task_assignments
    WHERE intern_id = ? AND status != 'cancelled'
  `, [internId]);

  const totalTasks = Number(tasksRow?.total_tasks || 0);
  const completedTasks = Number(tasksRow?.completed_tasks || 0);
  const pendingTasks = Number(tasksRow?.pending_tasks || 0);

  // If tasks are assigned, all non-cancelled tasks must be completed
  const isTasksPassed = pendingTasks === 0;
  if (!isTasksPassed) {
    reasons.push(`${pendingTasks} assigned curriculum task(s) are incomplete or pending evaluation.`);
  }

  // CRITERION 3: Performance Evaluations
  const [perfRow] = await query(`
    SELECT 
      COUNT(*) as finalized_evaluations,
      AVG(overall_score) as avg_score,
      MIN(overall_score) as min_score,
      MAX(overall_score) as max_score
    FROM performance_evaluations
    WHERE intern_id = ? AND status = 'finalized'
  `, [internId]);

  const finalizedCount = Number(perfRow?.finalized_evaluations || 0);
  const rawAvgScore = perfRow?.avg_score !== null ? Number(perfRow.avg_score) : null;
  const avgScore = rawAvgScore !== null ? Math.round(rawAvgScore * 100) / 100 : 0;

  let isPerfPassed = false;
  let minScoreThreshold = 60.0;

  if (certType && certType.code === 'TRAINING_EXCELLENCE') {
    minScoreThreshold = 85.0;
  }

  if (finalizedCount === 0) {
    reasons.push('At least one finalized performance evaluation is required.');
  } else if (avgScore < minScoreThreshold) {
    reasons.push(`Evaluation average (${avgScore.toFixed(1)}%) does not satisfy the minimum required threshold (${minScoreThreshold.toFixed(1)}%).`);
  } else {
    isPerfPassed = true;
  }

  // CRITERION 4: Document Completeness (All Active & Required Document Types)
  const requiredTypes = await query(`
    SELECT id, name, code, category
    FROM document_types
    WHERE is_required = 1 AND status = 'active'
    ORDER BY id ASC
  `);

  const internDocs = await query(`
    SELECT id, document_type_id, status, expiry_date
    FROM intern_documents
    WHERE intern_id = ?
  `, [internId]);

  const today = new Date().toISOString().split('T')[0];
  const docChecklist = [];
  let missingOrInvalidDocsCount = 0;

  for (const rt of requiredTypes) {
    const matchingDocs = internDocs.filter(d => d.document_type_id === rt.id);
    const verifiedDoc = matchingDocs.find(d => {
      const isVerified = d.status === 'verified';
      const isNotExpired = !d.expiry_date || d.expiry_date >= today;
      return isVerified && isNotExpired;
    });

    const isSatisfied = Boolean(verifiedDoc);
    if (!isSatisfied) {
      missingOrInvalidDocsCount++;
      const existingDoc = matchingDocs[0];
      if (!existingDoc) {
        docChecklist.push({ ...rt, satisfied: false, status: 'missing', reason: 'Not uploaded' });
      } else if (existingDoc.status === 'expired' || (existingDoc.expiry_date && existingDoc.expiry_date < today)) {
        docChecklist.push({ ...rt, satisfied: false, status: 'expired', reason: 'Document has expired' });
      } else if (existingDoc.status === 'rejected') {
        docChecklist.push({ ...rt, satisfied: false, status: 'rejected', reason: 'Document rejected' });
      } else {
        docChecklist.push({ ...rt, satisfied: false, status: existingDoc.status, reason: 'Pending verification' });
      }
    } else {
      docChecklist.push({ ...rt, satisfied: true, status: 'verified', reason: 'Verified and valid' });
    }
  }

  const isDocsPassed = missingOrInvalidDocsCount === 0;
  if (!isDocsPassed) {
    const unverifiedNames = docChecklist.filter(d => !d.satisfied).map(d => `"${d.name}" (${d.reason})`);
    reasons.push(`Required institutional documents missing or unverified: ${unverifiedNames.join(', ')}.`);
  }

  const isEligible = isLifecyclePassed && isTasksPassed && isPerfPassed && isDocsPassed;

  return {
    found: true,
    isEligible,
    intern: {
      id: intern.id,
      userId: intern.user_id,
      internCode: intern.intern_code,
      name: `${intern.first_name} ${intern.last_name}`,
      status: intern.status,
      trackId: intern.track_id,
      cohortId: intern.cohort_id,
      trackName: intern.track_name,
      cohortName: intern.cohort_name,
      completionDate: intern.actual_end_date || intern.expected_end_date || today
    },
    certificateType: certType,
    criteria: {
      lifecycle: {
        passed: isLifecyclePassed,
        currentStatus: intern.status,
        requiredStatus: 'completed'
      },
      tasks: {
        passed: isTasksPassed,
        totalTasks,
        completedTasks,
        pendingTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100
      },
      performance: {
        passed: isPerfPassed,
        finalizedEvaluations: finalizedCount,
        averageScore: avgScore,
        minScoreRequired: minScoreThreshold
      },
      documents: {
        passed: isDocsPassed,
        requiredCount: requiredTypes.length,
        verifiedCount: requiredTypes.length - missingOrInvalidDocsCount,
        checklist: docChecklist
      }
    },
    reasons
  };
};

export const checkEligibility = async (req, res) => {
  try {
    const userRole = req.user?.role;
    let internId = req.params.internId || req.query.internId;
    const certificateTypeId = req.query.certificateTypeId;

    // If intern role, enforce their own intern_id
    if (userRole === 'intern') {
      const ownInternId = await getInternProfileIdForUser(req.user.id);
      if (!ownInternId) {
        return res.status(403).json({ success: false, message: 'Intern profile not found.' });
      }
      internId = ownInternId;
    }

    if (!internId) {
      return res.status(400).json({ success: false, message: 'internId is required.' });
    }

    // If mentor role, verify intern is in their cohort or assigned
    if (userRole === 'mentor') {
      const mentorId = await getMentorIdForUser(req.user.id);
      const [accessible] = await query(`
        SELECT ip.id FROM intern_profiles ip
        JOIN cohorts c ON ip.cohort_id = c.id
        WHERE ip.id = ? AND (ip.mentor_id = ? OR c.lead_mentor_id = ?)
      `, [internId, mentorId, mentorId]);

      if (!accessible) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Intern is outside your mentored cohorts.'
        });
      }
    }

    const eligibility = await evaluateInternEligibility(internId, certificateTypeId);
    if (!eligibility.found) {
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }

    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    console.error('checkEligibility error:', error);
    res.status(500).json({ success: false, message: 'Failed to evaluate eligibility.' });
  }
};

// ==========================================
// 3. CERTIFICATE ISSUANCE (Gate 13 & 14)
// ==========================================

export const issueCertificate = async (req, res) => {
  try {
    const { intern_id, certificate_type_id, signatory_name, signatory_title, completion_date, override_eligibility } = req.body;

    if (!intern_id) {
      return res.status(400).json({ success: false, message: 'intern_id is required.' });
    }

    // 1. Evaluate Server-Side Eligibility (Never trust client claims)
    const eligibility = await evaluateInternEligibility(intern_id, certificate_type_id);
    if (!eligibility.found) {
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }

    // Only super_admin can explicitly override eligibility with documented audit reason
    const canOverride = req.user.role === 'super_admin' && override_eligibility === true;
    if (!eligibility.isEligible && !canOverride) {
      return res.status(400).json({
        success: false,
        message: 'Intern does not meet the institutional eligibility requirements for certificate issuance.',
        reasons: eligibility.reasons,
        criteria: eligibility.criteria
      });
    }

    const certType = eligibility.certificateType;
    const certTypeId = certType ? certType.id : 1;

    // 2. Prevent Duplicate Active Certificates for same type
    const [existingCert] = await query(`
      SELECT id, certificate_number, status, issue_date 
      FROM certificates 
      WHERE intern_id = ? AND certificate_type_id = ? AND status = 'issued'
    `, [intern_id, certTypeId]);

    if (existingCert) {
      return res.status(409).json({
        success: false,
        message: `An active certificate has already been issued for this intern (${existingCert.certificate_number}).`,
        data: existingCert
      });
    }

    // 3. Generate Sequential Certificate Number (JOWIS-YYYY-XXXXX)
    const currentYear = new Date().getFullYear();
    const [cntRow] = await query(`
      SELECT COUNT(*) as count FROM certificates 
      WHERE certificate_number LIKE ?
    `, [`JOWIS-${currentYear}-%`]);

    let seqNumber = (cntRow.count + 1);
    let certificateNumber = `JOWIS-${currentYear}-${String(seqNumber).padStart(5, '0')}`;

    // Collision guard
    let [collision] = await query('SELECT id FROM certificates WHERE certificate_number = ?', [certificateNumber]);
    while (collision) {
      seqNumber++;
      certificateNumber = `JOWIS-${currentYear}-${String(seqNumber).padStart(5, '0')}`;
      [collision] = await query('SELECT id FROM certificates WHERE certificate_number = ?', [certificateNumber]);
    }

    // 4. Generate Cryptographically Secure Verification Code (JW-XXXXXXXXXXXX)
    const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    const verificationCode = `JW-${randomHex}`;

    const effectiveSignatoryName = signatory_name || certType?.signatory_name || 'Dr. John O. Williams';
    const effectiveSignatoryTitle = signatory_title || certType?.signatory_title || 'Executive Director, Jowis Studio';
    const effectiveCompletionDate = completion_date || eligibility.intern.completionDate;
    const today = new Date().toISOString().split('T')[0];

    // 5. Generate Landscape PDF Certificate
    const pdfFilename = `cert_${certificateNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const pdfDiskPath = path.join(certificateStorageDir, pdfFilename);

    await generateCertificatePDF({
      internName: eligibility.intern.name,
      certificateNumber,
      verificationCode,
      certificateTitle: certType?.name || 'INTERNSHIP COMPLETION CERTIFICATE',
      trackName: eligibility.intern.trackName,
      cohortName: eligibility.intern.cohortName,
      issueDate: today,
      completionDate: effectiveCompletionDate,
      signatoryName: effectiveSignatoryName,
      signatoryTitle: effectiveSignatoryTitle,
      outputPath: pdfDiskPath
    });

    const metadata = {
      internCode: eligibility.intern.internCode,
      trackName: eligibility.intern.trackName,
      cohortName: eligibility.intern.cohortName,
      issuedByUserId: req.user.id,
      overridden: canOverride && !eligibility.isEligible,
      criteriaSnapshot: eligibility.criteria
    };

    // 6. Insert Certificate Record
    const insertResult = await query(`
      INSERT INTO certificates (
        certificate_code, intern_id, certificate_type_id, certificate_number, verification_code,
        track_id, cohort_id,
        issue_date, completion_date, signatory_name, signatory_title,
        status, issued_by, pdf_path, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?)
    `, [
      certificateNumber,
      intern_id,
      certTypeId,
      certificateNumber,
      verificationCode,
      eligibility.intern.trackId,
      eligibility.intern.cohortId,
      today,
      effectiveCompletionDate,
      effectiveSignatoryName,
      effectiveSignatoryTitle,
      req.user.id,
      pdfDiskPath,
      JSON.stringify(metadata)
    ]);

    const newCertId = insertResult.insertId;

    // 7. Audit Log
    await recordAuditLog(
      req.user.id,
      'CERTIFICATE_ISSUED',
      'certificate',
      newCertId,
      null,
      {
        certificateNumber,
        verificationCode,
        internId: intern_id,
        internName: eligibility.intern.name,
        certificateTypeId: certTypeId
      },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Certificate issued successfully.',
      data: {
        id: newCertId,
        certificateNumber,
        verificationCode,
        issueDate: today,
        internName: eligibility.intern.name,
        certificateTitle: certType?.name || 'Internship Completion Certificate',
        status: 'issued'
      }
    });
  } catch (error) {
    console.error('issueCertificate error:', error);
    res.status(500).json({ success: false, message: 'Failed to issue certificate.' });
  }
};

// ==========================================
// 4. CERTIFICATE REVOCATION (Gate 16)
// ==========================================

export const revokeCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { revocationReason } = req.body;

    if (!revocationReason || !revocationReason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A formal revocation reason is mandatory.'
      });
    }

    const [cert] = await query('SELECT * FROM certificates WHERE id = ?', [id]);
    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    if (cert.status === 'revoked') {
      return res.status(400).json({
        success: false,
        message: 'Certificate is already revoked.'
      });
    }

    await query(`
      UPDATE certificates 
      SET status = 'revoked',
          revocation_reason = ?,
          revoked_by = ?,
          revoked_at = NOW()
      WHERE id = ?
    `, [revocationReason.trim(), req.user.id, id]);

    await recordAuditLog(
      req.user.id,
      'CERTIFICATE_REVOKED',
      'certificate',
      id,
      { status: cert.status },
      { status: 'revoked', revocationReason: revocationReason.trim() },
      req
    );

    res.json({
      success: true,
      message: 'Certificate revoked successfully.',
      data: {
        id: Number(id),
        certificateNumber: cert.certificate_number,
        status: 'revoked',
        revocationReason: revocationReason.trim(),
        revokedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('revokeCertificate error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke certificate.' });
  }
};

// ==========================================
// 5. CERTIFICATE LIST & DETAILS (Gate 17)
// ==========================================

export const getCertificates = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const { page = 1, limit = 20, search, status, certificateTypeId, cohortId, trackId, internId } = req.query;

    const conditions = [];
    const params = [];

    // RBAC Scoping
    if (userRole === 'intern') {
      const ownInternId = await getInternProfileIdForUser(req.user.id);
      if (!ownInternId) {
        return res.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } });
      }
      conditions.push('c.intern_id = ?');
      params.push(ownInternId);
    } else if (userRole === 'mentor') {
      const mentorId = await getMentorIdForUser(req.user.id);
      conditions.push(`(ip.mentor_id = ? OR ch.lead_mentor_id = ?)`);
      params.push(mentorId, mentorId);
    }

    if (internId) {
      conditions.push('c.intern_id = ?');
      params.push(internId);
    }

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (certificateTypeId) {
      conditions.push('c.certificate_type_id = ?');
      params.push(certificateTypeId);
    }

    if (cohortId) {
      conditions.push('ip.cohort_id = ?');
      params.push(cohortId);
    }

    if (trackId) {
      conditions.push('ip.track_id = ?');
      params.push(trackId);
    }

    if (search) {
      conditions.push(`(
        c.certificate_number LIKE ? OR 
        c.verification_code LIKE ? OR 
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        ip.intern_code LIKE ?
      )`);
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const certs = await query(`
      SELECT c.*,
             ct.name as certificate_title, ct.code as certificate_type_code,
             ip.intern_code,
             u.first_name as intern_first, u.last_name as intern_last, u.email as intern_email,
             t.name as track_name,
             ch.name as cohort_name,
             iu.first_name as issuer_first, iu.last_name as issuer_last,
             ru.first_name as revoker_first, ru.last_name as revoker_last
      FROM certificates c
      JOIN intern_profiles ip ON c.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN certificate_types ct ON c.certificate_type_id = ct.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts ch ON ip.cohort_id = ch.id
      LEFT JOIN users iu ON c.issued_by = iu.id
      LEFT JOIN users ru ON c.revoked_by = ru.id
      ${whereClause}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    const [cnt] = await query(`
      SELECT COUNT(*) as count
      FROM certificates c
      JOIN intern_profiles ip ON c.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN cohorts ch ON ip.cohort_id = ch.id
      ${whereClause}
    `, params);

    res.json({
      success: true,
      data: certs,
      pagination: {
        total: cnt.count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(cnt.count / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('getCertificates error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve certificates.' });
  }
};

export const getCertificateById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    const [cert] = await query(`
      SELECT c.*,
             ct.name as certificate_title, ct.code as certificate_type_code,
             ip.intern_code, ip.user_id as intern_user_id, ip.mentor_id,
             u.first_name as intern_first, u.last_name as intern_last, u.email as intern_email,
             t.name as track_name,
             ch.name as cohort_name, ch.lead_mentor_id,
             iu.first_name as issuer_first, iu.last_name as issuer_last,
             ru.first_name as revoker_first, ru.last_name as revoker_last
      FROM certificates c
      JOIN intern_profiles ip ON c.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN certificate_types ct ON c.certificate_type_id = ct.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts ch ON ip.cohort_id = ch.id
      LEFT JOIN users iu ON c.issued_by = iu.id
      LEFT JOIN users ru ON c.revoked_by = ru.id
      WHERE c.id = ?
    `, [id]);

    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    // RBAC check
    if (userRole === 'intern' && cert.intern_user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Not your certificate.' });
    }

    if (userRole === 'mentor') {
      const mentorId = await getMentorIdForUser(req.user.id);
      if (cert.mentor_id !== mentorId && cert.lead_mentor_id !== mentorId) {
        return res.status(403).json({ success: false, message: 'Access denied: Intern outside mentored scope.' });
      }
    }

    res.json({ success: true, data: cert });
  } catch (error) {
    console.error('getCertificateById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve certificate.' });
  }
};

// ==========================================
// 6. CERTIFICATE DOWNLOAD (Authenticated)
// ==========================================

export const downloadCertificatePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    const [cert] = await query(`
      SELECT c.*,
             ct.name as certificate_title,
             ip.user_id as intern_user_id, ip.mentor_id,
             u.first_name, u.last_name,
             t.name as track_name,
             ch.name as cohort_name, ch.lead_mentor_id
      FROM certificates c
      JOIN intern_profiles ip ON c.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN certificate_types ct ON c.certificate_type_id = ct.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts ch ON ip.cohort_id = ch.id
      WHERE c.id = ?
    `, [id]);

    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    // RBAC check
    if (userRole === 'intern' && cert.intern_user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: Not your certificate.' });
    }

    if (userRole === 'mentor') {
      const mentorId = await getMentorIdForUser(req.user.id);
      if (cert.mentor_id !== mentorId && cert.lead_mentor_id !== mentorId) {
        return res.status(403).json({ success: false, message: 'Access denied: Intern outside mentored scope.' });
      }
    }

    let filePath = cert.pdf_path;
    if (!filePath || !fs.existsSync(filePath)) {
      // Regenerate certificate PDF if missing
      const safeNum = cert.certificate_number.replace(/[^a-zA-Z0-9_-]/g, '_');
      filePath = path.join(certificateStorageDir, `cert_${safeNum}.pdf`);

      await generateCertificatePDF({
        internName: `${cert.first_name} ${cert.last_name}`,
        certificateNumber: cert.certificate_number,
        verificationCode: cert.verification_code,
        certificateTitle: cert.certificate_title || 'INTERNSHIP COMPLETION CERTIFICATE',
        trackName: cert.track_name,
        cohortName: cert.cohort_name,
        issueDate: cert.issue_date,
        completionDate: cert.completion_date || cert.issue_date,
        signatoryName: cert.signatory_name || 'Dr. John O. Williams',
        signatoryTitle: cert.signatory_title || 'Executive Director, Jowis Studio',
        outputPath: filePath
      });

      await query('UPDATE certificates SET pdf_path = ? WHERE id = ?', [filePath, id]);
    }

    const downloadFilename = `${cert.certificate_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${downloadFilename}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.on('error', (streamErr) => {
      console.error('Certificate stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream certificate file.' });
      }
    });
    readStream.pipe(res);
  } catch (error) {
    console.error('downloadCertificatePDF error:', error);
    res.status(500).json({ success: false, message: 'Failed to download certificate.' });
  }
};

// ==========================================
// 7. PUBLIC VERIFICATION & DOWNLOAD (Gate 15)
// ==========================================

export const verifyPublicCertificate = async (req, res) => {
  try {
    const { verificationCode } = req.params;

    if (!verificationCode || !verificationCode.trim()) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Verification code is required.'
      });
    }

    const cleanCode = verificationCode.trim().toUpperCase();

    const [cert] = await query(`
      SELECT c.certificate_number, c.verification_code, c.status, c.issue_date, c.completion_date,
             c.signatory_name, c.signatory_title, c.revocation_reason, c.revoked_at,
             ct.name as certificate_title,
             u.first_name, u.last_name,
             t.name as track_name,
             ch.name as cohort_name
      FROM certificates c
      JOIN intern_profiles ip ON c.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN certificate_types ct ON c.certificate_type_id = ct.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts ch ON ip.cohort_id = ch.id
      WHERE c.verification_code = ?
    `, [cleanCode]);

    if (!cert) {
      return res.status(404).json({
        success: false,
        valid: false,
        status: 'not_found',
        message: 'Invalid certificate verification code. No matching institutional credential found.'
      });
    }

    // STRICT PRIVACY PROTECTION (Gate 15)
    // ZERO student marks, internal grades, emails, phone numbers, intern IDs, or internal notes are returned.
    if (cert.status === 'revoked') {
      return res.json({
        success: true,
        valid: false,
        status: 'revoked',
        message: 'This certificate was previously issued but has been formally REVOKED by Jowis Studio.',
        data: {
          certificateNumber: cert.certificate_number,
          verificationCode: cert.verification_code,
          status: 'revoked',
          revocationReason: cert.revocation_reason,
          revokedAt: cert.revoked_at,
          certificateTitle: cert.certificate_title || 'Internship Completion Certificate',
          issueDate: cert.issue_date,
          recipientName: `${cert.first_name} ${cert.last_name}`,
          trackName: cert.track_name
        }
      });
    }

    res.json({
      success: true,
      valid: true,
      status: 'issued',
      message: 'Certificate is authentic and formally verified by Jowis Studio Enterprise Registry.',
      data: {
        certificateNumber: cert.certificate_number,
        verificationCode: cert.verification_code,
        status: 'issued',
        recipientName: `${cert.first_name} ${cert.last_name}`,
        trackName: cert.track_name,
        cohortName: cert.cohort_name,
        certificateTitle: cert.certificate_title || 'Internship Completion Certificate',
        issueDate: cert.issue_date,
        completionDate: cert.completion_date || cert.issue_date,
        signatoryName: cert.signatory_name,
        signatoryTitle: cert.signatory_title,
        issuerOrganization: 'Jowis Studio — Technology Training & Internship Center'
      }
    });
  } catch (error) {
    console.error('verifyPublicCertificate error:', error);
    res.status(500).json({ success: false, valid: false, message: 'Verification lookup failed.' });
  }
};

export const downloadPublicCertificatePDF = async (req, res) => {
  try {
    const { verificationCode } = req.params;

    if (!verificationCode) {
      return res.status(400).json({ success: false, message: 'Verification code is required.' });
    }

    const cleanCode = verificationCode.trim().toUpperCase();

    const [cert] = await query(`
      SELECT c.*,
             ct.name as certificate_title,
             u.first_name, u.last_name,
             t.name as track_name,
             ch.name as cohort_name
      FROM certificates c
      JOIN intern_profiles ip ON c.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN certificate_types ct ON c.certificate_type_id = ct.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts ch ON ip.cohort_id = ch.id
      WHERE c.verification_code = ?
    `, [cleanCode]);

    if (!cert) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    if (cert.status === 'revoked') {
      return res.status(403).json({
        success: false,
        message: 'This certificate has been revoked and cannot be downloaded.'
      });
    }

    let filePath = cert.pdf_path;
    if (!filePath || !fs.existsSync(filePath)) {
      const safeNum = cert.certificate_number.replace(/[^a-zA-Z0-9_-]/g, '_');
      filePath = path.join(certificateStorageDir, `cert_${safeNum}.pdf`);

      await generateCertificatePDF({
        internName: `${cert.first_name} ${cert.last_name}`,
        certificateNumber: cert.certificate_number,
        verificationCode: cert.verification_code,
        certificateTitle: cert.certificate_title || 'INTERNSHIP COMPLETION CERTIFICATE',
        trackName: cert.track_name,
        cohortName: cert.cohort_name,
        issueDate: cert.issue_date,
        completionDate: cert.completion_date || cert.issue_date,
        signatoryName: cert.signatory_name || 'Dr. John O. Williams',
        signatoryTitle: cert.signatory_title || 'Executive Director, Jowis Studio',
        outputPath: filePath
      });

      await query('UPDATE certificates SET pdf_path = ? WHERE id = ?', [filePath, cert.id]);
    }

    const downloadFilename = `${cert.certificate_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${downloadFilename}"`);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    console.error('downloadPublicCertificatePDF error:', error);
    res.status(500).json({ success: false, message: 'Failed to download certificate.' });
  }
};
