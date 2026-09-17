import express from 'express';
import {
  getAllInterns,
  getInternById,
  createIntern,
  updateIntern,
  reassignIntern,
  transitionLifecycle,
  getAssignmentHistory,
  getLifecycleHistory
} from '../controllers/internController.js';
import { authenticateJWT, authorizeRoles, verifyInternOwnership } from '../middleware/auth.js';

const router = express.Router();

// List interns: Admin and Mentor (Mentors see scoped list)
router.get('/', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAllInterns);

// Create intern: Admin only
router.post('/', authenticateJWT, authorizeRoles('super_admin', 'admin'), createIntern);

// View profile: Admin, Mentor (scoped), Intern (self only)
router.get('/:id', authenticateJWT, verifyInternOwnership, getInternById);

// Update general profile fields (phone, address, etc.)
router.put('/:id', authenticateJWT, updateIntern);

// Administrative Reassignment: Track, Cohort, Mentor (Admin only)
router.post('/:id/reassign', authenticateJWT, authorizeRoles('super_admin', 'admin'), reassignIntern);

// Lifecycle state transitions (Admin only)
router.post('/:id/lifecycle', authenticateJWT, authorizeRoles('super_admin', 'admin'), transitionLifecycle);

// History audits
router.get('/:id/assignment-history', authenticateJWT, authorizeRoles('super_admin', 'admin'), getAssignmentHistory);
router.get('/:id/lifecycle-history', authenticateJWT, authorizeRoles('super_admin', 'admin'), getLifecycleHistory);

export default router;
