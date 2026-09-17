import { query } from '../config/db.js';

export const getAnnouncements = async (req, res) => {
  try {
    const announcements = await query(`
      SELECT a.*,
             u.first_name, u.last_name,
             t.name as track_name
      FROM announcements a
      JOIN users u ON a.author_id = u.id
      LEFT JOIN tracks t ON (a.target_type = 'track' AND a.target_id = t.id)
      ORDER BY a.is_pinned DESC, a.created_at DESC
    `);
    res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('getAnnouncements error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve announcements.' });
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetType, targetId, isPinned } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const result = await query(`
      INSERT INTO announcements (title, content, author_id, target_type, target_id, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, content, req.user.id, targetType || 'all', targetId || null, isPinned ? 1 : 0]);

    res.status(201).json({ success: true, message: 'Announcement published.', data: { id: result.insertId } });
  } catch (error) {
    console.error('createAnnouncement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement.' });
  }
};
