import express from 'express';
import {
  getExecutiveDashboard,
  getInternAnalytics,
  getAttendanceAnalytics,
  getTaskAnalytics,
  getPerformanceAnalytics,
  getCohortAnalytics,
  getTrackAnalytics,
  getMentorAnalytics,
  getTimeSeriesAnalytics,
  getReportDrillDown,
  exportReportCSV,
  getMyPersonalAnalytics,
  exportAttendanceCSV,
  exportInternsCSV
} from '../controllers/reportController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Executive Management Dashboard (Gate 2)
router.get('/executive', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getExecutiveDashboard);

// Intern Lifecycle & Demographic Analytics (Gate 4)
router.get('/interns', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getInternAnalytics);

// Authoritative Attendance Intelligence (Gate 5)
router.get('/attendance', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAttendanceAnalytics);

// Task & Training Execution Analytics (Gate 6)
router.get('/tasks', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getTaskAnalytics);

// Performance & Evaluation Analytics (Gate 7)
router.get('/performance', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getPerformanceAnalytics);

// Cohort Progression & Performance Matrix (Gate 8)
router.get('/cohorts', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getCohortAnalytics);

// Track Utilization & Comparative Metrics (Gate 9)
router.get('/tracks', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getTrackAnalytics);

// Mentor Workload & Review Cadence (Gate 10)
router.get('/mentors', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getMentorAnalytics);

// Longitudinal & Time-Series Analytics (Gate 11)
router.get('/time-series', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getTimeSeriesAnalytics);

// Drill-Down Lineage & Underlying Record Tracing (Gate 12)
router.get('/drill-down', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getReportDrillDown);

// Standard RFC-4180 CSV Exporter (Gate 13 & 17)
router.get('/export/:type', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor', 'intern'), exportReportCSV);

// Intern Personal Scorecard (Gate 14)
router.get('/me', authenticateJWT, authorizeRoles('intern'), getMyPersonalAnalytics);

// Legacy Backwards Compatibility Routes
router.get('/attendance/csv', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), exportAttendanceCSV);
router.get('/interns/csv', authenticateJWT, authorizeRoles('super_admin', 'admin'), exportInternsCSV);

export default router;
