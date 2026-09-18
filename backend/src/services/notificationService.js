import { query } from '../config/db.js';

/**
 * Supported Notification Delivery Channels (Gate 12)
 * Initial mandatory channel: IN_APP
 */
const channels = {
  IN_APP: async (notification) => {
    return await saveInAppNotification(notification);
  }
};

/**
 * Check user notification preferences (Gate 8)
 * System notifications permanently bypass preferences.
 */
async function isNotificationPermitted(userId, type) {
  if (type === 'system') return true;

  const prefFieldMap = {
    announcement: 'announcements_in_app',
    task: 'tasks_in_app',
    evaluation: 'performance_in_app',
    document: 'documents_in_app',
    certificate: 'documents_in_app',
    attendance: 'system_in_app'
  };

  const prefField = prefFieldMap[type] || 'announcements_in_app';

  const rows = await query(
    `SELECT ${prefField} as is_enabled FROM notification_preferences WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) {
    // If no row exists yet, default is permitted
    return true;
  }

  return rows[0].is_enabled === 1;
}

/**
 * Save in-app notification with idempotency check
 */
async function saveInAppNotification({ userId, type, title, message, relatedEntityType, relatedEntityId, link }) {
  // Idempotency check: Don't duplicate unread notification for same entity & user within 1 hour
  if (relatedEntityType && relatedEntityId) {
    const existing = await query(
      `SELECT id FROM notifications 
       WHERE user_id = ? AND type = ? AND related_entity_type = ? AND related_entity_id = ? AND is_read = 0
       AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
       LIMIT 1`,
      [userId, type, relatedEntityType, relatedEntityId]
    );
    if (existing.length > 0) {
      return existing[0].id;
    }
  }

  const result = await query(
    `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, link, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
    [
      userId,
      type || 'system',
      title.slice(0, 200),
      message,
      relatedEntityType || null,
      relatedEntityId || null,
      link || null
    ]
  );

  return result.insertId;
}

/**
 * Dispatch a single notification
 */
export async function createNotification({ userId, type, title, message, relatedEntityType, relatedEntityId, link }) {
  try {
    if (!userId || !title || !message) return null;

    // Check preference
    const permitted = await isNotificationPermitted(userId, type);
    if (!permitted) {
      return null;
    }

    return await channels.IN_APP({
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      link
    });
  } catch (error) {
    console.error('NotificationService.createNotification Error:', error.message);
    return null;
  }
}

/**
 * Dispatch batch notifications
 */
export async function createBatchNotifications(userIds, { type, title, message, relatedEntityType, relatedEntityId, link }) {
  if (!Array.isArray(userIds) || userIds.length === 0) return 0;

  let createdCount = 0;
  for (const userId of userIds) {
    try {
      const id = await createNotification({
        userId,
        type,
        title,
        message,
        relatedEntityType,
        relatedEntityId,
        link
      });
      if (id) createdCount++;
    } catch (e) {
      console.error(`Failed to notify user ${userId}:`, e.message);
    }
  }

  return createdCount;
}

/**
 * Resolve targeted users for an announcement and dispatch in-app notifications
 */
export async function notifyAnnouncementPublished(announcementId) {
  try {
    const annRows = await query(
      `SELECT * FROM announcements WHERE id = ? LIMIT 1`,
      [announcementId]
    );
    if (annRows.length === 0) return 0;
    const ann = annRows[0];

    // Audience user ID resolution based on target_type & target_id
    let recipientUserIds = [];

    switch (ann.target_type) {
      case 'all': {
        const users = await query(`SELECT id FROM users WHERE is_active = 1`);
        recipientUserIds = users.map(u => u.id);
        break;
      }
      case 'interns': {
        const interns = await query(`
          SELECT u.id 
          FROM users u
          JOIN intern_profiles ip ON u.id = ip.user_id
          WHERE u.is_active = 1
        `);
        recipientUserIds = interns.map(u => u.id);
        break;
      }
      case 'mentors': {
        const mentors = await query(`
          SELECT u.id 
          FROM users u
          JOIN mentors m ON u.id = m.user_id
          WHERE u.is_active = 1
        `);
        recipientUserIds = mentors.map(u => u.id);
        break;
      }
      case 'admins': {
        const admins = await query(`
          SELECT u.id 
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.is_active = 1 AND r.name IN ('super_admin', 'admin')
        `);
        recipientUserIds = admins.map(u => u.id);
        break;
      }
      case 'track': {
        if (!ann.target_id) break;
        const trackUsers = await query(`
          SELECT DISTINCT u.id 
          FROM users u
          LEFT JOIN intern_profiles ip ON u.id = ip.user_id
          WHERE u.is_active = 1 AND ip.track_id = ?
        `, [ann.target_id]);
        recipientUserIds = trackUsers.map(u => u.id);
        break;
      }
      case 'cohort': {
        if (!ann.target_id) break;
        const cohortUsers = await query(`
          SELECT DISTINCT u.id 
          FROM users u
          LEFT JOIN intern_profiles ip ON u.id = ip.user_id
          WHERE u.is_active = 1 AND ip.cohort_id = ?
        `, [ann.target_id]);
        recipientUserIds = cohortUsers.map(u => u.id);
        break;
      }
      case 'intern': {
        if (!ann.target_id) break;
        // target_id could be intern_profile_id or user_id
        const directUser = await query(`
          SELECT u.id 
          FROM users u
          LEFT JOIN intern_profiles ip ON u.id = ip.user_id
          WHERE (ip.id = ? OR u.id = ?) AND u.is_active = 1
          LIMIT 1
        `, [ann.target_id, ann.target_id]);
        if (directUser.length > 0) {
          recipientUserIds = [directUser[0].id];
        }
        break;
      }
      default:
        break;
    }

    if (recipientUserIds.length === 0) return 0;

    const notifTitle = ann.requires_acknowledgement
      ? `Action Required: ${ann.title}`
      : `Announcement: ${ann.title}`;
    const notifMessage = ann.content.length > 180
      ? `${ann.content.slice(0, 177)}...`
      : ann.content;
    const notifLink = '/intern/announcements';

    return await createBatchNotifications(recipientUserIds, {
      type: 'announcement',
      title: notifTitle,
      message: notifMessage,
      relatedEntityType: 'announcement',
      relatedEntityId: ann.id,
      link: notifLink
    });
  } catch (err) {
    console.error('NotificationService.notifyAnnouncementPublished Error:', err.message);
    return 0;
  }
}

export default {
  createNotification,
  createBatchNotifications,
  notifyAnnouncementPublished
};
