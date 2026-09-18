import express from 'express';
import {
  getGovernanceOverview,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  changeUserRole,
  resetUserPassword,
  getRoles,
  getPermissionsMatrix,
  getAdminSettings,
  updateAdminSetting,
  getAdminAuditLogs,
  rejectAuditLogMutation
} from '../controllers/adminController.js';
import { authenticateJWT, authorizeRoles, authorizePermission } from '../middleware/auth.js';

const router = express.Router();

// Strict security: all administrative endpoints require authentication and administrator privilege
router.use(authenticateJWT);
router.use(authorizeRoles('super_admin', 'admin'));

// Governance Dashboard
router.get('/overview', getGovernanceOverview);

// User Administration
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.patch('/users/:id/status', toggleUserStatus);
router.patch('/users/:id/role', changeUserRole);
router.post('/users/:id/reset-password', resetUserPassword);

// Roles & Permissions Matrix
router.get('/roles', getRoles);
router.get('/permissions', getPermissionsMatrix);

// Settings & Organization Configuration
router.get('/settings', getAdminSettings);
router.put('/settings/:key', updateAdminSetting);

// Audit Log Viewer
router.get('/audit-logs', getAdminAuditLogs);

// Audit Immutability Guards (Gate 9)
router.delete('/audit-logs', rejectAuditLogMutation);
router.delete('/audit-logs/:id', rejectAuditLogMutation);
router.put('/audit-logs', rejectAuditLogMutation);
router.put('/audit-logs/:id', rejectAuditLogMutation);

export default router;
