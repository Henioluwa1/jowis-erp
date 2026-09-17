import express from 'express';
import {
  getAnnouncements,
  createAnnouncement
} from '../controllers/communicationController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/announcements', authenticateJWT, getAnnouncements);
router.post('/announcements', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), createAnnouncement);

export default router;
