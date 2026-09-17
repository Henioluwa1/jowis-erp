import express from 'express';
import { getSettings, updateSetting, getAuditLogs } from '../controllers/systemController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/settings', authenticateJWT, authorizeRoles('super_admin', 'admin'), getSettings);
router.put('/settings/:key', authenticateJWT, authorizeRoles('super_admin'), updateSetting);
router.get('/audit-logs', authenticateJWT, authorizeRoles('super_admin'), getAuditLogs);

export default router;
