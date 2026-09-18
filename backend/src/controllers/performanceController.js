import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';

// ============================================================================
// GATE 3: PERFORMANCE PERIOD MANAGEMENT
// ============================================================================

/**
 * Retrieve all performance periods with optional status and search filtering
 */
export const getPeriods = async (req, res) => {
  try {
    const { status, search } = req.query;
    let conditions = [];
    let params = [];

    if (status && status !== 'all') {
      conditions.push('pp.status = ?');
      params.push(status);
    }
    if (search && search.trim()) {
      conditions.push('(pp.name LIKE ? OR pp.description LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const periods = await query(`
      SELECT pp.*,
             u.first_name as creator_first, u.last_name as creator_last,
             COUNT(pe.id) as total_evaluations,
             SUM(CASE WHEN pe.status = 'finalized' THEN 1 ELSE 0 END) as finalized_count,
             AVG(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as avg_score
      FROM performance_periods pp
      JOIN users u ON pp.created_by = u.id
      LEFT JOIN performance_evaluations pe ON pp.id = pe.period_id
      ${whereClause}
      GROUP BY pp.id
      ORDER BY pp.start_date DESC, pp.id DESC
    `, params);

    res.json({
      success: true,
      data: periods.map(p => ({
        ...p,
        total_evaluations: parseInt(p.total_evaluations || 0, 10),
        finalized_count: parseInt(p.finalized_count || 0, 10),
        avg_score: p.avg_score !== null ? Math.round(parseFloat(p.avg_score) * 10) / 10 : null
      }))
    });
  } catch (error) {
    console.error('getPeriods error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve performance periods.' });
  }
};

/**
 * Get a single performance period by ID
 */
export const getPeriodById = async (req, res) => {
  try {
    const periodId = parseInt(req.params.id, 10);
    const [period] = await query(`
      SELECT pp.*, u.first_name as creator_first, u.last_name as creator_last
      FROM performance_periods pp
      JOIN users u ON pp.created_by = u.id
      WHERE pp.id = ?
    `, [periodId]);

    if (!period) {
      return res.status(404).json({ success: false, message: 'Performance period not found.' });
    }

    const [stats] = await query(`
      SELECT
        COUNT(*) as total_evaluations,
        SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) as finalized_count,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
        AVG(CASE WHEN status = 'finalized' THEN overall_score ELSE NULL END) as avg_score
      FROM performance_evaluations
      WHERE period_id = ?
    `, [periodId]);

    res.json({
      success: true,
      data: {
        ...period,
        stats: {
          total: parseInt(stats.total_evaluations || 0, 10),
          finalized: parseInt(stats.finalized_count || 0, 10),
          draft: parseInt(stats.draft_count || 0, 10),
          submitted: parseInt(stats.submitted_count || 0, 10),
          averageScore: stats.avg_score !== null ? Math.round(parseFloat(stats.avg_score) * 10) / 10 : null
        }
      }
    });
  } catch (error) {
    console.error('getPeriodById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve performance period details.' });
  }
};

/**
 * Create a new performance period (Gate 3)
 */
export const createPeriod = async (req, res) => {
  try {
    const { name, description, startDate, endDate, status = 'draft' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Period name is required.' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required.' });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date.' });
    }

    const validStatuses = ['draft', 'active', 'closed', 'archived'];
    const finalStatus = validStatuses.includes(status) ? status : 'draft';

    const result = await query(`
      INSERT INTO performance_periods (name, description, start_date, end_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name.trim(), description ? description.trim() : null, startDate, endDate, finalStatus, req.user.id]);

    const periodId = result.insertId;
    await recordAuditLog(req.user.id, 'CREATE_PERFORMANCE_PERIOD', 'performance_periods', periodId, null, req.body, req);

    res.status(201).json({
      success: true,
      message: 'Performance period created successfully.',
      data: { id: periodId, name: name.trim(), status: finalStatus }
    });
  } catch (error) {
    console.error('createPeriod error:', error);
    res.status(500).json({ success: false, message: 'Failed to create performance period.' });
  }
};

/**
 * Update an existing performance period (Gate 3 - only allowed in 'draft' or 'active' state)
 */
export const updatePeriod = async (req, res) => {
  try {
    const periodId = parseInt(req.params.id, 10);
    const { name, description, startDate, endDate } = req.body;

    const [existing] = await query('SELECT * FROM performance_periods WHERE id = ?', [periodId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Performance period not found.' });
    }

    // Historical protection: Closed/archived periods cannot have core schedule details mutated
    if (['closed', 'archived'].includes(existing.status)) {
      return res.status(400).json({
        success: false,
        message: `Historical Protection: Cannot modify schedule of a '${existing.status}' performance period.`
      });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date.' });
    }

    await query(`
      UPDATE performance_periods
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date)
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      startDate || null,
      endDate || null,
      periodId
    ]);

    await recordAuditLog(req.user.id, 'UPDATE_PERFORMANCE_PERIOD', 'performance_periods', periodId, existing, req.body, req);

    res.json({ success: true, message: 'Performance period updated successfully.' });
  } catch (error) {
    console.error('updatePeriod error:', error);
    res.status(500).json({ success: false, message: 'Failed to update performance period.' });
  }
};

/**
 * Controlled lifecycle transition for a performance period (Gate 3)
 * Transitions: draft -> active -> closed -> archived
 */
export const transitionPeriodStatus = async (req, res) => {
  try {
    const periodId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const [existing] = await query('SELECT * FROM performance_periods WHERE id = ?', [periodId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Performance period not found.' });
    }

    const current = existing.status;
    const allowedTransitions = {
      draft: ['active', 'archived'],
      active: ['closed'],
      closed: ['archived', 'active'],
      archived: []
    };

    if (!allowedTransitions[current] || !allowedTransitions[current].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Lifecycle Transition: Cannot move period from '${current}' to '${status}'. Permitted transitions: [${(allowedTransitions[current] || []).join(', ')}].`
      });
    }

    await query('UPDATE performance_periods SET status = ? WHERE id = ?', [status, periodId]);

    const auditAction = status === 'active'
      ? 'ACTIVATE_PERFORMANCE_PERIOD'
      : status === 'closed'
      ? 'CLOSE_PERFORMANCE_PERIOD'
      : status === 'archived'
      ? 'ARCHIVE_PERFORMANCE_PERIOD'
      : 'UPDATE_PERFORMANCE_PERIOD';

    await recordAuditLog(req.user.id, auditAction, 'performance_periods', periodId, { status: current }, { status }, req);

    res.json({
      success: true,
      message: `Performance period transitioned to '${status}'.`,
      data: { id: periodId, status }
    });
  } catch (error) {
    console.error('transitionPeriodStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to transition performance period status.' });
  }
};


// ============================================================================
// GATE 2: PERFORMANCE CRITERIA MANAGEMENT
// ============================================================================

/**
 * Retrieve performance evaluation criteria (Gate 2)
 */
export const getCriteria = async (req, res) => {
  try {
    const { status, category } = req.query;
    let conditions = [];
    let params = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const criteria = await query(`
      SELECT pc.*,
             COUNT(es.id) as usage_count
      FROM performance_criteria pc
      LEFT JOIN evaluation_scores es ON pc.id = es.criterion_id
      ${whereClause}
      GROUP BY pc.id
      ORDER BY pc.order_index ASC, pc.id ASC
    `, params);

    // Calculate sum of active weights
    const [weightStat] = await query(`
      SELECT SUM(weight) as total_active_weight
      FROM performance_criteria
      WHERE status = 'active'
    `);

    res.json({
      success: true,
      data: {
        criteria: criteria.map(c => ({
          ...c,
          weight: parseFloat(c.weight),
          max_score: parseFloat(c.max_score),
          usage_count: parseInt(c.usage_count || 0, 10)
        })),
        totalActiveWeight: parseFloat(weightStat.total_active_weight || 0),
        isBalanced: Math.abs(parseFloat(weightStat.total_active_weight || 0) - 100.00) < 0.01
      }
    });
  } catch (error) {
    console.error('getCriteria error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve performance criteria.' });
  }
};

/**
 * Create a new evaluation criterion (Gate 2)
 */
export const createCriterion = async (req, res) => {
  try {
    const { name, description, category = 'technical', weight, maxScore = 100, status = 'active', orderIndex } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Criterion name is required.' });
    }

    const numericWeight = parseFloat(weight);
    if (isNaN(numericWeight) || numericWeight <= 0 || numericWeight > 100) {
      return res.status(400).json({ success: false, message: 'Criterion weight must be a positive percentage between 1 and 100.' });
    }

    const numericMaxScore = parseFloat(maxScore);
    if (isNaN(numericMaxScore) || numericMaxScore <= 0) {
      return res.status(400).json({ success: false, message: 'Maximum score must be greater than 0.' });
    }

    // Auto calculate order index if omitted
    let finalOrder = orderIndex;
    if (!finalOrder) {
      const [maxOrder] = await query('SELECT MAX(order_index) as max_ord FROM performance_criteria');
      finalOrder = (maxOrder?.max_ord || 0) + 1;
    }

    const validCategories = ['technical', 'delivery', 'behavioral', 'leadership', 'communication', 'general'];
    const finalCategory = validCategories.includes(category) ? category : 'technical';

    const result = await query(`
      INSERT INTO performance_criteria (name, description, category, weight, max_score, status, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name.trim(), description ? description.trim() : null, finalCategory, numericWeight, numericMaxScore, status || 'active', finalOrder]);

    const criterionId = result.insertId;
    await recordAuditLog(req.user.id, 'CREATE_PERFORMANCE_CRITERION', 'performance_criteria', criterionId, null, req.body, req);

    res.status(201).json({
      success: true,
      message: 'Evaluation criterion created successfully.',
      data: { id: criterionId, name: name.trim(), weight: numericWeight, max_score: numericMaxScore }
    });
  } catch (error) {
    console.error('createCriterion error:', error);
    res.status(500).json({ success: false, message: 'Failed to create performance criterion.' });
  }
};

/**
 * Update an existing evaluation criterion (Gate 2)
 */
export const updateCriterion = async (req, res) => {
  try {
    const criterionId = parseInt(req.params.id, 10);
    const { name, description, category, weight, maxScore, status, orderIndex } = req.body;

    const [existing] = await query('SELECT * FROM performance_criteria WHERE id = ?', [criterionId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Criterion not found.' });
    }

    let numericWeight = existing.weight;
    if (weight !== undefined) {
      numericWeight = parseFloat(weight);
      if (isNaN(numericWeight) || numericWeight <= 0 || numericWeight > 100) {
        return res.status(400).json({ success: false, message: 'Criterion weight must be a percentage between 1 and 100.' });
      }
    }

    let numericMaxScore = existing.max_score;
    if (maxScore !== undefined) {
      numericMaxScore = parseFloat(maxScore);
      if (isNaN(numericMaxScore) || numericMaxScore <= 0) {
        return res.status(400).json({ success: false, message: 'Maximum score must be greater than 0.' });
      }
    }

    await query(`
      UPDATE performance_criteria
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          category = COALESCE(?, category),
          weight = ?,
          max_score = ?,
          status = COALESCE(?, status),
          order_index = COALESCE(?, order_index)
      WHERE id = ?
    `, [
      name ? name.trim() : null,
      description !== undefined ? description : null,
      category || null,
      numericWeight,
      numericMaxScore,
      status || null,
      orderIndex || null,
      criterionId
    ]);

    await recordAuditLog(req.user.id, 'UPDATE_PERFORMANCE_CRITERION', 'performance_criteria', criterionId, existing, req.body, req);

    res.json({ success: true, message: 'Criterion updated successfully.' });
  } catch (error) {
    console.error('updateCriterion error:', error);
    res.status(500).json({ success: false, message: 'Failed to update criterion.' });
  }
};

/**
 * Soft activate/deactivate criterion
 */
export const toggleCriterionStatus = async (req, res) => {
  try {
    const criterionId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM performance_criteria WHERE id = ?', [criterionId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Criterion not found.' });
    }

    const newStatus = existing.status === 'active' ? 'inactive' : 'active';
    await query('UPDATE performance_criteria SET status = ? WHERE id = ?', [newStatus, criterionId]);

    await recordAuditLog(req.user.id, 'TOGGLE_PERFORMANCE_CRITERION_STATUS', 'performance_criteria', criterionId, { status: existing.status }, { status: newStatus }, req);

    res.json({ success: true, message: `Criterion status set to '${newStatus}'.`, data: { id: criterionId, status: newStatus } });
  } catch (error) {
    console.error('toggleCriterionStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle criterion status.' });
  }
};

/**
 * Reorder performance criteria
 */
export const reorderCriteria = async (req, res) => {
  try {
    const { items } = req.body; // array of { id, order_index }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items array with order indices required.' });
    }

    for (const item of items) {
      await query('UPDATE performance_criteria SET order_index = ? WHERE id = ?', [item.order_index, item.id]);
    }

    await recordAuditLog(req.user.id, 'REORDER_PERFORMANCE_CRITERIA', 'performance_criteria', null, null, { items }, req);

    res.json({ success: true, message: 'Criteria reordered successfully.' });
  } catch (error) {
    console.error('reorderCriteria error:', error);
    res.status(500).json({ success: false, message: 'Failed to reorder criteria.' });
  }
};

/**
 * Delete a criterion (Prevent destructive deletion if referenced by historical evaluations)
 */
export const deleteCriterion = async (req, res) => {
  try {
    const criterionId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM performance_criteria WHERE id = ?', [criterionId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Criterion not found.' });
    }

    // Check usage in evaluation_scores
    const [usage] = await query('SELECT COUNT(*) as count FROM evaluation_scores WHERE criterion_id = ?', [criterionId]);
    if (usage.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Referential Integrity Guard: Cannot destructively delete criterion '${existing.name}' because it is referenced in ${usage.count} historical evaluation score(s). Deactivate it instead.`
      });
    }

    await query('DELETE FROM performance_criteria WHERE id = ?', [criterionId]);
    await recordAuditLog(req.user.id, 'DELETE_PERFORMANCE_CRITERION', 'performance_criteria', criterionId, existing, null, req);

    res.json({ success: true, message: 'Criterion deleted successfully.' });
  } catch (error) {
    console.error('deleteCriterion error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete criterion.' });
  }
};

/**
 * Validate that active criteria weights total 100%
 */
export const validateWeights = async (req, res) => {
  try {
    const [weightStat] = await query(`
      SELECT
        COUNT(*) as active_count,
        COALESCE(SUM(weight), 0) as total_weight
      FROM performance_criteria
      WHERE status = 'active'
    `);

    const totalWeight = parseFloat(weightStat.total_weight || 0);
    const isBalanced = Math.abs(totalWeight - 100.00) < 0.01;

    res.json({
      success: true,
      data: {
        activeCount: parseInt(weightStat.active_count, 10),
        totalWeight,
        isBalanced,
        difference: Math.round((100.00 - totalWeight) * 100) / 100
      }
    });
  } catch (error) {
    console.error('validateWeights error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate weights.' });
  }
};


// ============================================================================
// GATE 7: PERFORMANCE RATING BANDS
// ============================================================================

/**
 * Retrieve performance rating outcome bands
 */
export const getRatingBands = async (req, res) => {
  try {
    const bands = await query(`
      SELECT * FROM performance_rating_bands
      ORDER BY min_score DESC, order_index ASC
    `);
    res.json({
      success: true,
      data: bands.map(b => ({
        ...b,
        min_score: parseFloat(b.min_score),
        max_score: parseFloat(b.max_score)
      }))
    });
  } catch (error) {
    console.error('getRatingBands error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve performance rating bands.' });
  }
};

/**
 * Create or update rating bands
 */
export const updateRatingBand = async (req, res) => {
  try {
    const bandId = parseInt(req.params.id, 10);
    const { name, minScore, maxScore, color, description } = req.body;

    const [existing] = await query('SELECT * FROM performance_rating_bands WHERE id = ?', [bandId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Rating band not found.' });
    }

    await query(`
      UPDATE performance_rating_bands
      SET name = COALESCE(?, name),
          min_score = COALESCE(?, min_score),
          max_score = COALESCE(?, max_score),
          color = COALESCE(?, color),
          description = COALESCE(?, description)
      WHERE id = ?
    `, [name ? name.trim() : null, minScore, maxScore, color, description, bandId]);

    await recordAuditLog(req.user.id, 'UPDATE_PERFORMANCE_RATING_BAND', 'performance_rating_bands', bandId, existing, req.body, req);

    res.json({ success: true, message: 'Rating band updated successfully.' });
  } catch (error) {
    console.error('updateRatingBand error:', error);
    res.status(500).json({ success: false, message: 'Failed to update rating band.' });
  }
};


// ============================================================================
// GATE 4: EVALUATION CREATION & ASSIGNMENT ENGINE
// ============================================================================

/**
 * Assign a performance evaluation to an individual intern or whole cohort
 */
export const assignEvaluation = async (req, res) => {
  try {
    const { internId, cohortId, periodId, reviewerId } = req.body;

    if (!periodId) {
      return res.status(400).json({ success: false, message: 'Period ID is required.' });
    }
    if (!internId && !cohortId) {
      return res.status(400).json({ success: false, message: 'You must specify either an internId or a cohortId.' });
    }
    if (internId && cohortId) {
      return res.status(400).json({ success: false, message: 'Specify either internId OR cohortId, not both.' });
    }

    // Verify period is active
    const [period] = await query('SELECT * FROM performance_periods WHERE id = ?', [periodId]);
    if (!period) {
      return res.status(404).json({ success: false, message: 'Performance period not found.' });
    }
    if (period.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Evaluation Assignment Rejected: Performance period is '${period.status}'. New evaluations can only be assigned to 'active' periods.`
      });
    }

    // Verify reviewer exists
    const targetReviewerId = reviewerId || req.user.id;
    const [reviewerUser] = await query('SELECT id, role_id, first_name, last_name FROM users WHERE id = ?', [targetReviewerId]);
    if (!reviewerUser) {
      return res.status(404).json({ success: false, message: 'Designated reviewer user not found.' });
    }

    // Fetch active criteria to initialize evaluation scores
    const activeCriteria = await query(`
      SELECT id, weight, max_score FROM performance_criteria
      WHERE status = 'active' ORDER BY order_index ASC
    `);

    if (activeCriteria.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Configuration Error: No active evaluation criteria found. Please configure criteria before assigning evaluations.'
      });
    }

    // CASE A: Assigning to individual intern
    if (internId) {
      const [intern] = await query('SELECT * FROM intern_profiles WHERE id = ?', [internId]);
      if (!intern) {
        return res.status(404).json({ success: false, message: 'Intern profile not found.' });
      }

      // Mentor scoping (Rule 8): Mentor can only evaluate interns they supervise
      if (req.user.role === 'mentor') {
        const [cohort] = await query('SELECT lead_mentor_id FROM cohorts WHERE id = ?', [intern.cohort_id]);
        const isDirect = intern.mentor_id === req.user.mentorId;
        const isLead = cohort?.lead_mentor_id === req.user.mentorId;
        if (!isDirect && !isLead) {
          return res.status(403).json({
            success: false,
            message: 'Security Alert: You are not authorized to evaluate an intern outside your supervision.'
          });
        }
      }

      // Rule 5: Duplicate active evaluation prevention
      const [existingEval] = await query(`
        SELECT id, status FROM performance_evaluations
        WHERE intern_id = ? AND period_id = ?
      `, [internId, periodId]);

      if (existingEval) {
        return res.status(400).json({
          success: false,
          message: `Duplicate Evaluation Rejected: Intern already has an evaluation for this period with status '${existingEval.status}'.`
        });
      }

      const evalInsert = await query(`
        INSERT INTO performance_evaluations
        (intern_id, period_id, reviewer_id, evaluator_id, cohort_id, track_id, evaluation_period, status, is_locked)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0)
      `, [internId, periodId, targetReviewerId, targetReviewerId, intern.cohort_id, intern.track_id, period.name]);

      const evalId = evalInsert.insertId;

      // Initialize child evaluation scores
      for (const crit of activeCriteria) {
        await query(`
          INSERT INTO evaluation_scores (evaluation_id, criterion_id, score, max_score, weight, weighted_score)
          VALUES (?, ?, 0, ?, ?, 0)
        `, [evalId, crit.id, crit.max_score, crit.weight]);
      }

      await recordAuditLog(req.user.id, 'ASSIGN_PERFORMANCE_EVALUATION', 'performance_evaluations', evalId, null, { internId, periodId, reviewerId: targetReviewerId }, req);

      return res.status(201).json({
        success: true,
        message: `Performance evaluation initiated for intern (${intern.intern_code}).`,
        data: { id: evalId, internId, periodId, status: 'draft' }
      });
    }

    // CASE B: Assigning to entire cohort
    if (cohortId) {
      const [cohort] = await query('SELECT * FROM cohorts WHERE id = ?', [cohortId]);
      if (!cohort) {
        return res.status(404).json({ success: false, message: 'Cohort not found.' });
      }

      if (req.user.role === 'mentor' && cohort.lead_mentor_id !== req.user.mentorId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not the lead mentor for this cohort.'
        });
      }

      const interns = await query(`
        SELECT id, intern_code, track_id, mentor_id FROM intern_profiles
        WHERE cohort_id = ? AND status = 'active'
      `, [cohortId]);

      if (interns.length === 0) {
        return res.status(400).json({ success: false, message: 'No active interns found in this cohort.' });
      }

      let createdCount = 0;
      let skippedCount = 0;

      for (const intern of interns) {
        const [existing] = await query(`
          SELECT id FROM performance_evaluations
          WHERE intern_id = ? AND period_id = ?
        `, [intern.id, periodId]);

        if (existing) {
          skippedCount++;
        } else {
          const evalInsert = await query(`
            INSERT INTO performance_evaluations
            (intern_id, period_id, reviewer_id, evaluator_id, cohort_id, track_id, evaluation_period, status, is_locked)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 0)
          `, [intern.id, periodId, targetReviewerId, targetReviewerId, cohortId, intern.track_id, period.name]);

          const evalId = evalInsert.insertId;

          for (const crit of activeCriteria) {
            await query(`
              INSERT INTO evaluation_scores (evaluation_id, criterion_id, score, max_score, weight, weighted_score)
              VALUES (?, ?, 0, ?, ?, 0)
            `, [evalId, crit.id, crit.max_score, crit.weight]);
          }

          createdCount++;
        }
      }

      await recordAuditLog(req.user.id, 'ASSIGN_COHORT_PERFORMANCE_EVALUATIONS', 'cohorts', cohortId, null, { cohortId, periodId, createdCount, skippedCount }, req);

      return res.status(201).json({
        success: true,
        message: `Cohort evaluation assignment complete: ${createdCount} initiated, ${skippedCount} existing skipped.`,
        data: { cohortId, periodId, createdCount, skippedCount }
      });
    }
  } catch (error) {
    console.error('assignEvaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign evaluation.' });
  }
};


// ============================================================================
// GATE 5, 6, 8, 13: EVALUATION WORKSPACE, CALCULATION ENGINE & WORKFLOW
// ============================================================================

/**
 * Retrieve supporting operational metrics for an intern without contaminating performance score (Gate 13)
 */
async function getSupportingContext(internId) {
  try {
    // 1. Attendance stats (Phase 1)
    const [att] = await query(`
      SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days
      FROM attendance
      WHERE intern_id = ?
    `, [internId]);

    const totalDays = parseInt(att?.total_days || 0, 10);
    const presentDays = parseInt(att?.present_days || 0, 10);
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 100;

    // 2. Tasks stats (Phase 3)
    const [taskStats] = await query(`
      SELECT
        COUNT(*) as total_assigned_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned_tasks,
        SUM(CASE WHEN due_date < NOW() AND status IN ('assigned', 'in_progress', 'returned') THEN 1 ELSE 0 END) as overdue_tasks
      FROM task_assignments
      WHERE intern_id = ?
    `, [internId]);

    // Average task score
    const [taskScore] = await query(`
      SELECT AVG(score) as avg_score
      FROM task_submissions
      WHERE intern_id = ? AND score IS NOT NULL
    `, [internId]);

    // 3. Completed training modules count
    const [moduleStats] = await query(`
      SELECT COUNT(DISTINCT t.module_id) as completed_modules
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.intern_id = ? AND ta.status = 'completed' AND t.module_id IS NOT NULL
    `, [internId]);

    return {
      attendance: {
        totalDays,
        presentDays,
        attendanceRate: `${attendanceRate}%`,
        lateDays: parseInt(att?.late_days || 0, 10),
        absentDays: parseInt(att?.absent_days || 0, 10)
      },
      tasks: {
        totalAssigned: parseInt(taskStats?.total_assigned_tasks || 0, 10),
        completed: parseInt(taskStats?.completed_tasks || 0, 10),
        overdue: parseInt(taskStats?.overdue_tasks || 0, 10),
        averageScore: taskScore?.avg_score !== null ? `${Math.round(parseFloat(taskScore.avg_score) * 10) / 10} pts` : 'N/A'
      },
      curriculum: {
        completedModules: parseInt(moduleStats?.completed_modules || 0, 10)
      },
      disclaimer: 'Notice: Operational attendance and task completion metrics are provided as read-only background context. Performance scores are independently derived from evaluator criteria scores.'
    };
  } catch (err) {
    console.error('getSupportingContext error:', err);
    return null;
  }
}

/**
 * List evaluations with status, search, and scoping
 */
export const getEvaluations = async (req, res) => {
  try {
    const { periodId, cohortId, trackId, internId, status, search } = req.query;
    let conditions = [];
    let params = [];

    // Mentor scoping (Rule 8): Mentors only see interns they supervise
    if (req.user.role === 'mentor') {
      conditions.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      params.push(req.user.mentorId, req.user.mentorId);
    } else if (req.user.role === 'intern') {
      conditions.push('pe.intern_id = ?');
      params.push(req.user.internProfileId);
    }

    if (periodId) {
      conditions.push('pe.period_id = ?');
      params.push(periodId);
    }
    if (cohortId) {
      conditions.push('pe.cohort_id = ?');
      params.push(cohortId);
    }
    if (trackId) {
      conditions.push('pe.track_id = ?');
      params.push(trackId);
    }
    if (internId) {
      conditions.push('pe.intern_id = ?');
      params.push(internId);
    }
    if (status && status !== 'all') {
      conditions.push('pe.status = ?');
      params.push(status);
    }
    if (search && search.trim()) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR ip.intern_code LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const evaluations = await query(`
      SELECT pe.*,
             ip.intern_code,
             u.first_name as intern_first, u.last_name as intern_last, u.email as intern_email,
             tr.name as track_name,
             c.name as cohort_name,
             pp.name as period_name, pp.status as period_status,
             ru.first_name as reviewer_first, ru.last_name as reviewer_last
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON pe.track_id = tr.id
      JOIN cohorts c ON pe.cohort_id = c.id
      JOIN users ru ON pe.reviewer_id = ru.id
      LEFT JOIN performance_periods pp ON pe.period_id = pp.id
      ${whereClause}
      ORDER BY pe.updated_at DESC, pe.id DESC
    `, params);

    res.json({
      success: true,
      data: evaluations.map(ev => ({
        ...ev,
        overall_score: ev.overall_score !== null ? parseFloat(ev.overall_score) : null,
        is_locked: Boolean(ev.is_locked)
      }))
    });
  } catch (error) {
    console.error('getEvaluations error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve performance evaluations.' });
  }
};

/**
 * Get detailed evaluation workspace data (Gate 5)
 */
export const getEvaluationById = async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);

    const [ev] = await query(`
      SELECT pe.*,
             ip.intern_code, ip.mentor_id as assigned_mentor_id,
             u.first_name as intern_first, u.last_name as intern_last, u.email as intern_email,
             tr.name as track_name,
             c.name as cohort_name, c.lead_mentor_id,
             pp.name as period_name, pp.start_date as period_start, pp.end_date as period_end, pp.status as period_status,
             ru.first_name as reviewer_first, ru.last_name as reviewer_last,
             fu.first_name as finalized_first, fu.last_name as finalized_last
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON pe.track_id = tr.id
      JOIN cohorts c ON pe.cohort_id = c.id
      JOIN users ru ON pe.reviewer_id = ru.id
      LEFT JOIN performance_periods pp ON pe.period_id = pp.id
      LEFT JOIN users fu ON pe.finalized_by = fu.id
      WHERE pe.id = ?
    `, [evalId]);

    if (!ev) {
      return res.status(404).json({ success: false, message: 'Performance evaluation not found.' });
    }

    // Role & Scoping Checks (Rule 6, 7, 8)
    if (req.user.role === 'mentor') {
      const isDirect = ev.assigned_mentor_id === req.user.mentorId;
      const isLead = ev.lead_mentor_id === req.user.mentorId;
      if (!isDirect && !isLead) {
        return res.status(403).json({
          success: false,
          message: 'Security Alert: You are not authorized to view an evaluation outside your supervision.'
        });
      }
    } else if (req.user.role === 'intern') {
      if (ev.intern_id !== req.user.internProfileId) {
        return res.status(403).json({
          success: false,
          message: 'Security Alert: You cannot access another intern evaluation.'
        });
      }
      if (ev.status !== 'finalized') {
        return res.status(403).json({
          success: false,
          message: 'Evaluation Pending: Your evaluation is currently under review by your mentor and has not yet been finalized.'
        });
      }
    }

    // Retrieve criteria scores
    const scores = await query(`
      SELECT es.*,
             pc.name as criterion_name, pc.description as criterion_description,
             pc.category, pc.order_index
      FROM evaluation_scores es
      JOIN performance_criteria pc ON es.criterion_id = pc.id
      WHERE es.evaluation_id = ?
      ORDER BY pc.order_index ASC, pc.id ASC
    `, [evalId]);

    // Retrieve supporting operational context
    const supportingContext = await getSupportingContext(ev.intern_id);

    res.json({
      success: true,
      data: {
        evaluation: {
          ...ev,
          overall_score: ev.overall_score !== null ? parseFloat(ev.overall_score) : null,
          is_locked: Boolean(ev.is_locked)
        },
        scores: scores.map(s => ({
          ...s,
          score: parseFloat(s.score),
          max_score: parseFloat(s.max_score),
          weight: parseFloat(s.weight),
          weighted_score: parseFloat(s.weighted_score)
        })),
        supportingContext
      }
    });
  } catch (error) {
    console.error('getEvaluationById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve evaluation details.' });
  }
};

/**
 * Update evaluation scores and feedback (Save Draft / Ongoing Scoring) (Gate 5 & 6)
 */
export const updateEvaluation = async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);
    const { scores, strengths, areasForImprovement, reviewerComments, internComments } = req.body;

    const [ev] = await query(`
      SELECT pe.*, ip.mentor_id, c.lead_mentor_id
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN cohorts c ON pe.cohort_id = c.id
      WHERE pe.id = ?
    `, [evalId]);

    if (!ev) {
      return res.status(404).json({ success: false, message: 'Performance evaluation not found.' });
    }

    // Historical Locking Check (Gate 8)
    if (ev.is_locked || ev.status === 'finalized') {
      return res.status(400).json({
        success: false,
        message: 'Lock Protection: This evaluation is finalized and locked. Changes can only be made through the authorized administrator amendment process.'
      });
    }

    // Mentor scoping
    if (req.user.role === 'mentor') {
      const isDirect = ev.mentor_id === req.user.mentorId;
      const isLead = ev.lead_mentor_id === req.user.mentorId;
      if (!isDirect && !isLead) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not supervise this intern.' });
      }
    } else if (req.user.role === 'intern') {
      // Interns cannot edit scores or reviewer notes
      return res.status(403).json({ success: false, message: 'Interns cannot update evaluation scores or reviews.' });
    }

    // Process scores array if provided
    let serverTotalWeightedScore = 0;

    if (Array.isArray(scores) && scores.length > 0) {
      for (const item of scores) {
        const criterionId = parseInt(item.criterionId || item.criterion_id, 10);
        const scoreVal = parseFloat(item.score);

        const [crit] = await query('SELECT * FROM performance_criteria WHERE id = ?', [criterionId]);
        if (!crit) {
          return res.status(400).json({ success: false, message: `Criterion ID ${criterionId} not found.` });
        }

        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > parseFloat(crit.max_score)) {
          return res.status(400).json({
            success: false,
            message: `Invalid Score for '${crit.name}': Score must be between 0 and ${crit.max_score}.`
          });
        }

        // Calculation Engine (Gate 6): (score / max_score) * weight
        const weightedScore = (scoreVal / parseFloat(crit.max_score)) * parseFloat(crit.weight);
        serverTotalWeightedScore += weightedScore;

        // Upsert score
        const [existingScore] = await query(`
          SELECT id FROM evaluation_scores WHERE evaluation_id = ? AND criterion_id = ?
        `, [evalId, criterionId]);

        if (existingScore) {
          await query(`
            UPDATE evaluation_scores
            SET score = ?,
                max_score = ?,
                weight = ?,
                weighted_score = ?,
                comments = ?
            WHERE id = ?
          `, [scoreVal, crit.max_score, crit.weight, weightedScore, item.comments || null, existingScore.id]);
        } else {
          await query(`
            INSERT INTO evaluation_scores (evaluation_id, criterion_id, score, max_score, weight, weighted_score, comments)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [evalId, criterionId, scoreVal, crit.max_score, crit.weight, weightedScore, item.comments || null]);
        }
      }
    } else {
      // Recalculate from existing scores table
      const [sumRow] = await query(`
        SELECT SUM(weighted_score) as total_calc FROM evaluation_scores WHERE evaluation_id = ?
      `, [evalId]);
      serverTotalWeightedScore = parseFloat(sumRow?.total_calc || 0);
    }

    const roundedOverall = Math.round(serverTotalWeightedScore * 100) / 100;

    await query(`
      UPDATE performance_evaluations
      SET overall_score = ?,
          strengths = COALESCE(?, strengths),
          areas_for_improvement = COALESCE(?, areas_for_improvement),
          reviewer_comments = COALESCE(?, reviewer_comments),
          summary_feedback = COALESCE(?, summary_feedback)
      WHERE id = ?
    `, [
      roundedOverall,
      strengths !== undefined ? strengths : null,
      areasForImprovement !== undefined ? areasForImprovement : null,
      reviewerComments !== undefined ? reviewerComments : null,
      reviewerComments || strengths || null,
      evalId
    ]);

    await recordAuditLog(req.user.id, 'UPDATE_PERFORMANCE_EVALUATION', 'performance_evaluations', evalId, ev, { overallScore: roundedOverall }, req);

    res.json({
      success: true,
      message: 'Evaluation saved successfully.',
      data: {
        id: evalId,
        overallScore: roundedOverall,
        status: ev.status
      }
    });
  } catch (error) {
    console.error('updateEvaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to update evaluation.' });
  }
};

/**
 * Submit evaluation for review (Gate 8: draft -> submitted)
 */
export const submitEvaluation = async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);

    const [ev] = await query(`
      SELECT pe.*, ip.mentor_id, c.lead_mentor_id
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN cohorts c ON pe.cohort_id = c.id
      WHERE pe.id = ?
    `, [evalId]);

    if (!ev) {
      return res.status(404).json({ success: false, message: 'Performance evaluation not found.' });
    }

    if (ev.is_locked || ev.status === 'finalized') {
      return res.status(400).json({ success: false, message: 'Evaluation is already finalized and locked.' });
    }

    if (req.user.role === 'mentor') {
      const isDirect = ev.mentor_id === req.user.mentorId;
      const isLead = ev.lead_mentor_id === req.user.mentorId;
      if (!isDirect && !isLead) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not supervise this intern.' });
      }
    } else if (req.user.role === 'intern') {
      return res.status(403).json({ success: false, message: 'Interns cannot submit performance evaluations.' });
    }

    await query(`
      UPDATE performance_evaluations
      SET status = 'submitted', submitted_at = NOW()
      WHERE id = ?
    `, [evalId]);

    await recordAuditLog(req.user.id, 'SUBMIT_PERFORMANCE_EVALUATION', 'performance_evaluations', evalId, { status: ev.status }, { status: 'submitted' }, req);

    res.json({ success: true, message: 'Evaluation submitted for review.', data: { id: evalId, status: 'submitted' } });
  } catch (error) {
    console.error('submitEvaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit evaluation.' });
  }
};

/**
 * Finalize evaluation: Server-Authoritative Recalculation, Rating Band Resolution & Locking (Gates 6, 7, 8)
 */
export const finalizeEvaluation = async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);

    const [ev] = await query(`
      SELECT pe.*, ip.mentor_id, c.lead_mentor_id
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN cohorts c ON pe.cohort_id = c.id
      WHERE pe.id = ?
    `, [evalId]);

    if (!ev) {
      return res.status(404).json({ success: false, message: 'Performance evaluation not found.' });
    }

    if (ev.is_locked) {
      return res.status(400).json({ success: false, message: 'Evaluation is already finalized and locked.' });
    }

    // Role check: Only admin or authorized supervising mentors can finalize evaluations
    if (req.user.role === 'mentor') {
      const isDirect = ev.mentor_id === req.user.mentorId;
      const isLead = ev.lead_mentor_id === req.user.mentorId;
      if (!isDirect && !isLead) {
        return res.status(403).json({ success: false, message: 'Forbidden: You do not supervise this intern.' });
      }
    } else if (req.user.role === 'intern') {
      return res.status(403).json({ success: false, message: 'Interns cannot finalize performance evaluations.' });
    }

    // 1. Recalculate authoritative overall score strictly server-side (Gate 6)
    const scores = await query(`
      SELECT es.*, pc.weight as crit_weight, pc.max_score as crit_max
      FROM evaluation_scores es
      JOIN performance_criteria pc ON es.criterion_id = pc.id
      WHERE es.evaluation_id = ?
    `, [evalId]);

    if (scores.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot finalize evaluation with 0 criteria scores.' });
    }

    let calculatedOverall = 0;
    for (const s of scores) {
      const score = parseFloat(s.score);
      const maxScore = parseFloat(s.max_score || s.crit_max || 100);
      const weight = parseFloat(s.weight || s.crit_weight || 10);
      const weighted = (score / maxScore) * weight;
      calculatedOverall += weighted;
    }

    const finalOverallScore = Math.round(calculatedOverall * 100) / 100;

    // 2. Resolve rating band (Gate 7)
    const bands = await query('SELECT * FROM performance_rating_bands WHERE status = "active" ORDER BY min_score DESC');
    let finalRating = 'Meets Expectations';

    for (const b of bands) {
      if (finalOverallScore >= parseFloat(b.min_score) && finalOverallScore <= parseFloat(b.max_score) + 0.01) {
        finalRating = b.name;
        break;
      }
    }

    // 3. Finalize and Lock (Gate 8)
    await query(`
      UPDATE performance_evaluations
      SET status = 'finalized',
          overall_score = ?,
          overall_rating = ?,
          is_locked = 1,
          finalized_at = NOW(),
          finalized_by = ?
      WHERE id = ?
    `, [finalOverallScore, finalRating, req.user.id, evalId]);

    await recordAuditLog(
      req.user.id,
      'FINALIZE_PERFORMANCE_EVALUATION',
      'performance_evaluations',
      evalId,
      { status: ev.status },
      { status: 'finalized', overallScore: finalOverallScore, overallRating: finalRating, isLocked: 1 },
      req
    );

    res.json({
      success: true,
      message: `Evaluation finalized successfully. Overall Result: ${finalOverallScore}% (${finalRating}). Record is now locked.`,
      data: {
        id: evalId,
        status: 'finalized',
        overallScore: finalOverallScore,
        overallRating: finalRating,
        isLocked: true
      }
    });
  } catch (error) {
    console.error('finalizeEvaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to finalize evaluation.' });
  }
};

/**
 * Reopen/Amend finalized evaluation (Gate 8: Controlled Administrative Amendment)
 */
export const amendEvaluation = async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);
    const { amendmentReason } = req.body;

    if (!amendmentReason || amendmentReason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory, detailed justification (minimum 10 characters) is required to amend or reopen a finalized evaluation.'
      });
    }

    const [ev] = await query('SELECT * FROM performance_evaluations WHERE id = ?', [evalId]);
    if (!ev) {
      return res.status(404).json({ success: false, message: 'Performance evaluation not found.' });
    }

    // Unlock evaluation
    await query(`
      UPDATE performance_evaluations
      SET is_locked = 0,
          status = 'draft',
          amendment_reason = ?,
          amended_by = ?,
          amended_at = NOW()
      WHERE id = ?
    `, [amendmentReason.trim(), req.user.id, evalId]);

    await recordAuditLog(
      req.user.id,
      'AMEND_PERFORMANCE_EVALUATION',
      'performance_evaluations',
      evalId,
      { is_locked: ev.is_locked, status: ev.status },
      { is_locked: 0, status: 'draft', amendmentReason: amendmentReason.trim() },
      req
    );

    res.json({
      success: true,
      message: 'Evaluation unlocked for amendment. Actions have been logged in the audit registry.',
      data: { id: evalId, status: 'draft', isLocked: false }
    });
  } catch (error) {
    console.error('amendEvaluation error:', error);
    res.status(500).json({ success: false, message: 'Failed to reopen evaluation.' });
  }
};


// ============================================================================
// GATE 9: INTERN PERFORMANCE WORKSPACE (Strict Profile Isolation)
// ============================================================================

/**
 * Intern accesses their own finalized performance evaluations and skill radar
 */
export const getMyPerformance = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    const { periodId } = req.query;
    let periodCondition = '';
    let params = [internProfileId];

    if (periodId) {
      periodCondition = 'AND pe.period_id = ?';
      params.push(periodId);
    }

    // Only finalized evaluations are visible to interns
    const evaluations = await query(`
      SELECT pe.*,
             pp.name as period_name, pp.start_date as period_start, pp.end_date as period_end,
             u.first_name as reviewer_first, u.last_name as reviewer_last
      FROM performance_evaluations pe
      LEFT JOIN performance_periods pp ON pe.period_id = pp.id
      JOIN users u ON pe.reviewer_id = u.id
      WHERE pe.intern_id = ? AND pe.status = 'finalized' ${periodCondition}
      ORDER BY pe.finalized_at DESC, pe.id DESC
    `, params);

    // Default to latest finalized evaluation
    const latest = evaluations[0] || null;

    let scores = [];
    let radarData = [];

    if (latest) {
      scores = await query(`
        SELECT es.*, pc.name as criterion_name, pc.category, pc.order_index
        FROM evaluation_scores es
        JOIN performance_criteria pc ON es.criterion_id = pc.id
        WHERE es.evaluation_id = ?
        ORDER BY pc.order_index ASC, pc.id ASC
      `, [latest.id]);

      radarData = scores.map(s => {
        const scoreNum = parseFloat(s.score);
        const maxNum = parseFloat(s.max_score);
        const pct = maxNum > 0 ? Math.round((scoreNum / maxNum) * 100) : 0;
        return {
          category: s.criterion_name,
          score: pct,
          rawScore: scoreNum,
          maxScore: maxNum,
          weight: parseFloat(s.weight)
        };
      });
    }

    // List of all completed evaluation periods for historical timeline selector
    const periods = await query(`
      SELECT DISTINCT pp.id, pp.name, pp.start_date, pp.end_date, pe.overall_score, pe.overall_rating
      FROM performance_evaluations pe
      JOIN performance_periods pp ON pe.period_id = pp.id
      WHERE pe.intern_id = ? AND pe.status = 'finalized'
      ORDER BY pp.start_date DESC
    `, [internProfileId]);

    // Read-only supporting context (Gate 13)
    const supportingContext = await getSupportingContext(internProfileId);

    res.json({
      success: true,
      data: {
        evaluations: evaluations.map(e => ({
          ...e,
          overall_score: parseFloat(e.overall_score)
        })),
        latest: latest ? {
          ...latest,
          overall_score: parseFloat(latest.overall_score)
        } : null,
        scores: scores.map(s => ({
          ...s,
          score: parseFloat(s.score),
          max_score: parseFloat(s.max_score),
          weight: parseFloat(s.weight),
          weighted_score: parseFloat(s.weighted_score)
        })),
        radarData,
        periods,
        supportingContext
      }
    });
  } catch (error) {
    console.error('getMyPerformance error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve performance data.' });
  }
};


// ============================================================================
// GATE 10: MENTOR PERFORMANCE WORKSPACE
// ============================================================================

/**
 * Mentor workspace for supervised cohort performance evaluations
 */
export const getMentorPerformanceWorkspace = async (req, res) => {
  try {
    const mentorId = req.user.mentorId;
    if (!mentorId && req.user.role === 'mentor') {
      return res.status(403).json({ success: false, message: 'Mentor profile not found.' });
    }

    // Supervised interns count and evaluations
    const mentorFilter = req.user.role === 'mentor'
      ? '(ip.mentor_id = ? OR c.lead_mentor_id = ?)'
      : '1=1';
    const params = req.user.role === 'mentor' ? [mentorId, mentorId] : [];

    const evaluations = await query(`
      SELECT pe.*,
             ip.intern_code,
             u.first_name as intern_first, u.last_name as intern_last,
             tr.name as track_name,
             c.name as cohort_name,
             pp.name as period_name,
             ru.first_name as reviewer_first, ru.last_name as reviewer_last
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON pe.track_id = tr.id
      JOIN cohorts c ON pe.cohort_id = c.id
      JOIN users ru ON pe.reviewer_id = ru.id
      LEFT JOIN performance_periods pp ON pe.period_id = pp.id
      WHERE ${mentorFilter}
      ORDER BY pe.updated_at DESC
      LIMIT 100
    `, params);

    const [stats] = await query(`
      SELECT
        COUNT(*) as total_evaluations,
        SUM(CASE WHEN pe.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN pe.status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN pe.status = 'finalized' THEN 1 ELSE 0 END) as finalized_count,
        AVG(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as avg_score
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN cohorts c ON pe.cohort_id = c.id
      WHERE ${mentorFilter}
    `, params);

    res.json({
      success: true,
      data: {
        evaluations: evaluations.map(e => ({
          ...e,
          overall_score: e.overall_score !== null ? parseFloat(e.overall_score) : null,
          is_locked: Boolean(e.is_locked)
        })),
        stats: {
          total: parseInt(stats?.total_evaluations || 0, 10),
          draft: parseInt(stats?.draft_count || 0, 10),
          submitted: parseInt(stats?.submitted_count || 0, 10),
          finalized: parseInt(stats?.finalized_count || 0, 10),
          averageScore: stats?.avg_score !== null ? Math.round(parseFloat(stats.avg_score) * 10) / 10 : null
        }
      }
    });
  } catch (error) {
    console.error('getMentorPerformanceWorkspace error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve mentor performance workspace.' });
  }
};


// ============================================================================
// GATE 11: ADMIN PERFORMANCE OVERVIEW & OPERATIONS DASHBOARD
// ============================================================================

/**
 * Enterprise Performance Overview Dashboard with KPIs, Distribution, and Track Breakdown
 */
export const getAdminPerformanceOverview = async (req, res) => {
  try {
    const { periodId } = req.query;
    let periodCondition = '';
    let params = [];

    if (periodId) {
      periodCondition = 'WHERE pe.period_id = ?';
      params.push(periodId);
    }

    // 1. Operational KPIs
    const [kpi] = await query(`
      SELECT
        COUNT(*) as total_evaluations,
        SUM(CASE WHEN pe.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN pe.status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN pe.status = 'finalized' THEN 1 ELSE 0 END) as finalized_count,
        AVG(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as avg_score,
        MAX(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as max_score,
        MIN(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as min_score
      FROM performance_evaluations pe
      ${periodCondition}
    `, params);

    // Active performance periods count
    const [activePeriodRow] = await query(`
      SELECT id, name, start_date, end_date FROM performance_periods WHERE status = 'active' LIMIT 1
    `);

    // Total active interns for completion rate calculation
    const [internCountRow] = await query(`SELECT COUNT(*) as active_interns FROM intern_profiles WHERE status = 'active'`);
    const activeInterns = parseInt(internCountRow?.active_interns || 1, 10);
    const finalizedCount = parseInt(kpi?.finalized_count || 0, 10);
    const completionRate = activeInterns > 0 ? Math.min(100, Math.round((finalizedCount / activeInterns) * 100)) : 0;

    // 2. Rating Band Distribution
    const ratingDistribution = await query(`
      SELECT
        COALESCE(pe.overall_rating, 'Unassigned') as rating_band,
        COUNT(*) as count,
        AVG(pe.overall_score) as avg_band_score
      FROM performance_evaluations pe
      WHERE pe.status = 'finalized' ${periodId ? 'AND pe.period_id = ?' : ''}
      GROUP BY pe.overall_rating
      ORDER BY count DESC
    `, periodId ? [periodId] : []);

    // 3. Execution breakdown by track
    const trackBreakdown = await query(`
      SELECT
        tr.id as track_id, tr.name as track_name,
        COUNT(DISTINCT ip.id) as total_interns,
        COUNT(DISTINCT pe.id) as total_evaluations,
        SUM(CASE WHEN pe.status = 'finalized' THEN 1 ELSE 0 END) as finalized_evaluations,
        AVG(CASE WHEN pe.status = 'finalized' THEN pe.overall_score ELSE NULL END) as avg_score
      FROM tracks tr
      LEFT JOIN intern_profiles ip ON tr.id = ip.track_id AND ip.status = 'active'
      LEFT JOIN performance_evaluations pe ON ip.id = pe.intern_id ${periodId ? 'AND pe.period_id = ?' : ''}
      GROUP BY tr.id
      ORDER BY tr.id ASC
    `, periodId ? [periodId] : []);

    // 4. Recent evaluations list
    const recentEvaluations = await query(`
      SELECT pe.*,
             ip.intern_code,
             u.first_name as intern_first, u.last_name as intern_last,
             tr.name as track_name,
             c.name as cohort_name,
             ru.first_name as reviewer_first, ru.last_name as reviewer_last,
             pp.name as period_name
      FROM performance_evaluations pe
      JOIN intern_profiles ip ON pe.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON pe.track_id = tr.id
      JOIN cohorts c ON pe.cohort_id = c.id
      JOIN users ru ON pe.reviewer_id = ru.id
      LEFT JOIN performance_periods pp ON pe.period_id = pp.id
      ${periodCondition}
      ORDER BY pe.updated_at DESC
      LIMIT 25
    `, params);

    res.json({
      success: true,
      data: {
        stats: {
          total: parseInt(kpi?.total_evaluations || 0, 10),
          draft: parseInt(kpi?.draft_count || 0, 10),
          submitted: parseInt(kpi?.submitted_count || 0, 10),
          finalized: finalizedCount,
          average: kpi?.avg_score !== null ? Math.round(parseFloat(kpi.avg_score) * 10) / 10 : null,
          max: kpi?.max_score !== null ? parseFloat(kpi.max_score) : null,
          min: kpi?.min_score !== null ? parseFloat(kpi.min_score) : null,
          completionRate: `${completionRate}%`,
          activePeriod: activePeriodRow || null
        },
        ratingDistribution: ratingDistribution.map(r => ({
          ratingBand: r.rating_band,
          count: parseInt(r.count, 10),
          avgBandScore: r.avg_band_score !== null ? Math.round(parseFloat(r.avg_band_score) * 10) / 10 : null
        })),
        trackBreakdown: trackBreakdown.map(tb => ({
          trackId: tb.track_id,
          trackName: tb.track_name,
          totalInterns: parseInt(tb.total_interns || 0, 10),
          totalEvaluations: parseInt(tb.total_evaluations || 0, 10),
          finalizedEvaluations: parseInt(tb.finalized_evaluations || 0, 10),
          avgScore: tb.avg_score !== null ? Math.round(parseFloat(tb.avg_score) * 10) / 10 : null
        })),
        evaluations: recentEvaluations.map(ev => ({
          ...ev,
          overall_score: ev.overall_score !== null ? parseFloat(ev.overall_score) : null,
          is_locked: Boolean(ev.is_locked)
        }))
      }
    });
  } catch (error) {
    console.error('getAdminPerformanceOverview error:', error);
    res.status(500).json({ success: false, message: 'Failed to load performance overview.' });
  }
};
