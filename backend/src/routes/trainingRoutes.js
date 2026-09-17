import express from 'express';
import {
  getTracks,
  createTrack,
  getCohorts,
  createCohort,
  getMentors
} from '../controllers/trainingController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/tracks', authenticateJWT, getTracks);
router.post('/tracks', authenticateJWT, authorizeRoles('super_admin', 'admin'), createTrack);

router.get('/cohorts', authenticateJWT, getCohorts);
router.post('/cohorts', authenticateJWT, authorizeRoles('super_admin', 'admin'), createCohort);

router.get('/mentors', authenticateJWT, getMentors);

export default router;
