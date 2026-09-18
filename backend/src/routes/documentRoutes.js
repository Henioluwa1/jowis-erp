import express from 'express';
import {
  getDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteOrDeactivateDocumentType,
  uploadDocument,
  verifyOrRejectDocument,
  getDocumentCompleteness,
  getDocuments,
  getDocumentVersions,
  downloadDocument,
  downloadDocumentVersion
} from '../controllers/documentController.js';
import { uploadMiddleware } from '../utils/documentUpload.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ==========================================
// 1. DOCUMENT TYPES MANAGEMENT (Gate 3)
// ==========================================
router.get('/types', authenticateJWT, getDocumentTypes);
router.post('/types', authenticateJWT, authorizeRoles('super_admin', 'admin'), createDocumentType);
router.put('/types/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), updateDocumentType);
router.delete('/types/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), deleteOrDeactivateDocumentType);

// ==========================================
// 2. DOCUMENT COMPLETENESS & CHECKLIST (Gate 8)
// ==========================================
router.get('/completeness', authenticateJWT, getDocumentCompleteness);
router.get('/completeness/:internId', authenticateJWT, getDocumentCompleteness);

// ==========================================
// 3. DOCUMENT UPLOAD & VERSIONING (Gates 4 & 6)
// ==========================================
// Single file upload via 'file' field
router.post('/upload', authenticateJWT, uploadMiddleware.single('file'), uploadDocument);

// ==========================================
// 4. DOCUMENT VERIFICATION WORKFLOW (Gate 5)
// ==========================================
router.patch('/:id/verify', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), verifyOrRejectDocument);

// ==========================================
// 5. DOCUMENT LIST & VERSION HISTORY (Gates 7 & 9)
// ==========================================
router.get('/', authenticateJWT, getDocuments);
router.get('/:id/versions', authenticateJWT, getDocumentVersions);

// ==========================================
// 6. SECURE STREAMED DOWNLOADS (Gate 2 & 9)
// ==========================================
router.get('/:id/download', authenticateJWT, downloadDocument);
router.get('/versions/:versionId/download', authenticateJWT, downloadDocumentVersion);

export default router;
