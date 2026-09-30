import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';
import { notifyAnnouncementPublished, createNotification } from '../services/notificationService.js';
import { sseManager } from '../services/sseManager.js';

/**
 * Promote scheduled announcements and expire outdated announcements server-side (Gate 2)
 */
async function updateAnnouncementLifecycles() {
  try {
    // 1. Promote scheduled to published when scheduled_at <= NOW()
    const dueScheduled = await query(`
      SELECT id FROM announcements
      WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
    `);

    if (dueScheduled.length > 0) {
      const ids = dueScheduled.map(d => d.id);
      await query(`
        UPDATE announcements 
        SET status = 'published', published_at = NOW()
        WHERE id IN (${ids.map(() => '?').join(',')})
      `, ids);

      // Dispatch notifications for freshly published announcements
      for (const item of dueScheduled) {
        notifyAnnouncementPublished(item.id).catch(err =>
          console.error(`Auto-publish notification error for announcement ${item.id}:`, err)
        );
      }
    }

    // 2. Expire published announcements whose expires_at <= NOW()
    await query(`
      UPDATE announcements
      SET status = 'expired'
      WHERE status = 'published' AND expires_at IS NOT NULL AND expires_at <= NOW()
    `);
  } catch (err) {
    console.error('updateAnnouncementLifecycles Error:', err.message);
  }
}

/**
 * Helper to resolve targeted user IDs for audience calculations (Gate 4)
 */
async function resolveAudienceUserIds(targetType, targetId) {
  let userIds = [];
  switch (targetType) {
    case 'all': {
      const rows = await query(`SELECT id FROM users WHERE is_active = 1`);
      userIds = rows.map(r => r.id);
      break;
    }
    case 'interns': {
      const rows = await query(`
        SELECT u.id FROM users u
        JOIN intern_profiles ip ON u.id = ip.user_id
        WHERE u.is_active = 1
      `);
      userIds = rows.map(r => r.id);
      break;
    }
    case 'mentors': {
      const rows = await query(`
        SELECT u.id FROM users u
        JOIN mentors m ON u.id = m.user_id
        WHERE u.is_active = 1
      `);
      userIds = rows.map(r => r.id);
      break;
    }
    case 'admins': {
      const rows = await query(`
        SELECT u.id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name IN ('super_admin', 'admin')
      `);
      userIds = rows.map(r => r.id);
      break;
    }
    case 'track': {
      if (!targetId) break;
      const rows = await query(`
        SELECT DISTINCT u.id FROM users u
        LEFT JOIN intern_profiles ip ON u.id = ip.user_id
        WHERE u.is_active = 1 AND ip.track_id = ?
      `, [targetId]);
      userIds = rows.map(r => r.id);
      break;
    }
    case 'cohort': {
      if (!targetId) break;
      const rows = await query(`
        SELECT DISTINCT u.id FROM users u
        LEFT JOIN intern_profiles ip ON u.id = ip.user_id
        WHERE u.is_active = 1 AND ip.cohort_id = ?
      `, [targetId]);
      userIds = rows.map(r => r.id);
      break;
    }
    case 'intern': {
      if (!targetId) break;
      const rows = await query(`
        SELECT u.id FROM users u
        LEFT JOIN intern_profiles ip ON u.id = ip.user_id
        WHERE (ip.id = ? OR u.id = ?) AND u.is_active = 1
        LIMIT 1
      `, [targetId, targetId]);
      userIds = rows.map(r => r.id);
      break;
    }
    default:
      break;
  }
  return userIds;
}

// ============================================================================
// ANNOUNCEMENTS CONTROLLERS (Gates 2, 3, 4, 9, 10, 13, 14, 15)
// ============================================================================

/**
 * Get announcements (Role-scoped & Paginated)
 */
export const getAnnouncements = async (req, res) => {
  try {
    await updateAnnouncementLifecycles();

    const userRole = req.user.role;
    const { status, targetType, priority, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // -----------------------------------------------------------
    // Case 1: Admin / Super Admin (Full Management View)
    // -----------------------------------------------------------
    if (userRole === 'super_admin' || userRole === 'admin') {
      let whereClauses = ['1=1'];
      const params = [];

      if (status && status !== 'all') {
        whereClauses.push('a.status = ?');
        params.push(status);
      }
      if (targetType && targetType !== 'all') {
        whereClauses.push('a.target_type = ?');
        params.push(targetType);
      }
      if (priority && priority !== 'all') {
        whereClauses.push('a.priority = ?');
        params.push(priority);
      }
      if (search && search.trim()) {
        whereClauses.push('(a.title LIKE ? OR a.content LIKE ?)');
        const searchPattern = `%${search.trim()}%`;
        params.push(searchPattern, searchPattern);
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count
      const countRows = await query(`
        SELECT COUNT(*) as total
        FROM announcements a
        WHERE ${whereSql}
      `, params);
      const totalCount = countRows[0].total;

      // Query data with author and targeting details
      const announcements = await query(`
        SELECT a.*,
               u.first_name as author_first_name, u.last_name as author_last_name,
               t.name as track_name,
               c.name as cohort_name,
               ip.intern_code,
               (SELECT COUNT(*) FROM announcement_acknowledgements ack WHERE ack.announcement_id = a.id) as acknowledged_count
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        LEFT JOIN tracks t ON (a.target_type = 'track' AND a.target_id = t.id)
        LEFT JOIN cohorts c ON (a.target_type = 'cohort' AND a.target_id = c.id)
        LEFT JOIN intern_profiles ip ON (a.target_type = 'intern' AND (a.target_id = ip.id OR a.target_id = ip.user_id))
        WHERE ${whereSql}
        ORDER BY a.is_pinned DESC, a.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limitNum, offset]);

      return res.json({
        success: true,
        data: announcements,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      });
    }

    // -----------------------------------------------------------
    // Case 2: Intern (Authoritatively Scope-Filtered)
    // -----------------------------------------------------------
    if (userRole === 'intern') {
      const internTrackId = req.user.trackId || 0;
      const internCohortId = req.user.cohortId || 0;
      const internProfileId = req.user.internProfileId || 0;
      const userId = req.user.id;

      let internWhere = `
        a.status = 'published'
        AND (a.published_at IS NULL OR a.published_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND (
          a.target_type = 'all'
          OR a.target_type = 'interns'
          OR (a.target_type = 'track' AND a.target_id = ?)
          OR (a.target_type = 'cohort' AND a.target_id = ?)
          OR (a.target_type = 'intern' AND (a.target_id = ? OR a.target_id = ?))
        )
      `;
      const internParams = [internTrackId, internCohortId, internProfileId, userId];

      if (priority && priority !== 'all') {
        internWhere += ' AND a.priority = ?';
        internParams.push(priority);
      }
      if (search && search.trim()) {
        internWhere += ' AND (a.title LIKE ? OR a.content LIKE ?)';
        const searchPattern = `%${search.trim()}%`;
        internParams.push(searchPattern, searchPattern);
      }

      const countRows = await query(`
        SELECT COUNT(*) as total
        FROM announcements a
        WHERE ${internWhere}
      `, internParams);
      const totalCount = countRows[0].total;

      const announcements = await query(`
        SELECT a.id, a.title, a.content, a.priority, a.is_pinned, a.requires_acknowledgement,
               a.published_at, a.expires_at, a.target_type,
               u.first_name as author_first_name, u.last_name as author_last_name,
               IF(ack.id IS NOT NULL, 1, 0) as is_acknowledged,
               ack.acknowledged_at
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        LEFT JOIN announcement_acknowledgements ack ON (ack.announcement_id = a.id AND ack.user_id = ?)
        WHERE ${internWhere}
        ORDER BY a.is_pinned DESC, a.published_at DESC
        LIMIT ? OFFSET ?
      `, [userId, ...internParams, limitNum, offset]);

      return res.json({
        success: true,
        data: announcements,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      });
    }

    // -----------------------------------------------------------
    // Case 3: Mentor (Scoped to General Broadcasts & Mentored Cohorts)
    // -----------------------------------------------------------
    if (userRole === 'mentor') {
      const userId = req.user.id;
      const mentorId = req.user.mentorId || 0;

      // Mentor supervised cohorts
      const cohortRows = await query(`
        SELECT id, track_id FROM cohorts WHERE lead_mentor_id = ?
      `, [mentorId]);
      const cohortIds = cohortRows.map(c => c.id);
      const trackIds = [...new Set(cohortRows.map(c => c.track_id))];

      let mentorWhere = `
        a.status = 'published'
        AND (a.published_at IS NULL OR a.published_at <= NOW())
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND (
          a.target_type = 'all'
          OR a.target_type = 'mentors'
          ${cohortIds.length > 0 ? `OR (a.target_type = 'cohort' AND a.target_id IN (${cohortIds.map(() => '?').join(',')}))` : ''}
          ${trackIds.length > 0 ? `OR (a.target_type = 'track' AND a.target_id IN (${trackIds.map(() => '?').join(',')}))` : ''}
        )
      `;
      const mentorParams = [...cohortIds, ...trackIds];

      if (priority && priority !== 'all') {
        mentorWhere += ' AND a.priority = ?';
        mentorParams.push(priority);
      }
      if (search && search.trim()) {
        mentorWhere += ' AND (a.title LIKE ? OR a.content LIKE ?)';
        const searchPattern = `%${search.trim()}%`;
        mentorParams.push(searchPattern, searchPattern);
      }

      const countRows = await query(`
        SELECT COUNT(*) as total
        FROM announcements a
        WHERE ${mentorWhere}
      `, mentorParams);
      const totalCount = countRows[0].total;

      const announcements = await query(`
        SELECT a.*,
               u.first_name as author_first_name, u.last_name as author_last_name,
               IF(ack.id IS NOT NULL, 1, 0) as is_acknowledged,
               ack.acknowledged_at
        FROM announcements a
        JOIN users u ON a.author_id = u.id
        LEFT JOIN announcement_acknowledgements ack ON (ack.announcement_id = a.id AND ack.user_id = ?)
        WHERE ${mentorWhere}
        ORDER BY a.is_pinned DESC, a.published_at DESC
        LIMIT ? OFFSET ?
      `, [userId, ...mentorParams, limitNum, offset]);

      return res.json({
        success: true,
        data: announcements,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      });
    }

    return res.status(403).json({ success: false, message: 'Unauthorized role access.' });
  } catch (error) {
    console.error('getAnnouncements error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve announcements.' });
  }
};

/**
 * Get single announcement by ID
 */
export const getAnnouncementById = async (req, res) => {
  try {
    await updateAnnouncementLifecycles();

    const { id } = req.params;
    const userRole = req.user.role;

    const rows = await query(`
      SELECT a.*,
             u.first_name as author_first_name, u.last_name as author_last_name,
             t.name as track_name,
             c.name as cohort_name,
             ip.intern_code,
             (SELECT COUNT(*) FROM announcement_acknowledgements ack WHERE ack.announcement_id = a.id) as acknowledged_count,
             IF(my_ack.id IS NOT NULL, 1, 0) as is_acknowledged,
             my_ack.acknowledged_at
      FROM announcements a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN tracks t ON (a.target_type = 'track' AND a.target_id = t.id)
      LEFT JOIN cohorts c ON (a.target_type = 'cohort' AND a.target_id = c.id)
      LEFT JOIN intern_profiles ip ON (a.target_type = 'intern' AND (a.target_id = ip.id OR a.target_id = ip.user_id))
      LEFT JOIN announcement_acknowledgements my_ack ON (my_ack.announcement_id = a.id AND my_ack.user_id = ?)
      WHERE a.id = ?
    `, [req.user.id, id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const announcement = rows[0];

    // Role-based visibility check for non-admins
    if (userRole === 'intern') {
      if (announcement.status !== 'published') {
        return res.status(404).json({ success: false, message: 'Announcement not found or not published.' });
      }
      const internTrackId = req.user.trackId || 0;
      const internCohortId = req.user.cohortId || 0;
      const internProfileId = req.user.internProfileId || 0;

      const isEligible =
        announcement.target_type === 'all' ||
        announcement.target_type === 'interns' ||
        (announcement.target_type === 'track' && announcement.target_id === internTrackId) ||
        (announcement.target_type === 'cohort' && announcement.target_id === internCohortId) ||
        (announcement.target_type === 'intern' && (announcement.target_id === internProfileId || announcement.target_id === req.user.id));

      if (!isEligible) {
        return res.status(403).json({ success: false, message: 'You are not authorized to view this announcement.' });
      }
    }

    if (userRole === 'mentor') {
      if (announcement.status !== 'published') {
        return res.status(404).json({ success: false, message: 'Announcement not found or not published.' });
      }
      const mentorId = req.user.mentorId || 0;
      const cohortRows = await query(
        `SELECT id, track_id FROM cohorts WHERE lead_mentor_id = ?`,
        [mentorId]
      );
      const cohortIds = cohortRows.map(c => c.id);
      const trackIds = [...new Set(cohortRows.map(c => c.track_id))];

      const isEligible =
        announcement.target_type === 'all' ||
        announcement.target_type === 'mentors' ||
        (announcement.target_type === 'cohort' && cohortIds.includes(announcement.target_id)) ||
        (announcement.target_type === 'track' && trackIds.includes(announcement.target_id));

      if (!isEligible) {
        return res.status(403).json({ success: false, message: 'You are not authorized to view this announcement.' });
      }
    }

    res.json({ success: true, data: announcement });
  } catch (error) {
    console.error('getAnnouncementById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve announcement details.' });
  }
};

/**
 * Create an announcement (Gate 3, 4, 10)
 */
export const createAnnouncement = async (req, res) => {
  try {
    const {
      title,
      content,
      targetType = 'all',
      targetId = null,
      priority = 'normal',
      isPinned = false,
      requiresAcknowledgement = false,
      status = 'published',
      scheduledAt = null,
      expiresAt = null
    } = req.body;

    if (!title || !title.trim() || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Announcement title and content are required.' });
    }

    const validTargets = ['all', 'interns', 'mentors', 'admins', 'track', 'cohort', 'intern'];
    if (!validTargets.includes(targetType)) {
      return res.status(400).json({ success: false, message: `Invalid targetType. Must be one of: ${validTargets.join(', ')}` });
    }

    if (['track', 'cohort', 'intern'].includes(targetType) && !targetId) {
      return res.status(400).json({ success: false, message: `targetId is required when targetType is '${targetType}'.` });
    }

    const validStatuses = ['draft', 'scheduled', 'published'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Initial status must be draft, scheduled, or published.' });
    }

    let resolvedStatus = status;
    let publishedAtVal = null;
    let scheduledAtVal = null;

    if (status === 'scheduled') {
      if (!scheduledAt) {
        return res.status(400).json({ success: false, message: 'scheduledAt timestamp is required when status is scheduled.' });
      }
      const schedDate = new Date(scheduledAt);
      if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
        return res.status(400).json({ success: false, message: 'scheduledAt must be a valid future datetime.' });
      }
      scheduledAtVal = schedDate;
    } else if (status === 'published') {
      publishedAtVal = new Date();
    }

    const expiresAtVal = expiresAt ? new Date(expiresAt) : null;

    const result = await query(`
      INSERT INTO announcements (
        title, content, author_id, target_type, target_id,
        status, priority, is_pinned, requires_acknowledgement,
        published_at, scheduled_at, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      content.trim(),
      req.user.id,
      targetType,
      targetId ? parseInt(targetId, 10) : null,
      resolvedStatus,
      priority,
      isPinned ? 1 : 0,
      requiresAcknowledgement ? 1 : 0,
      publishedAtVal,
      scheduledAtVal,
      expiresAtVal
    ]);

    const announcementId = result.insertId;

    // Trigger in-app notifications if immediately published
    if (resolvedStatus === 'published') {
      notifyAnnouncementPublished(announcementId).catch(err =>
        console.error('Error dispatching notifications:', err)
      );
    }

    // Audit log
    await recordAuditLog(
      req.user.id,
      resolvedStatus === 'scheduled' ? 'SCHEDULE_ANNOUNCEMENT' : (resolvedStatus === 'published' ? 'PUBLISH_ANNOUNCEMENT' : 'CREATE_ANNOUNCEMENT'),
      'announcements',
      announcementId,
      null,
      { title: title.trim(), targetType, targetId, status: resolvedStatus, priority },
      req
    );

    res.status(201).json({
      success: true,
      message: resolvedStatus === 'published' ? 'Announcement published successfully.' : (resolvedStatus === 'scheduled' ? 'Announcement scheduled successfully.' : 'Announcement saved as draft.'),
      data: { id: announcementId }
    });
  } catch (error) {
    console.error('createAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement.' });
  }
};

/**
 * Update an announcement (Gate 3, 10)
 */
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    const current = existing[0];

    const {
      title,
      content,
      targetType,
      targetId,
      priority,
      isPinned,
      requiresAcknowledgement,
      scheduledAt,
      expiresAt
    } = req.body;

    const updatedTitle = title !== undefined ? title.trim() : current.title;
    const updatedContent = content !== undefined ? content.trim() : current.content;
    const updatedTargetType = targetType !== undefined ? targetType : current.target_type;
    const updatedTargetId = targetId !== undefined ? (targetId ? parseInt(targetId, 10) : null) : current.target_id;
    const updatedPriority = priority !== undefined ? priority : current.priority;
    const updatedIsPinned = isPinned !== undefined ? (isPinned ? 1 : 0) : current.is_pinned;
    const updatedReqAck = requiresAcknowledgement !== undefined ? (requiresAcknowledgement ? 1 : 0) : current.requires_acknowledgement;
    const updatedSchedAt = scheduledAt !== undefined ? (scheduledAt ? new Date(scheduledAt) : null) : current.scheduled_at;
    const updatedExpiresAt = expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : current.expires_at;

    await query(`
      UPDATE announcements
      SET title = ?, content = ?, target_type = ?, target_id = ?,
          priority = ?, is_pinned = ?, requires_acknowledgement = ?,
          scheduled_at = ?, expires_at = ?
      WHERE id = ?
    `, [
      updatedTitle,
      updatedContent,
      updatedTargetType,
      updatedTargetId,
      updatedPriority,
      updatedIsPinned,
      updatedReqAck,
      updatedSchedAt,
      updatedExpiresAt,
      id
    ]);

    await recordAuditLog(
      req.user.id,
      'UPDATE_ANNOUNCEMENT',
      'announcements',
      id,
      current,
      req.body,
      req
    );

    res.json({ success: true, message: 'Announcement updated successfully.' });
  } catch (error) {
    console.error('updateAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement.' });
  }
};

/**
 * Publish an announcement immediately (Gate 2, 3, 10)
 */
export const publishAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    const current = existing[0];

    if (current.status === 'published') {
      return res.status(400).json({ success: false, message: 'Announcement is already published.' });
    }

    await query(`
      UPDATE announcements
      SET status = 'published', published_at = NOW(), scheduled_at = NULL
      WHERE id = ?
    `, [id]);

    notifyAnnouncementPublished(id).catch(err =>
      console.error('Error dispatching notifications on publish:', err)
    );

    await recordAuditLog(
      req.user.id,
      'PUBLISH_ANNOUNCEMENT',
      'announcements',
      id,
      { status: current.status },
      { status: 'published' },
      req
    );

    res.json({ success: true, message: 'Announcement published successfully.' });
  } catch (error) {
    console.error('publishAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to publish announcement.' });
  }
};

/**
 * Schedule an announcement (Gate 2, 3, 10)
 */
export const scheduleAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'scheduledAt datetime is required.' });
    }
    const schedDate = new Date(scheduledAt);
    if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'scheduledAt must be a valid future datetime.' });
    }

    const existing = await query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    await query(`
      UPDATE announcements
      SET status = 'scheduled', scheduled_at = ?
      WHERE id = ?
    `, [schedDate, id]);

    await recordAuditLog(
      req.user.id,
      'SCHEDULE_ANNOUNCEMENT',
      'announcements',
      id,
      { status: existing[0].status },
      { status: 'scheduled', scheduledAt: schedDate },
      req
    );

    res.json({ success: true, message: 'Announcement scheduled successfully.' });
  } catch (error) {
    console.error('scheduleAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to schedule announcement.' });
  }
};

/**
 * Archive an announcement (Gate 2, 3, 10)
 */
export const archiveAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    await query(`UPDATE announcements SET status = 'archived' WHERE id = ?`, [id]);

    await recordAuditLog(
      req.user.id,
      'ARCHIVE_ANNOUNCEMENT',
      'announcements',
      id,
      { status: existing[0].status },
      { status: 'archived' },
      req
    );

    res.json({ success: true, message: 'Announcement archived.' });
  } catch (error) {
    console.error('archiveAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive announcement.' });
  }
};

/**
 * Delete an announcement (Gate 3, 10)
 */
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    await query(`DELETE FROM announcements WHERE id = ?`, [id]);

    await recordAuditLog(
      req.user.id,
      'DELETE_ANNOUNCEMENT',
      'announcements',
      id,
      existing[0],
      null,
      req
    );

    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (error) {
    console.error('deleteAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete announcement.' });
  }
};

/**
 * Preview audience calculation before publishing (Gate 4, 16)
 */
export const getAudiencePreview = async (req, res) => {
  try {
    const { targetType = 'all', targetId = null } = req.query;
    const userIds = await resolveAudienceUserIds(targetType, targetId);

    if (userIds.length === 0) {
      return res.json({
        success: true,
        data: {
          recipientCount: 0,
          sampleUsers: []
        }
      });
    }

    // Fetch details for sample users (up to 10)
    const sampleIds = userIds.slice(0, 10);
    const sampleUsers = await query(`
      SELECT u.id, u.first_name, u.last_name, u.email, r.name as role_name,
             ip.intern_code, t.name as track_name, c.name as cohort_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN intern_profiles ip ON u.id = ip.user_id
      LEFT JOIN tracks t ON ip.track_id = t.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE u.id IN (${sampleIds.map(() => '?').join(',')})
    `, sampleIds);

    res.json({
      success: true,
      data: {
        recipientCount: userIds.length,
        sampleUsers
      }
    });
  } catch (error) {
    console.error('getAudiencePreview error:', error);
    res.status(500).json({ success: false, message: 'Failed to preview audience.' });
  }
};

// ============================================================================
// ACKNOWLEDGEMENT WORKFLOW (Gate 9, 10)
// ============================================================================

/**
 * Acknowledge an announcement
 */
export const acknowledgeAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const annRows = await query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (annRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    const announcement = annRows[0];

    if (!announcement.requires_acknowledgement) {
      return res.status(400).json({ success: false, message: 'This announcement does not require acknowledgement.' });
    }

    if (announcement.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Only published announcements can be acknowledged.' });
    }

    // Insert acknowledgement (idempotent via INSERT IGNORE)
    await query(`
      INSERT IGNORE INTO announcement_acknowledgements (announcement_id, user_id, acknowledged_at)
      VALUES (?, ?, NOW())
    `, [id, userId]);

    // Record audit log
    await recordAuditLog(
      userId,
      'ACKNOWLEDGE_ANNOUNCEMENT',
      'announcements',
      id,
      null,
      { userId, announcementId: id },
      req
    );

    res.json({
      success: true,
      message: 'Announcement successfully acknowledged.',
      data: { acknowledgedAt: new Date().toISOString() }
    });
  } catch (error) {
    console.error('acknowledgeAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to record acknowledgement.' });
  }
};

/**
 * Get announcements requiring acknowledgement that have not yet been acknowledged by current user
 */
export const getPendingAcknowledgements = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const internTrackId = req.user.trackId || 0;
    const internCohortId = req.user.cohortId || 0;
    const internProfileId = req.user.internProfileId || 0;

    let whereClause = `
      a.status = 'published'
      AND a.requires_acknowledgement = 1
      AND (a.published_at IS NULL OR a.published_at <= NOW())
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
      AND ack.id IS NULL
    `;

    if (userRole === 'intern') {
      whereClause += `
        AND (
          a.target_type = 'all'
          OR a.target_type = 'interns'
          OR (a.target_type = 'track' AND a.target_id = ${parseInt(internTrackId, 10)})
          OR (a.target_type = 'cohort' AND a.target_id = ${parseInt(internCohortId, 10)})
          OR (a.target_type = 'intern' AND (a.target_id = ${parseInt(internProfileId, 10)} OR a.target_id = ${parseInt(userId, 10)}))
        )
      `;
    }

    const pending = await query(`
      SELECT a.id, a.title, a.content, a.priority, a.is_pinned, a.published_at,
             u.first_name as author_first_name, u.last_name as author_last_name
      FROM announcements a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN announcement_acknowledgements ack ON (ack.announcement_id = a.id AND ack.user_id = ?)
      WHERE ${whereClause}
      ORDER BY a.priority = 'urgent' DESC, a.priority = 'high' DESC, a.published_at DESC
    `, [userId]);

    res.json({ success: true, data: pending, count: pending.length });
  } catch (error) {
    console.error('getPendingAcknowledgements error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending acknowledgements.' });
  }
};

/**
 * Get recipient acknowledgement statuses for an announcement (Admin only)
 */
export const getAnnouncementAcknowledgements = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'all', page = 1, limit = 50 } = req.query;

    const annRows = await query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    if (annRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    const announcement = annRows[0];

    // Resolve all targeted user IDs
    const targetUserIds = await resolveAudienceUserIds(announcement.target_type, announcement.target_id);

    if (targetUserIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        stats: { totalTargeted: 0, acknowledgedCount: 0, completionRate: 0 },
        pagination: { page: 1, limit, total: 0, totalPages: 0 }
      });
    }

    const placeholders = targetUserIds.map(() => '?').join(',');

    // Fetch targeted users along with acknowledgement info
    let whereFilter = `u.id IN (${placeholders})`;
    const filterParams = [...targetUserIds];
    if (status === 'acknowledged') {
      whereFilter += ` AND ack.id IS NOT NULL`;
    } else if (status === 'pending') {
      whereFilter += ` AND ack.id IS NULL`;
    }

    const countRows = await query(`
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN announcement_acknowledgements ack ON (ack.announcement_id = ? AND ack.user_id = u.id)
      WHERE ${whereFilter}
    `, [id, ...filterParams]);
    const totalFiltered = countRows[0].total;

    const ackCountRows = await query(`
      SELECT COUNT(*) as count
      FROM announcement_acknowledgements
      WHERE announcement_id = ? AND user_id IN (${placeholders})
    `, [id, ...targetUserIds]);
    const acknowledgedCount = ackCountRows[0].count;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const offset = (pageNum - 1) * limitNum;

    const records = await query(`
      SELECT u.id as user_id, u.first_name, u.last_name, u.email, r.name as role_name,
             ip.intern_code, t.name as track_name, c.name as cohort_name,
             IF(ack.id IS NOT NULL, 1, 0) as is_acknowledged,
             ack.acknowledged_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN intern_profiles ip ON u.id = ip.user_id
      LEFT JOIN tracks t ON ip.track_id = t.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN announcement_acknowledgements ack ON (ack.announcement_id = ? AND ack.user_id = u.id)
      WHERE ${whereFilter}
      ORDER BY is_acknowledged ASC, u.last_name ASC
      LIMIT ? OFFSET ?
    `, [id, ...filterParams, limitNum, offset]);

    res.json({
      success: true,
      data: records,
      stats: {
        totalTargeted: targetUserIds.length,
        acknowledgedCount,
        completionRate: targetUserIds.length > 0 ? Math.round((acknowledgedCount / targetUserIds.length) * 100) : 0
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limitNum)
      }
    });
  } catch (error) {
    console.error('getAnnouncementAcknowledgements error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve acknowledgement report.' });
  }
};

// ============================================================================
// NOTIFICATIONS CONTROLLERS (Gates 6, 7, 13, 14, 15)
// ============================================================================

/**
 * Get current user's notifications (Paginated & Filterable)
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isRead, type, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = ['user_id = ?'];
    const params = [userId];

    if (isRead !== undefined && isRead !== 'all') {
      whereClauses.push('is_read = ?');
      params.push(isRead === '1' || isRead === 'true' ? 1 : 0);
    }
    if (type && type !== 'all') {
      whereClauses.push('type = ?');
      params.push(type);
    }

    const whereSql = whereClauses.join(' AND ');

    const countRows = await query(`
      SELECT COUNT(*) as total FROM notifications WHERE ${whereSql}
    `, params);
    const totalCount = countRows[0].total;

    const unreadRows = await query(`
      SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0
    `, [userId]);
    const unreadCount = unreadRows[0].unread_count;

    const notifications = await query(`
      SELECT id, type, title, message, related_entity_type, related_entity_id, link, is_read, read_at, created_at
      FROM notifications
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
};

/**
 * Get real-time unread notification count
 */
export const getUnreadNotificationCount = async (req, res) => {
  try {
    const rows = await query(`
      SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0
    `, [req.user.id]);
    res.json({ success: true, count: rows[0].unread_count });
  } catch (error) {
    console.error('getUnreadNotificationCount error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve unread count.' });
  }
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await query(`SELECT user_id FROM notifications WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    // Ownership check (Gate 6 & 14)
    if (existing[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only manage your own notifications.' });
    }

    await query(`
      UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?
    `, [id]);

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
};

/**
 * Mark a single notification as unread
 */
export const markNotificationAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await query(`SELECT user_id FROM notifications WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    if (existing[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only manage your own notifications.' });
    }

    await query(`
      UPDATE notifications SET is_read = 0, read_at = NULL WHERE id = ?
    `, [id]);

    res.json({ success: true, message: 'Notification marked as unread.' });
  } catch (error) {
    console.error('markNotificationAsUnread error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as unread.' });
  }
};

/**
 * Mark all notifications as read for current user
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await query(`
      UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0
    `, [userId]);

    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('markAllNotificationsAsRead error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
  }
};

/**
 * Dismiss / delete a notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await query(`SELECT user_id FROM notifications WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    if (existing[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own notifications.' });
    }

    await query(`DELETE FROM notifications WHERE id = ?`, [id]);

    res.json({ success: true, message: 'Notification removed.' });
  } catch (error) {
    console.error('deleteNotification error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove notification.' });
  }
};

// ============================================================================
// NOTIFICATION PREFERENCES CONTROLLERS (Gate 8)
// ============================================================================

/**
 * Get notification preferences for current user
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    let rows = await query(`
      SELECT user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications, updated_at
      FROM notification_preferences
      WHERE user_id = ?
    `, [userId]);

    if (rows.length === 0) {
      // Auto-seed default preferences
      await query(`
        INSERT INTO notification_preferences (user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications)
        VALUES (?, 1, 1, 1, 1, 1, 0)
      `, [userId]);
      rows = await query(`
        SELECT user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications, updated_at
        FROM notification_preferences
        WHERE user_id = ?
      `, [userId]);
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('getNotificationPreferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notification preferences.' });
  }
};

/**
 * Update notification preferences for current user
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      announcementsInApp = true,
      tasksInApp = true,
      performanceInApp = true,
      documentsInApp = true
    } = req.body;

    // system_in_app is permanently locked to 1 (mandatory security notices)
    await query(`
      INSERT INTO notification_preferences (user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications)
      VALUES (?, ?, ?, ?, ?, 1, 0)
      ON DUPLICATE KEY UPDATE
        announcements_in_app = VALUES(announcements_in_app),
        tasks_in_app = VALUES(tasks_in_app),
        performance_in_app = VALUES(performance_in_app),
        documents_in_app = VALUES(documents_in_app),
        system_in_app = 1
    `, [
      userId,
      announcementsInApp ? 1 : 0,
      tasksInApp ? 1 : 0,
      performanceInApp ? 1 : 0,
      documentsInApp ? 1 : 0
    ]);

    const updated = await query(`
      SELECT user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications, updated_at
      FROM notification_preferences
      WHERE user_id = ?
    `, [userId]);

    res.json({
      success: true,
      message: 'Notification preferences updated successfully.',
      data: updated[0]
    });
  } catch (error) {
    console.error('updateNotificationPreferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification preferences.' });
  }
};

/**
 * Real-time Server-Sent Events (SSE) Stream
 */
export const sseStreamHandler = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  const connectionId = `${req.user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  sseManager.addClient(connectionId, res, req.user);
};
