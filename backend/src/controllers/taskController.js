import { query } from '../config/db.js';

export const getAllTasks = async (req, res) => {
  try {
    const { trackId, cohortId } = req.query;
    let conditions = [];
    let params = [];

    if (trackId) {
      conditions.push('t.track_id = ?');
      params.push(trackId);
    }
    if (cohortId) {
      conditions.push('t.cohort_id = ?');
      params.push(cohortId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const tasks = await query(`
      SELECT t.*,
             tr.name as track_name,
             c.name as cohort_name,
             u.first_name as author_first, u.last_name as author_last,
             (SELECT COUNT(*) FROM task_submissions ts WHERE ts.task_id = t.id) as submission_count
      FROM tasks t
      JOIN tracks tr ON t.track_id = tr.id
      LEFT JOIN cohorts c ON t.cohort_id = c.id
      JOIN users u ON t.assigned_by = u.id
      ${whereClause}
      ORDER BY t.due_date ASC
    `, params);

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('getAllTasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tasks.' });
  }
};

export const getMyTasks = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    const tasks = await query(`
      SELECT t.*,
             tr.name as track_name,
             c.name as cohort_name,
             ts.id as submission_id, ts.submission_text, ts.submission_url, ts.submitted_at,
             ts.status as submission_status, ts.score, ts.feedback, ts.graded_at,
             gu.first_name as grader_first, gu.last_name as grader_last
      FROM tasks t
      JOIN tracks tr ON t.track_id = tr.id
      LEFT JOIN cohorts c ON t.cohort_id = c.id
      JOIN intern_profiles ip ON (t.track_id = ip.track_id AND (t.cohort_id IS NULL OR t.cohort_id = ip.cohort_id))
      LEFT JOIN task_submissions ts ON (t.id = ts.task_id AND ts.intern_id = ip.id)
      LEFT JOIN users gu ON ts.graded_by = gu.id
      WHERE ip.id = ?
      ORDER BY t.due_date ASC
    `, [internProfileId]);

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('getMyTasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve your tasks.' });
  }
};

export const submitTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const internProfileId = req.user.internProfileId;
    const { submissionText, submissionUrl } = req.body;

    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Only interns can submit tasks.' });
    }
    if (!submissionUrl && !submissionText) {
      return res.status(400).json({ success: false, message: 'Submission link or text response is required.' });
    }

    await query(`
      INSERT INTO task_submissions (task_id, intern_id, submission_text, submission_url, submitted_at, status)
      VALUES (?, ?, ?, ?, NOW(), 'submitted')
      ON DUPLICATE KEY UPDATE
        submission_text = VALUES(submission_text),
        submission_url = VALUES(submission_url),
        submitted_at = NOW(),
        status = 'submitted'
    `, [taskId, internProfileId, submissionText || null, submissionUrl || null]);

    res.json({ success: true, message: 'Task submitted successfully.' });
  } catch (error) {
    console.error('submitTask error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit task.' });
  }
};

export const gradeSubmission = async (req, res) => {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const { score, feedback } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ success: false, message: 'Score is required.' });
    }

    await query(`
      UPDATE task_submissions
      SET score = ?, feedback = ?, graded_by = ?, graded_at = NOW(), status = 'graded'
      WHERE id = ?
    `, [score, feedback || null, req.user.id, submissionId]);

    res.json({ success: true, message: 'Submission graded successfully.' });
  } catch (error) {
    console.error('gradeSubmission error:', error);
    res.status(500).json({ success: false, message: 'Failed to grade submission.' });
  }
};
