import express from 'express';
import {
  getAdminDashboard,
  getInternDashboard
} from '../controllers/dashboardController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/admin', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAdminDashboard);
router.get('/intern', authenticateJWT, getInternDashboard);

export default router;
