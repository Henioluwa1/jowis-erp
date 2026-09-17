import express from 'express';
import { exportAttendanceCSV, exportInternsCSV } from '../controllers/reportController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/attendance/csv', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), exportAttendanceCSV);
router.get('/interns/csv', authenticateJWT, authorizeRoles('super_admin', 'admin'), exportInternsCSV);

export default router;
