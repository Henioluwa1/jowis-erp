import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';
import { documentStorageDir } from '../utils/documentUpload.js';
import path from 'path';
import fs from 'fs';

// ============================================================================
// GATE 3: DOCUMENT TYPE MANAGEMENT
// ============================================================================

export const getDocumentTypes = async (req, res) => {
  try {
    const { category, status } = req.query;
    let conds = [];
    let params = [];

    // If intern, only show active document types
    if (req.user?.role === 'intern') {
      conds.push("status = 'active'");
    } else if (status && status !== 'ALL') {
      conds.push("status = ?");
      params.push(status);
    }

    if (category && category !== 'ALL') {
      conds.push("category = ?");
      params.push(category);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await query(`
      SELECT dt.*, u.first_name as creator_first, u.last_name as creator_last
      FROM document_types dt
      LEFT JOIN users u ON dt.created_by = u.id
      ${where}
      ORDER BY dt.is_required DESC, dt.name ASC
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getDocumentTypes error:', err);
    res.status(500).json({ success: false, message: 'Failed to load document types.' });
  }
};

export const createDocumentType = async (req, res) => {
  try {
    const { name, code, description, category, is_required, allowed_file_types, max_file_size } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Document type name and code are required.' });
    }

    const cleanCode = String(code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    const [existing] = await query("SELECT id FROM document_types WHERE code = ?", [cleanCode]);
    if (existing) {
      return res.status(400).json({ success: false, message: `Document type code '${cleanCode}' already exists.` });
    }

    const insertResult = await query(`
      INSERT INTO document_types (name, code, description, category, is_required, allowed_file_types, max_file_size, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [
      name.trim(),
      cleanCode,
      description || null,
      category || 'other',
      is_required ? 1 : 0,
      allowed_file_types || 'pdf,jpg,jpeg,png',
      max_file_size || 10485760,
      req.user.id
    ]);

    const createdId = insertResult.insertId;
    await recordAuditLog(req.user.id, 'CREATE_DOCUMENT_TYPE', 'document_types', createdId, null, { name, code: cleanCode }, req);

    res.status(201).json({
      success: true,
      message: 'Document type created successfully.',
      data: { id: createdId, code: cleanCode, name }
    });
  } catch (err) {
    console.error('createDocumentType error:', err);
    res.status(500).json({ success: false, message: 'Failed to create document type.' });
  }
};

export const updateDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, is_required, allowed_file_types, max_file_size, status } = req.body;

    const [existing] = await query("SELECT * FROM document_types WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Document type not found.' });
    }

    await query(`
      UPDATE document_types
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          category = COALESCE(?, category),
          is_required = COALESCE(?, is_required),
          allowed_file_types = COALESCE(?, allowed_file_types),
          max_file_size = COALESCE(?, max_file_size),
          status = COALESCE(?, status)
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      category || null,
      is_required !== undefined ? (is_required ? 1 : 0) : null,
      allowed_file_types || null,
      max_file_size || null,
      status || null,
      id
    ]);

    await recordAuditLog(req.user.id, 'UPDATE_DOCUMENT_TYPE', 'document_types', id, existing, req.body, req);

    res.json({ success: true, message: 'Document type updated successfully.' });
  } catch (err) {
    console.error('updateDocumentType error:', err);
    res.status(500).json({ success: false, message: 'Failed to update document type.' });
  }
};

export const deleteOrDeactivateDocumentType = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await query("SELECT * FROM document_types WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Document type not found.' });
    }

    // Deletion Guard (Gate 3): Check if documents reference this type
    const [docCount] = await query("SELECT COUNT(*) as count FROM intern_documents WHERE document_type_id = ?", [id]);
    if (docCount && parseInt(docCount.count, 10) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete document type '${existing.name}'. It is referenced by ${docCount.count} existing uploaded documents. Deactivate it instead.`
      });
    }

    await query("DELETE FROM document_types WHERE id = ?", [id]);
    await recordAuditLog(req.user.id, 'DELETE_DOCUMENT_TYPE', 'document_types', id, existing, null, req);

    res.json({ success: true, message: 'Document type deleted successfully.' });
  } catch (err) {
    console.error('deleteOrDeactivateDocumentType error:', err);
    res.status(500).json({ success: false, message: 'Failed to process document type removal.' });
  }
};


// ============================================================================
// GATES 2, 4, 7: DOCUMENT UPLOAD, VERSIONING & WORKFLOW
// ============================================================================

export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded.' });
    }

    let { document_type_id, intern_id, title, notes, expiry_date } = req.body;

    // RBAC: If intern, intern_id is strictly locked to own profile
    if (req.user.role === 'intern') {
      intern_id = req.user.internProfileId;
    } else if (!intern_id) {
      return res.status(400).json({ success: false, message: 'Target intern_id is required.' });
    }

    const [docType] = await query("SELECT * FROM document_types WHERE id = ?", [document_type_id]);
    if (!docType || docType.status !== 'active') {
      // Remove uploaded file from disk if type invalid
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid or inactive document type specified.' });
    }

    // Verify intern exists
    const [intern] = await query("SELECT id FROM intern_profiles WHERE id = ?", [intern_id]);
    if (!intern) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Intern profile not found.' });
    }

    const originalFilename = req.file.originalname;
    const storedFilename = req.file.filename;
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;
    const docTitle = title ? title.trim() : (docType.name || originalFilename);

    // Check if an intern document record already exists for this intern and type
    const [existingDoc] = await query(
      "SELECT * FROM intern_documents WHERE intern_id = ? AND document_type_id = ?",
      [intern_id, document_type_id]
    );

    let documentId;
    let versionNumber = 1;

    if (existingDoc) {
      // Create new version (Gate 1 & Gate 2 version history preservation)
      versionNumber = existingDoc.current_version + 1;
      documentId = existingDoc.id;

      await query(`
        UPDATE intern_documents
        SET title = ?,
            original_filename = ?,
            stored_filename = ?,
            file_path = ?,
            mime_type = ?,
            file_size = ?,
            current_version = ?,
            status = 'pending_verification',
            uploaded_by = ?,
            uploaded_at = NOW(),
            verified_by = NULL,
            verified_at = NULL,
            rejection_reason = NULL,
            expiry_date = ?,
            notes = ?
        WHERE id = ?
      `, [
        docTitle,
        originalFilename,
        storedFilename,
        filePath,
        mimeType,
        fileSize,
        versionNumber,
        req.user.id,
        expiry_date || null,
        notes || null,
        documentId
      ]);

      await query(`
        INSERT INTO document_versions
          (document_id, version_number, original_filename, stored_filename, file_path, mime_type, file_size, uploaded_by, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?)
      `, [
        documentId,
        versionNumber,
        originalFilename,
        storedFilename,
        filePath,
        mimeType,
        fileSize,
        req.user.id,
        notes || null
      ]);

      await recordAuditLog(req.user.id, 'CREATE_DOCUMENT_VERSION', 'intern_documents', documentId, { version: existingDoc.current_version }, { version: versionNumber, file: storedFilename }, req);
    } else {
      // First upload for this document type
      const insertResult = await query(`
        INSERT INTO intern_documents
          (intern_id, document_type_id, title, original_filename, stored_filename, file_path, mime_type, file_size, current_version, status, uploaded_by, uploaded_at, expiry_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_verification', ?, NOW(), ?, ?)
      `, [
        intern_id,
        document_type_id,
        docTitle,
        originalFilename,
        storedFilename,
        filePath,
        mimeType,
        fileSize,
        req.user.id,
        expiry_date || null,
        notes || null
      ]);

      documentId = insertResult.insertId;

      await query(`
        INSERT INTO document_versions
          (document_id, version_number, original_filename, stored_filename, file_path, mime_type, file_size, uploaded_by, status, notes)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'pending_verification', ?)
      `, [
        documentId,
        originalFilename,
        storedFilename,
        filePath,
        mimeType,
        fileSize,
        req.user.id,
        notes || null
      ]);

      await recordAuditLog(req.user.id, 'UPLOAD_DOCUMENT', 'intern_documents', documentId, null, { intern_id, document_type_id, file: storedFilename }, req);
    }

    res.status(201).json({
      success: true,
      message: versionNumber > 1 ? `Document version ${versionNumber} uploaded successfully.` : 'Document uploaded successfully.',
      data: {
        id: documentId,
        internId: intern_id,
        documentTypeId: document_type_id,
        version: versionNumber,
        status: 'pending_verification'
      }
    });
  } catch (err) {
    console.error('uploadDocument error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Failed to upload document.' });
  }
};

export const verifyOrRejectDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, notes, expiryDate } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'verified' or 'rejected'." });
    }

    if (status === 'rejected' && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ success: false, message: 'A rejection reason is mandatory when rejecting a document.' });
    }

    const [doc] = await query("SELECT * FROM intern_documents WHERE id = ?", [id]);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    await query(`
      UPDATE intern_documents
      SET status = ?,
          verified_by = ?,
          verified_at = NOW(),
          rejection_reason = ?,
          notes = COALESCE(?, notes),
          expiry_date = COALESCE(?, expiry_date)
      WHERE id = ?
    `, [
      status,
      req.user.id,
      status === 'rejected' ? rejectionReason.trim() : null,
      notes || null,
      expiryDate || null,
      id
    ]);

    // Update current version record as well
    await query(`
      UPDATE document_versions
      SET status = ?,
          verified_by = ?,
          verified_at = NOW(),
          rejection_reason = ?,
          notes = COALESCE(?, notes)
      WHERE document_id = ? AND version_number = ?
    `, [
      status,
      req.user.id,
      status === 'rejected' ? rejectionReason.trim() : null,
      notes || null,
      id,
      doc.current_version
    ]);

    const action = status === 'verified' ? 'VERIFY_DOCUMENT' : 'REJECT_DOCUMENT';
    await recordAuditLog(req.user.id, action, 'intern_documents', id, { previousStatus: doc.status }, { newStatus: status, rejectionReason }, req);

    res.json({
      success: true,
      message: `Document ${status === 'verified' ? 'verified' : 'rejected'} successfully.`
    });
  } catch (err) {
    console.error('verifyOrRejectDocument error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify or reject document.' });
  }
};


// ============================================================================
// GATES 8 & 9: DOCUMENT COMPLETENESS & EXPIRY
// ============================================================================

export const getDocumentCompleteness = async (req, res) => {
  try {
    let internId = req.params.internId;

    if (req.user.role === 'intern') {
      internId = req.user.internProfileId;
    } else if (!internId) {
      return res.status(400).json({ success: false, message: 'internId is required.' });
    }

    // Mentor scoping check
    if (req.user.role === 'mentor') {
      const [assigned] = await query(`
        SELECT ip.id FROM intern_profiles ip
        LEFT JOIN cohorts c ON ip.cohort_id = c.id
        WHERE ip.id = ? AND (ip.mentor_id = ? OR c.lead_mentor_id = ?)
      `, [internId, req.user.mentorId, req.user.mentorId]);

      if (!assigned) {
        return res.status(403).json({ success: false, message: 'Access denied: You do not supervise this intern.' });
      }
    }

    // 1. Fetch all active required document types
    const requiredTypes = await query(`
      SELECT * FROM document_types
      WHERE is_required = 1 AND status = 'active'
      ORDER BY name ASC
    `);

    // 2. Fetch all documents uploaded by this intern
    const internDocs = await query(`
      SELECT id.*, dt.name as type_name, dt.code as type_code, dt.is_required
      FROM intern_documents id
      JOIN document_types dt ON id.document_type_id = dt.id
      WHERE id.intern_id = ?
    `, [internId]);

    const docMap = new Map();
    internDocs.forEach(d => docMap.set(d.document_type_id, d));

    let verifiedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;
    let missingCount = 0;
    let expiredCount = 0;

    const checklist = requiredTypes.map(rt => {
      const doc = docMap.get(rt.id);
      if (!doc) {
        missingCount++;
        return {
          documentTypeId: rt.id,
          name: rt.name,
          code: rt.code,
          category: rt.category,
          status: 'missing',
          documentId: null,
          verified: false
        };
      }

      // Check server-side expiration (Gate 8)
      const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
      if (isExpired) {
        expiredCount++;
        return {
          documentTypeId: rt.id,
          name: rt.name,
          code: rt.code,
          category: rt.category,
          status: 'expired',
          documentId: doc.id,
          expiryDate: doc.expiry_date,
          verified: false
        };
      }

      if (doc.status === 'verified') {
        verifiedCount++;
        return {
          documentTypeId: rt.id,
          name: rt.name,
          code: rt.code,
          category: rt.category,
          status: 'verified',
          documentId: doc.id,
          verified: true
        };
      } else if (doc.status === 'rejected') {
        rejectedCount++;
        return {
          documentTypeId: rt.id,
          name: rt.name,
          code: rt.code,
          category: rt.category,
          status: 'rejected',
          documentId: doc.id,
          rejectionReason: doc.rejection_reason,
          verified: false
        };
      } else {
        pendingCount++;
        return {
          documentTypeId: rt.id,
          name: rt.name,
          code: rt.code,
          category: rt.category,
          status: 'pending_verification',
          documentId: doc.id,
          verified: false
        };
      }
    });

    const isComplete = requiredTypes.length > 0 && verifiedCount === requiredTypes.length;

    res.json({
      success: true,
      data: {
        internId: parseInt(internId, 10),
        totalRequired: requiredTypes.length,
        requiredCount: requiredTypes.length,
        verifiedCount,
        pendingCount,
        rejectedCount,
        missingCount,
        expiredCount,
        isComplete,
        checklist
      }
    });
  } catch (err) {
    console.error('getDocumentCompleteness error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute document completeness.' });
  }
};


// ============================================================================
// GATES 5 & 6: DIRECTORY, WORKSPACES & FILTERS
// ============================================================================

export const getDocuments = async (req, res) => {
  try {
    const { internId, documentTypeId, status, cohortId, trackId, search } = req.query;
    const page = parseInt(req.query.page || 1, 10);
    const limit = parseInt(req.query.limit || 50, 10);
    const offset = (page - 1) * limit;

    let conds = [];
    let params = [];

    // RBAC Scoping
    if (req.user.role === 'intern') {
      conds.push("idoc.intern_id = ?");
      params.push(req.user.internProfileId);
    } else if (req.user.role === 'mentor') {
      conds.push("(ip.mentor_id = ? OR c.lead_mentor_id = ?)");
      params.push(req.user.mentorId, req.user.mentorId);
    }

    if (internId) {
      conds.push("idoc.intern_id = ?");
      params.push(internId);
    }
    if (documentTypeId && documentTypeId !== 'ALL') {
      conds.push("idoc.document_type_id = ?");
      params.push(documentTypeId);
    }
    if (status && status !== 'ALL') {
      conds.push("idoc.status = ?");
      params.push(status);
    }
    if (cohortId && cohortId !== 'ALL') {
      conds.push("ip.cohort_id = ?");
      params.push(cohortId);
    }
    if (trackId && trackId !== 'ALL') {
      conds.push("ip.track_id = ?");
      params.push(trackId);
    }
    if (search) {
      conds.push("(u.first_name LIKE ? OR u.last_name LIKE ? OR ip.intern_code LIKE ? OR idoc.title LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

    const [cnt] = await query(`
      SELECT COUNT(*) as total
      FROM intern_documents idoc
      JOIN intern_profiles ip ON idoc.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN document_types dt ON idoc.document_type_id = dt.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      ${where}
    `, params);

    const total = parseInt(cnt?.total || 0, 10);

    const rows = await query(`
      SELECT idoc.*,
             dt.name as type_name, dt.code as type_code, dt.category as type_category, dt.is_required,
             ip.intern_code, u.first_name, u.last_name, u.email,
             tr.name as track_name, c.name as cohort_name,
             vu.first_name as verifier_first, vu.last_name as verifier_last
      FROM intern_documents idoc
      JOIN intern_profiles ip ON idoc.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON ip.track_id = tr.id
      JOIN document_types dt ON idoc.document_type_id = dt.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN users vu ON idoc.verified_by = vu.id
      ${where}
      ORDER BY idoc.id DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: {
        total,
        page,
        limit,
        records: rows
      }
    });
  } catch (err) {
    console.error('getDocuments error:', err);
    res.status(500).json({ success: false, message: 'Failed to load documents.' });
  }
};

export const getDocumentVersions = async (req, res) => {
  try {
    const documentId = req.params.documentId || req.params.id;

    const [doc] = await query(`
      SELECT idoc.*, ip.mentor_id, c.lead_mentor_id
      FROM intern_documents idoc
      JOIN intern_profiles ip ON idoc.intern_id = ip.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE idoc.id = ?
    `, [documentId]);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // RBAC: Check access
    if (req.user.role === 'intern' && doc.intern_id !== req.user.internProfileId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'mentor' && doc.mentor_id !== req.user.mentorId && doc.lead_mentor_id !== req.user.mentorId) {
      return res.status(403).json({ success: false, message: 'Access denied: Intern not supervised.' });
    }

    const versions = await query(`
      SELECT dv.*,
             uu.first_name as uploader_first, uu.last_name as uploader_last,
             vu.first_name as verifier_first, vu.last_name as verifier_last
      FROM document_versions dv
      JOIN users uu ON dv.uploaded_by = uu.id
      LEFT JOIN users vu ON dv.verified_by = vu.id
      WHERE dv.document_id = ?
      ORDER BY dv.version_number DESC
    `, [documentId]);

    res.json({ success: true, data: versions });
  } catch (err) {
    console.error('getDocumentVersions error:', err);
    res.status(500).json({ success: false, message: 'Failed to load document version history.' });
  }
};


// ============================================================================
// GATE 2: SECURE AUTHENTICATED STREAMING DOWNLOAD
// ============================================================================

export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const [doc] = await query(`
      SELECT idoc.*, ip.mentor_id, c.lead_mentor_id
      FROM intern_documents idoc
      JOIN intern_profiles ip ON idoc.intern_id = ip.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE idoc.id = ?
    `, [id]);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // RBAC Security Barriers (Gate 2 & Gate 18)
    if (req.user.role === 'intern' && doc.intern_id !== req.user.internProfileId) {
      return res.status(403).json({ success: false, message: 'Access denied: You cannot download another intern\'s documents.' });
    }
    if (req.user.role === 'mentor' && doc.mentor_id !== req.user.mentorId && doc.lead_mentor_id !== req.user.mentorId) {
      return res.status(403).json({ success: false, message: 'Access denied: Mentors can only download documents for supervised interns.' });
    }

    const safeFile = path.basename(doc.stored_filename);
    const resolvedPath = path.resolve(documentStorageDir, safeFile);

    // Path traversal verification
    if (!resolvedPath.startsWith(documentStorageDir)) {
      return res.status(400).json({ success: false, message: 'Security Alert: Invalid document path.' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Document file not found on server storage.' });
    }

    await recordAuditLog(req.user.id, 'DOWNLOAD_DOCUMENT', 'intern_documents', id, null, { filename: doc.original_filename }, req);

    res.download(resolvedPath, doc.original_filename);
  } catch (err) {
    console.error('downloadDocument error:', err);
    res.status(500).json({ success: false, message: 'Failed to download document.' });
  }
};

export const downloadDocumentVersion = async (req, res) => {
  try {
    const { versionId } = req.params;

    const [ver] = await query(`
      SELECT dv.*, idoc.intern_id, ip.mentor_id, c.lead_mentor_id
      FROM document_versions dv
      JOIN intern_documents idoc ON dv.document_id = idoc.id
      JOIN intern_profiles ip ON idoc.intern_id = ip.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE dv.id = ?
    `, [versionId]);

    if (!ver) {
      return res.status(404).json({ success: false, message: 'Document version not found.' });
    }

    // RBAC Security Barriers
    if (req.user.role === 'intern' && ver.intern_id !== req.user.internProfileId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'mentor' && ver.mentor_id !== req.user.mentorId && ver.lead_mentor_id !== req.user.mentorId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const safeFile = path.basename(ver.stored_filename);
    const resolvedPath = path.resolve(documentStorageDir, safeFile);

    if (!resolvedPath.startsWith(documentStorageDir) || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Version file not found on server storage.' });
    }

    res.download(resolvedPath, ver.original_filename);
  } catch (err) {
    console.error('downloadDocumentVersion error:', err);
    res.status(500).json({ success: false, message: 'Failed to download document version.' });
  }
};
