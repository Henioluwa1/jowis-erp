import { query } from '../config/db.js';

export const getTracks = async (req, res) => {
  try {
    const tracks = await query(`
      SELECT t.*,
             COUNT(DISTINCT c.id) as cohort_count,
             COUNT(DISTINCT ip.id) as intern_count
      FROM tracks t
      LEFT JOIN cohorts c ON t.id = c.track_id
      LEFT JOIN intern_profiles ip ON t.id = ip.track_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `);
    res.json({ success: true, data: tracks });
  } catch (error) {
    console.error('getTracks error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tracks.' });
  }
};

export const createTrack = async (req, res) => {
  try {
    const { name, description, durationWeeks, curriculumSummary, requiredSkills } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Track name is required.' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = await query(
      `INSERT INTO tracks (name, slug, description, duration_weeks, curriculum_summary, required_skills, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [name, slug, description || null, durationWeeks || 24, curriculumSummary || null, requiredSkills || null]
    );

    res.status(201).json({ success: true, message: 'Track created successfully.', data: { id: result.insertId } });
  } catch (error) {
    console.error('createTrack error:', error);
    res.status(500).json({ success: false, message: 'Failed to create track.' });
  }
};

export const getCohorts = async (req, res) => {
  try {
    const cohorts = await query(`
      SELECT c.*,
             t.name as track_name,
             u.first_name as mentor_first, u.last_name as mentor_last,
             COUNT(ip.id) as current_interns_count
      FROM cohorts c
      JOIN tracks t ON c.track_id = t.id
      LEFT JOIN mentors m ON c.lead_mentor_id = m.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN intern_profiles ip ON c.id = ip.cohort_id
      GROUP BY c.id
      ORDER BY c.start_date DESC
    `);
    res.json({ success: true, data: cohorts });
  } catch (error) {
    console.error('getCohorts error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve cohorts.' });
  }
};

export const createCohort = async (req, res) => {
  try {
    const { name, trackId, leadMentorId, startDate, endDate, capacity, status } = req.body;
    if (!name || !trackId || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Name, track, start date, and end date are required.' });
    }

    const result = await query(
      `INSERT INTO cohorts (name, track_id, lead_mentor_id, start_date, end_date, capacity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, trackId, leadMentorId || null, startDate, endDate, capacity || 30, status || 'active']
    );

    res.status(201).json({ success: true, message: 'Cohort created successfully.', data: { id: result.insertId } });
  } catch (error) {
    console.error('createCohort error:', error);
    res.status(500).json({ success: false, message: 'Failed to create cohort.' });
  }
};

export const getMentors = async (req, res) => {
  try {
    const mentors = await query(`
      SELECT m.id, m.specialization, m.bio,
             u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url,
             COUNT(DISTINCT c.id) as assigned_cohorts,
             COUNT(DISTINCT ip.id) as assigned_interns
      FROM mentors m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN cohorts c ON m.id = c.lead_mentor_id
      LEFT JOIN intern_profiles ip ON m.id = ip.mentor_id
      GROUP BY m.id
    `);
    res.json({ success: true, data: mentors });
  } catch (error) {
    console.error('getMentors error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve mentors.' });
  }
};
