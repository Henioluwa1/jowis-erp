import express from 'express';
import {
  getSettings,
  updateSetting,
  getAuditLogs,
  getIdCardConfig,
  updateIdCardConfig,
  verifyIdCardPublic
} from '../controllers/systemController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { publicVerifyRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// System Settings & Logs
router.get('/settings', authenticateJWT, authorizeRoles('super_admin', 'admin'), getSettings);
router.put('/settings/:key', authenticateJWT, authorizeRoles('super_admin'), updateSetting);
router.get('/audit-logs', authenticateJWT, authorizeRoles('super_admin'), getAuditLogs);

// Institutional ID Card Management & Configurations (Gates: Admin editable for all users)
router.get('/id-card-config', authenticateJWT, getIdCardConfig);
router.put('/id-card-config', authenticateJWT, authorizeRoles('super_admin', 'admin'), updateIdCardConfig);

// Public ID Card Verification (Via QR Code Scan)
router.get('/verify-id/:code', publicVerifyRateLimiter, verifyIdCardPublic);

export default router;

