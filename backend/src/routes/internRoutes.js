import express from 'express';
import {
  getAllInterns,
  getInternById,
  createIntern,
  updateIntern
} from '../controllers/internController.js';
import { authenticateJWT, authorizeRoles, verifyInternOwnership } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAllInterns);
router.post('/', authenticateJWT, authorizeRoles('super_admin', 'admin'), createIntern);
router.get('/:id', authenticateJWT, verifyInternOwnership, getInternById);
router.put('/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), updateIntern);

export default router;
