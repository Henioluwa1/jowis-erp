import express from 'express';
import {
  getPeriods,
  getPeriodById,
  createPeriod,
  updatePeriod,
  transitionPeriodStatus,
  getCriteria,
  createCriterion,
  updateCriterion,
  toggleCriterionStatus,
  reorderCriteria,
  deleteCriterion,
  validateWeights,
  getRatingBands,
  updateRatingBand,
  assignEvaluation,
  getEvaluations,
  getEvaluationById,
  updateEvaluation,
  submitEvaluation,
  finalizeEvaluation,
  amendEvaluation,
  getMyPerformance,
  getMentorPerformanceWorkspace,
  getAdminPerformanceOverview
} from '../controllers/performanceController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// 1. Intern Self-Service Workspace (Gate 9 - Strict Isolation)
router.get('/me', authenticateJWT, getMyPerformance);

// 2. Dashboards & Role-Scoped Workspaces (Gates 10 & 11)
router.get('/overview', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAdminPerformanceOverview);
router.get('/mentor-workspace', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getMentorPerformanceWorkspace);

// 3. Performance Period Management (Gate 3)
router.get('/periods', authenticateJWT, getPeriods);
router.get('/periods/:id', authenticateJWT, getPeriodById);
router.post('/periods', authenticateJWT, authorizeRoles('super_admin', 'admin'), createPeriod);
router.put('/periods/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), updatePeriod);
router.patch('/periods/:id/status', authenticateJWT, authorizeRoles('super_admin', 'admin'), transitionPeriodStatus);

// 4. Performance Criteria Management (Gate 2)
router.get('/criteria', authenticateJWT, getCriteria);
router.get('/criteria/validate-weights', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), validateWeights);
router.post('/criteria', authenticateJWT, authorizeRoles('super_admin', 'admin'), createCriterion);
router.put('/criteria/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), updateCriterion);
router.patch('/criteria/:id/status', authenticateJWT, authorizeRoles('super_admin', 'admin'), toggleCriterionStatus);
router.patch('/criteria/reorder', authenticateJWT, authorizeRoles('super_admin', 'admin'), reorderCriteria);
router.delete('/criteria/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), deleteCriterion);

// 5. Rating Bands (Gate 7)
router.get('/rating-bands', authenticateJWT, getRatingBands);
router.put('/rating-bands/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), updateRatingBand);

// 6. Evaluations Engine & Workflow (Gates 4, 5, 6, 8)
router.get('/evaluations', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getEvaluations);
router.get('/evaluations/:id', authenticateJWT, getEvaluationById);
router.post('/evaluations', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), assignEvaluation);
router.put('/evaluations/:id', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), updateEvaluation);
router.post('/evaluations/:id/submit', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), submitEvaluation);
router.post('/evaluations/:id/finalize', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), finalizeEvaluation);
router.post('/evaluations/:id/reopen', authenticateJWT, authorizeRoles('super_admin', 'admin'), amendEvaluation);
router.post('/evaluations/:id/amend', authenticateJWT, authorizeRoles('super_admin', 'admin'), amendEvaluation);

// 7. Legacy backward compatibility route
router.post('/evaluation', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), updateEvaluation);

export default router;
