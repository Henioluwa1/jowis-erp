import express from 'express';
import {
  getCertificateTypes,
  createCertificateType,
  checkEligibility,
  issueCertificate,
  revokeCertificate,
  getCertificates,
  getCertificateById,
  downloadCertificatePDF,
  verifyPublicCertificate,
  downloadPublicCertificatePDF
} from '../controllers/certificateController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { publicVerifyRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// ==========================================
// 1. PUBLIC VERIFICATION ENDPOINTS (Gate 15)
// Unauthenticated & strict privacy protected
// ==========================================
router.get('/verify/:verificationCode', publicVerifyRateLimiter, verifyPublicCertificate);
router.get('/verify/:verificationCode/download', publicVerifyRateLimiter, downloadPublicCertificatePDF);

// ==========================================
// 2. CERTIFICATE TYPES MANAGEMENT (Gate 10)
// ==========================================
router.get('/types', authenticateJWT, getCertificateTypes);
router.post('/types', authenticateJWT, authorizeRoles('super_admin', 'admin'), createCertificateType);

// ==========================================
// 3. ELIGIBILITY ENGINE (Gate 12)
// ==========================================
router.get('/eligibility', authenticateJWT, checkEligibility);
router.get('/eligibility/:internId', authenticateJWT, checkEligibility);

// ==========================================
// 4. CERTIFICATE ISSUANCE & REVOCATION (Gates 13 & 16)
// ==========================================
router.post('/issue', authenticateJWT, authorizeRoles('super_admin', 'admin'), issueCertificate);
router.patch('/:id/revoke', authenticateJWT, authorizeRoles('super_admin', 'admin'), revokeCertificate);
router.post('/:id/revoke', authenticateJWT, authorizeRoles('super_admin', 'admin'), revokeCertificate);

// ==========================================
// 5. CERTIFICATE REGISTRY & AUTHENTICATED DOWNLOADS (Gate 17)
// ==========================================
router.get('/', authenticateJWT, getCertificates);
router.get('/:id', authenticateJWT, getCertificateById);
router.get('/:id/download', authenticateJWT, downloadCertificatePDF);

export default router;
