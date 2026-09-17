import express from 'express';
import { login, getMe, changePassword } from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.get('/me', authenticateJWT, getMe);
router.post('/change-password', authenticateJWT, changePassword);

export default router;
