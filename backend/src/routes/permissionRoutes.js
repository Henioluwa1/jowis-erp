import express from 'express';
import {
  calculateDays,
  createPermissionRequest,
  getPermissionRequests,
  getPermissionRequestById,
  mentorReviewPermissionRequest,
  finalReviewPermissionRequest,
  cancelPermissionRequest
} from '../controllers/permissionController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Calculate affected scheduled working days for proposed date range
router.post('/calculate-days', authenticateJWT, calculateDays);

// Submit new permission request (intern role) - both / and /requests
router.post('/', authenticateJWT, authorizeRoles('intern'), createPermissionRequest);
router.post('/requests', authenticateJWT, authorizeRoles('intern'), createPermissionRequest);

// List permission requests with RBAC scoping - both / and /requests
router.get('/', authenticateJWT, getPermissionRequests);
router.get('/requests', authenticateJWT, getPermissionRequests);

// Get single permission request details
router.get('/:id', authenticateJWT, getPermissionRequestById);
router.get('/requests/:id', authenticateJWT, getPermissionRequestById);

// Mentor review determination (supports POST & PATCH, with and without /requests prefix)
router.post('/:id/mentor-review', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), mentorReviewPermissionRequest);
router.patch('/:id/mentor-review', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), mentorReviewPermissionRequest);
router.post('/requests/:id/mentor-review', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), mentorReviewPermissionRequest);
router.patch('/requests/:id/mentor-review', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), mentorReviewPermissionRequest);

// Authoritative Administrative review determination (supports POST & PATCH, /review and /final-review)
router.post('/:id/final-review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);
router.patch('/:id/final-review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);
router.post('/:id/review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);
router.patch('/:id/review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);
router.post('/requests/:id/final-review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);
router.patch('/requests/:id/final-review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);
router.post('/requests/:id/review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);
router.patch('/requests/:id/review', authenticateJWT, authorizeRoles('super_admin', 'admin'), finalReviewPermissionRequest);

// Cancel pending permission request
router.post('/:id/cancel', authenticateJWT, authorizeRoles('intern'), cancelPermissionRequest);
router.patch('/:id/cancel', authenticateJWT, authorizeRoles('intern'), cancelPermissionRequest);
router.post('/requests/:id/cancel', authenticateJWT, authorizeRoles('intern'), cancelPermissionRequest);
router.patch('/requests/:id/cancel', authenticateJWT, authorizeRoles('intern'), cancelPermissionRequest);

export default router;
