import express from 'express';
import {
  getRules,
  getRuleById,
  updateRule,
  toggleRuleStatus,
  triggerRuleManual,
  getExecutions,
  getExecutionById,
  retryExecution,
  getSystemAlerts
} from '../controllers/automationController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// Operational alerts feed (Super Admin, Admin, and Mentor)
router.get('/alerts', authorizeRoles('super_admin', 'admin', 'mentor'), getSystemAlerts);

// Automation Rule Management (Super Admin and Operational Admin)
router.get('/rules', authorizeRoles('super_admin', 'admin'), getRules);
router.get('/rules/:id', authorizeRoles('super_admin', 'admin'), getRuleById);
router.put('/rules/:id', authorizeRoles('super_admin', 'admin'), updateRule);
router.patch('/rules/:id/toggle', authorizeRoles('super_admin', 'admin'), toggleRuleStatus);
router.post('/rules/:code/run', authorizeRoles('super_admin', 'admin'), triggerRuleManual);

// Execution History & Retries (Super Admin and Operational Admin)
router.get('/executions', authorizeRoles('super_admin', 'admin'), getExecutions);
router.get('/executions/:id', authorizeRoles('super_admin', 'admin'), getExecutionById);
router.post('/executions/:id/retry', authorizeRoles('super_admin', 'admin'), retryExecution);

export default router;
