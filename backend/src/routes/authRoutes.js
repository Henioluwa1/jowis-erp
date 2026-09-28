import express from 'express';
import {
  login,
  getMe,
  changePassword,
  logout,
  getUserProfile,
  updateUserProfile,
  completeMentorOnboarding,
  completeInternOnboarding,
  uploadCredential,
  uploadAvatar
} from '../controllers/authController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { documentUpload } from '../utils/documentUpload.js';
import { avatarUpload } from '../utils/avatarUpload.js';

const router = express.Router();

router.post('/login', authRateLimiter, login);
router.get('/me', authenticateJWT, getMe);
router.get('/profile', authenticateJWT, getUserProfile);
router.put('/profile', authenticateJWT, updateUserProfile);
router.post('/upload-avatar', authenticateJWT, avatarUpload.single('avatar'), uploadAvatar);
router.post('/mentor-onboarding', authenticateJWT, authorizeRoles('mentor'), completeMentorOnboarding);
router.post('/intern-onboarding', authenticateJWT, authorizeRoles('intern'), completeInternOnboarding);
router.post('/upload-credential', authenticateJWT, documentUpload.single('file'), uploadCredential);
router.post('/change-password', authenticateJWT, authRateLimiter, changePassword);
router.post('/logout', authenticateJWT, logout);

export default router;


