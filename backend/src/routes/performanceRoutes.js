import express from 'express';
import {
  getMyPerformance,
  getAdminPerformanceOverview,
  createEvaluation
} from '../controllers/performanceController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', authenticateJWT, getMyPerformance);
router.get('/overview', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAdminPerformanceOverview);
router.post('/evaluation', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), createEvaluation);

export default router;
