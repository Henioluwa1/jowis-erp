import express from 'express';
import {
  getTracks,
  getTrackById,
  createTrack,
  updateTrack,
  toggleTrackStatus,
  deleteTrack,
  getCohorts,
  getCohortById,
  createCohort,
  updateCohort,
  deleteCohort,
  getMentors
} from '../controllers/trainingController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Tracks endpoints
router.get('/tracks', authenticateJWT, getTracks);
router.get('/tracks/:id', authenticateJWT, getTrackById);
router.post('/tracks', authenticateJWT, authorizeRoles('super_admin', 'admin'), createTrack);
router.put('/tracks/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), updateTrack);
router.patch('/tracks/:id/status', authenticateJWT, authorizeRoles('super_admin', 'admin'), toggleTrackStatus);
router.delete('/tracks/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), deleteTrack);

// Cohorts endpoints
router.get('/cohorts', authenticateJWT, getCohorts);
router.get('/cohorts/:id', authenticateJWT, getCohortById);
router.post('/cohorts', authenticateJWT, authorizeRoles('super_admin', 'admin'), createCohort);
router.put('/cohorts/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), updateCohort);
router.delete('/cohorts/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), deleteCohort);

// Mentors endpoint
router.get('/mentors', authenticateJWT, getMentors);

export default router;
