import { query } from '../config/db.js';

/**
 * Get contacts list for direct messaging (with rich profile metadata for profile view)
 */
export const getContacts = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Fetch all active users across portals (excluding current user)
    const contacts = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.last_login, u.created_at,
             r.name as role_name,
             ip.intern_code, ip.onboarding_completed as intern_onboarding,
             t.name as track_name,
             c.name as cohort_name,
             m.specialization as mentor_specialization,
             (
               SELECT COUNT(*) FROM chat_messages cm
               WHERE cm.sender_id = u.id AND cm.receiver_id = ? AND cm.is_read = 0
             ) as unread_count,
             (
               SELECT MAX(created_at) FROM chat_messages cm2
               WHERE (cm2.sender_id = u.id AND cm2.receiver_id = ?)
                  OR (cm2.sender_id = ? AND cm2.receiver_id = u.id)
             ) as last_interaction_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN intern_profiles ip ON u.id = ip.user_id
      LEFT JOIN tracks t ON ip.track_id = t.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN mentors m ON u.id = m.user_id
      WHERE u.id != ? AND u.is_active = 1
      ORDER BY last_interaction_at DESC, u.first_name ASC
    `, [currentUserId, currentUserId, currentUserId, currentUserId]);

    const formatted = contacts.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone,
      avatarUrl: c.avatar_url,
      role: c.role_name,
      internCode: c.intern_code,
      trackName: c.track_name,
      cohortName: c.cohort_name,
      specialization: c.mentor_specialization,
      memberSince: c.created_at,
      unreadCount: Number(c.unread_count || 0),
      lastInteractionAt: c.last_interaction_at,
      isOnline: c.last_login ? (new Date() - new Date(c.last_login) < 15 * 60 * 1000) : false
    }));

    res.json({
      success: true,
      contacts: formatted
    });
  } catch (error) {
    console.error('getContacts error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving chat contacts.' });
  }
};

/**
 * Get available institutional chat channels
 */
export const getChannels = async (req, res) => {
  try {
    const userRole = req.user.role;

    const channels = [
      {
        id: 'general',
        name: 'Institutional All-Hands',
        code: '#general-hub',
        description: 'Organization-wide live communications, announcements & campus discussions.',
        allowedRoles: ['super_admin', 'admin', 'mentor', 'intern'],
        badgeColor: 'emerald'
      },
      {
        id: 'interns',
        name: 'Technology Interns Guild',
        code: '#interns-collaborative',
        description: 'Peer collaboration, codebase discussion, lab challenges & standup chats.',
        allowedRoles: ['super_admin', 'admin', 'mentor', 'intern'],
        badgeColor: 'cyan'
      },
      {
        id: 'faculty',
        name: 'Faculty & Mentorship Lounge',
        code: '#faculty-instructors',
        description: 'Instructional strategies, curriculum planning, evaluation reviews & governance.',
        allowedRoles: ['super_admin', 'admin', 'mentor'],
        badgeColor: 'purple'
      },
      {
        id: 'announcements',
        name: 'Executive Directives & Notices',
        code: '#official-broadcast',
        description: 'Authoritative directives, security notices, timetable alerts & critical broadcasts.',
        allowedRoles: ['super_admin', 'admin', 'mentor', 'intern'],
        badgeColor: 'amber'
      }
    ];

    const available = channels.filter(ch => ch.allowedRoles.includes(userRole));

    res.json({
      success: true,
      channels: available
    });
  } catch (error) {
    console.error('getChannels error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving channels.' });
  }
};

/**
 * Get chat messages (for a direct conversation or a channel)
 * Tracks delivery status and seen/read receipts
 */
export const getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { receiverId, channelId, limit = 100 } = req.query;

    if (!receiverId && !channelId) {
      return res.status(400).json({
        success: false,
        message: 'Must specify either receiverId (for DM) or channelId (for channel).'
      });
    }

    let messages = [];

    if (receiverId) {
      const otherId = Number(receiverId);

      // 1. Mark incoming messages as DELIVERED (if not yet marked) and READ (since user is viewing)
      await query(`
        UPDATE chat_messages
        SET is_delivered = 1,
            delivered_at = COALESCE(delivered_at, NOW()),
            is_read = 1,
            read_at = COALESCE(read_at, NOW())
        WHERE sender_id = ? AND receiver_id = ? AND (is_read = 0 OR is_delivered = 0)
      `, [otherId, currentUserId]);

      // 2. Fetch direct messages
      messages = await query(`
        SELECT cm.id, cm.sender_id, cm.receiver_id, cm.channel_id,
               cm.ciphertext, cm.iv, cm.message_type, cm.is_read, cm.is_delivered,
               cm.delivered_at, cm.read_at, cm.attachment_url, cm.file_name,
               cm.file_size, cm.file_type, cm.created_at,
               su.first_name as sender_first, su.last_name as sender_last,
               su.avatar_url as sender_avatar, sr.name as sender_role
        FROM chat_messages cm
        JOIN users su ON cm.sender_id = su.id
        JOIN roles sr ON su.role_id = sr.id
        WHERE (cm.sender_id = ? AND cm.receiver_id = ?)
           OR (cm.sender_id = ? AND cm.receiver_id = ?)
        ORDER BY cm.created_at ASC
        LIMIT ?
      `, [currentUserId, otherId, otherId, currentUserId, Number(limit)]);

    } else if (channelId) {
      messages = await query(`
        SELECT cm.id, cm.sender_id, cm.receiver_id, cm.channel_id,
               cm.ciphertext, cm.iv, cm.message_type, cm.is_read, cm.is_delivered,
               cm.delivered_at, cm.read_at, cm.attachment_url, cm.file_name,
               cm.file_size, cm.file_type, cm.created_at,
               su.first_name as sender_first, su.last_name as sender_last,
               su.avatar_url as sender_avatar, sr.name as sender_role
        FROM chat_messages cm
        JOIN users su ON cm.sender_id = su.id
        JOIN roles sr ON su.role_id = sr.id
        WHERE cm.channel_id = ?
        ORDER BY cm.created_at ASC
        LIMIT ?
      `, [channelId, Number(limit)]);
    }

    const formatted = messages.map(m => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: `${m.sender_first} ${m.sender_last}`.trim(),
      senderAvatar: m.sender_avatar,
      senderRole: m.sender_role,
      receiverId: m.receiver_id,
      channelId: m.channel_id,
      ciphertext: m.ciphertext,
      iv: m.iv,
      messageType: m.message_type,
      isRead: Boolean(m.is_read),
      readAt: m.read_at,
      isDelivered: Boolean(m.is_delivered),
      deliveredAt: m.delivered_at,
      attachmentUrl: m.attachment_url,
      fileName: m.file_name,
      fileSize: m.file_size,
      fileType: m.file_type,
      createdAt: m.created_at,
      isOutgoing: m.sender_id === currentUserId
    }));

    res.json({
      success: true,
      messages: formatted
    });
  } catch (error) {
    console.error('getMessages error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving chat messages.' });
  }
};

/**
 * Send an End-to-End Encrypted Message with Multimedia Support
 */
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      receiverId,
      channelId,
      ciphertext,
      iv,
      messageType = 'text',
      attachmentUrl,
      fileName,
      fileSize,
      fileType
    } = req.body;

    if (!ciphertext || !iv) {
      return res.status(400).json({
        success: false,
        message: 'Encrypted message ciphertext and IV are required for E2EE protocol.'
      });
    }

    if (!receiverId && !channelId) {
      return res.status(400).json({
        success: false,
        message: 'Must specify a receiverId or channelId.'
      });
    }

    // Check if recipient is recently active (within last 5 minutes) to mark delivered immediately
    let initialDelivered = 0;
    let initialDeliveredAt = null;

    if (receiverId) {
      const [receiverUser] = await query('SELECT last_login FROM users WHERE id = ?', [Number(receiverId)]);
      if (receiverUser?.last_login && (new Date() - new Date(receiverUser.last_login) < 5 * 60 * 1000)) {
        initialDelivered = 1;
        initialDeliveredAt = new Date();
      }
    }

    const result = await query(`
      INSERT INTO chat_messages (
        sender_id, receiver_id, channel_id, ciphertext, iv, message_type,
        attachment_url, file_name, file_size, file_type, is_read, is_delivered, delivered_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      senderId,
      receiverId ? Number(receiverId) : null,
      channelId ? String(channelId).trim() : null,
      ciphertext,
      iv,
      messageType,
      attachmentUrl || null,
      fileName || null,
      fileSize ? Number(fileSize) : null,
      fileType || null,
      initialDelivered,
      initialDeliveredAt
    ]);

    const insertedId = result.insertId;

    // Direct message in-app notification
    if (receiverId) {
      try {
        const senderName = `${req.user.first_name || 'User'} ${req.user.last_name || ''}`.trim();
        const notificationText = attachmentUrl
          ? `${senderName} sent you a multimedia document in chat.`
          : `You have a new end-to-end encrypted direct message from ${senderName}.`;

        await query(`
          INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, is_read, link)
          VALUES (?, 'system', ?, ?, 'chat', ?, 0, '/chat')
        `, [
          Number(receiverId),
          `Encrypted message from ${senderName}`,
          notificationText,
          insertedId
        ]);
      } catch (notifErr) {
        console.warn('Failed to insert chat notification:', notifErr);
      }
    }

    res.json({
      success: true,
      messageId: insertedId,
      createdAt: new Date().toISOString(),
      senderId,
      receiverId: receiverId ? Number(receiverId) : null,
      channelId: channelId || null,
      isDelivered: Boolean(initialDelivered),
      deliveredAt: initialDeliveredAt ? initialDeliveredAt.toISOString() : null,
      isRead: false
    });
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error sending message.' });
  }
};

/**
 * Upload Multimedia or Document for Chat Sharing
 */
export const uploadChatFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file was uploaded.' });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const isImage = req.file.mimetype.startsWith('image/');

    res.json({
      success: true,
      message: 'Chat document uploaded successfully.',
      file: {
        url: fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        isImage
      }
    });
  } catch (error) {
    console.error('uploadChatFile error:', error);
    res.status(500).json({ success: false, message: 'Server error uploading chat document.' });
  }
};

/**
 * Get total unread count for current user and mark incoming messages delivered
 */
export const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // As user is actively polling, any unread messages sent to this user are delivered to client
    await query(`
      UPDATE chat_messages
      SET is_delivered = 1, delivered_at = COALESCE(delivered_at, NOW())
      WHERE receiver_id = ? AND is_delivered = 0
    `, [currentUserId]);

    const [row] = await query(`
      SELECT COUNT(*) as unread_count
      FROM chat_messages
      WHERE receiver_id = ? AND is_read = 0
    `, [currentUserId]);

    res.json({
      success: true,
      count: Number(row?.unread_count || 0)
    });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving unread count.' });
  }
};

/**
 * Mark messages from a specific sender as read and seen
 */
export const markMessagesRead = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { senderId } = req.body;

    if (!senderId) {
      return res.status(400).json({ success: false, message: 'senderId is required.' });
    }

    await query(`
      UPDATE chat_messages
      SET is_read = 1,
          read_at = NOW(),
          is_delivered = 1,
          delivered_at = COALESCE(delivered_at, NOW())
      WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
    `, [Number(senderId), currentUserId]);

    res.json({ success: true, message: 'Messages marked as delivered and read.' });
  } catch (error) {
    console.error('markMessagesRead error:', error);
    res.status(500).json({ success: false, message: 'Server error marking messages as read.' });
  }
};
