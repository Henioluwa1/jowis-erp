import express from 'express';
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  scheduleAnnouncement,
  archiveAnnouncement,
  deleteAnnouncement,
  getAudiencePreview,
  acknowledgeAnnouncement,
  getPendingAcknowledgements,
  getAnnouncementAcknowledgements,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences
} from '../controllers/communicationController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// -------------------------------------------------------------
// Announcements Routes (Gate 3, 4, 9, 13)
// -------------------------------------------------------------
router.get('/announcements/pending-acknowledgements', authenticateJWT, getPendingAcknowledgements);
router.get('/announcements/audience', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAudiencePreview);
router.get('/announcements', authenticateJWT, getAnnouncements);
router.get('/announcements/:id', authenticateJWT, getAnnouncementById);

router.post('/announcements', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), createAnnouncement);
router.put('/announcements/:id', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), updateAnnouncement);

router.patch('/announcements/:id/publish', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), publishAnnouncement);
router.patch('/announcements/:id/schedule', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), scheduleAnnouncement);
router.patch('/announcements/:id/archive', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), archiveAnnouncement);
router.delete('/announcements/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), deleteAnnouncement);

router.post('/announcements/:id/acknowledge', authenticateJWT, acknowledgeAnnouncement);
router.get('/announcements/:id/acknowledgements', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getAnnouncementAcknowledgements);

// -------------------------------------------------------------
// Notifications Routes (Gate 6, 7, 13, 14)
// -------------------------------------------------------------
router.get('/notifications/unread-count', authenticateJWT, getUnreadNotificationCount);
router.patch('/notifications/mark-all-read', authenticateJWT, markAllNotificationsAsRead);
router.get('/notifications', authenticateJWT, getNotifications);
router.patch('/notifications/:id/read', authenticateJWT, markNotificationAsRead);
router.patch('/notifications/:id/unread', authenticateJWT, markNotificationAsUnread);
router.delete('/notifications/:id', authenticateJWT, deleteNotification);

// -------------------------------------------------------------
// Notification Preferences Routes (Gate 8)
// -------------------------------------------------------------
router.get('/preferences', authenticateJWT, getNotificationPreferences);
router.put('/preferences', authenticateJWT, updateNotificationPreferences);

export default router;
