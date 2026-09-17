import express from 'express';
import {
  getAllTasks,
  getMyTasks,
  submitTask,
  gradeSubmission
} from '../controllers/taskController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWT, getAllTasks);
router.get('/me', authenticateJWT, getMyTasks);
router.post('/:id/submit', authenticateJWT, submitTask);
router.put('/submissions/:id/grade', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), gradeSubmission);

export default router;
