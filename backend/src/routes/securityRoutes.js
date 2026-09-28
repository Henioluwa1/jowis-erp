import express from 'express';
import {
  getSystemLogs,
  getSecurityStats,
  getDebugLogDetails,
  getBlockedIps,
  blockIpAddress,
  unblockIpAddress
} from '../controllers/securityController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Strict Security: Available exclusively to Super Administrator
router.use(authenticateJWT);
router.use(authorizeRoles('super_admin'));

router.get('/logs', getSystemLogs);
router.get('/stats', getSecurityStats);
router.get('/debug/:id', getDebugLogDetails);
router.get('/blocked-ips', getBlockedIps);
router.post('/block-ip', blockIpAddress);
router.post('/unblock-ip', unblockIpAddress);

export default router;
