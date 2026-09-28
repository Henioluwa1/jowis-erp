import express from 'express';
import {
  getContacts,
  getChannels,
  getMessages,
  sendMessage,
  uploadChatFile,
  getUnreadCount,
  markMessagesRead
} from '../controllers/chatController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { chatUpload } from '../utils/chatUpload.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/contacts', getContacts);
router.get('/channels', getChannels);
router.get('/messages', getMessages);
router.post('/send', sendMessage);
router.post('/upload', chatUpload.single('file'), uploadChatFile);
router.get('/unread-count', getUnreadCount);
router.post('/mark-read', markMessagesRead);

export default router;
