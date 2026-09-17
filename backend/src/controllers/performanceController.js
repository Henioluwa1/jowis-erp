import { query } from '../config/db.js';

export const getMyPerformance = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    const evaluations = await query(`
      SELECT pe.*,
             u.first_name as evaluator_first, u.last_name as evaluator_last
      FROM performance_evaluations pe
      JOIN users u ON pe.evaluator_id = u.id
      WHERE pe.intern_id = ?
      ORDER BY pe.created_at DESC
    `, [internProfileId]);

    // Latest evaluation category radar scores
    const latest = evaluations[0] || null;
    const radarData = latest ? [
      { category: 'Technical Skills', score: latest.technical_skills * 20 },
      { category: 'Task Completion', score: latest.task_completion * 20 },
      { category: 'Problem Solving', score: latest.problem_solving * 20 },
      { category: 'Communication', score: latest.communication * 20 },
      { category: 'Teamwork', score: latest.teamwork * 20 },
      { category: 'Professionalism', score: latest.professionalism * 20 },
      { category: 'Learning Progress', score: latest.learning_progress * 20 },
      { category: 'Attendance Rating', score: latest.attendance_rating * 20 }
    ] : [];

    res.json({
      success: true,
      data: {
        evaluations,
        latest,
        radarData
      }
    });
  } catch (error) {
    console.error('getMyPerformance error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve performance data.' });
  }
};

export const getAdminPerformanceOverview = async (req, res) => {
  try {
    const evaluations = await query(`
      SELECT pe.*,
             ip.intern_code,
             u.first_name as intern_first, u.last_name as intern_last,
             t.name as track_name,
             c.name as cohort_name,
             eu.first_name as evaluator_first, eu.last_name as evaluator_last
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      JOIN cohorts c ON ip.cohort_id = c.id
      JOIN users eu ON pe.evaluator_id = eu.id
      ORDER BY pe.created_at DESC
      LIMIT 50
    `);

    const [stats] = await query(`
      SELECT
        AVG(overall_score) as avg_score,
        MAX(overall_score) as max_score,
        MIN(overall_score) as min_score,
        COUNT(*) as total_evaluations
      FROM performance_evaluations
    `);

    res.json({
      success: true,
      data: {
        evaluations,
        stats: {
          average: Math.round(parseFloat(stats.avg_score || 0) * 10) / 10,
          max: parseFloat(stats.max_score || 0),
          min: parseFloat(stats.min_score || 0),
          total: parseInt(stats.total_evaluations || 0, 10)
        }
      }
    });
  } catch (error) {
    console.error('getAdminPerformanceOverview error:', error);
    res.status(500).json({ success: false, message: 'Failed to load performance overview.' });
  }
};

export const createEvaluation = async (req, res) => {
  try {
    const {
      internId,
      evaluationPeriod,
      technicalSkills,
      taskCompletion,
      problemSolving,
      communication,
      teamwork,
      professionalism,
      learningProgress,
      attendanceRating,
      summaryFeedback
    } = req.body;

    if (!internId || !evaluationPeriod) {
      return res.status(400).json({ success: false, message: 'Intern and evaluation period are required.' });
    }

    // Calculate overall percentage (average out of 5 converted to 0-100%)
    const categories = [
      technicalSkills || 3,
      taskCompletion || 3,
      problemSolving || 3,
      communication || 3,
      teamwork || 3,
      professionalism || 3,
      learningProgress || 3,
      attendanceRating || 3
    ];

    const sum = categories.reduce((acc, curr) => acc + curr, 0);
    const overallScore = Math.round((sum / (categories.length * 5)) * 10000) / 100;

    const result = await query(`
      INSERT INTO performance_evaluations
      (intern_id, evaluator_id, evaluation_period, technical_skills, task_completion, problem_solving, communication, teamwork, professionalism, learning_progress, attendance_rating, overall_score, summary_feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      internId,
      req.user.id,
      evaluationPeriod,
      technicalSkills || 3,
      taskCompletion || 3,
      problemSolving || 3,
      communication || 3,
      teamwork || 3,
      professionalism || 3,
      learningProgress || 3,
      attendanceRating || 3,
      overallScore,
      summaryFeedback || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Evaluation submitted successfully.',
      data: { id: result.insertId, overallScore }
    });
  } catch (error) {
    console.error('createEvaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create evaluation.' });
  }
};
