import express from 'express';
import {
  checkIn,
  getMyAttendance,
  getMyAttendanceSummary,
  getMyAttendanceAnalytics,
  getAdminTodayOverview,
  getAdminAttendanceRegister,
  manualMarkOrCorrect,
  getAttendanceAuditLogs,
  getCompanyHolidays,
  createCompanyHoliday,
  deleteCompanyHoliday,
  closeDailyAttendance
} from '../controllers/attendanceController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Intern endpoints
router.post('/check-in', authenticateJWT, checkIn);
router.get('/me', authenticateJWT, getMyAttendance);
router.get('/me/summary', authenticateJWT, getMyAttendanceSummary);
router.get('/me/analytics', authenticateJWT, getMyAttendanceAnalytics);

// Company Holidays (read-accessible to all authenticated, write-restricted to admins)
router.get('/holidays', authenticateJWT, getCompanyHolidays);
router.post('/holidays', authenticateJWT, authorizeRoles('super_admin', 'admin'), createCompanyHoliday);
router.delete('/holidays/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), deleteCompanyHoliday);

// Admin & Mentor endpoints
router.get('/admin/overview', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAdminTodayOverview);
router.get('/admin/register', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAdminAttendanceRegister);
router.post('/admin/manual', authenticateJWT, authorizeRoles('super_admin', 'admin'), manualMarkOrCorrect);
router.get('/admin/audit-logs', authenticateJWT, authorizeRoles('super_admin', 'admin'), getAttendanceAuditLogs);
router.post('/admin/close-day', authenticateJWT, authorizeRoles('super_admin', 'admin'), closeDailyAttendance);

export default router;
