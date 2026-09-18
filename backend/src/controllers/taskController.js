import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';

// ============================================================================
// GATE 3: TASK DEFINITION & CATALOG MANAGEMENT
// ============================================================================

/**
 * List all tasks with track, cohort, module, and submission metadata
 */
export const getAllTasks = async (req, res) => {
  try {
    const { trackId, cohortId, moduleId, status, difficulty, taskType, search } = req.query;
    let conditions = [];
    let params = [];

    // Intern scoping: interns only see published tasks for their track
    if (req.user.role === 'intern') {
      conditions.push('t.track_id = ?');
      params.push(req.user.trackId || 0);
      conditions.push("t.status = 'published'");
    } else {
      if (status) {
        conditions.push('t.status = ?');
        params.push(status);
      }
    }

    if (trackId) {
      conditions.push('t.track_id = ?');
      params.push(trackId);
    }
    if (cohortId) {
      conditions.push('(t.cohort_id = ? OR t.cohort_id IS NULL)');
      params.push(cohortId);
    }
    if (moduleId) {
      conditions.push('t.module_id = ?');
      params.push(moduleId);
    }
    if (difficulty) {
      conditions.push('t.difficulty = ?');
      params.push(difficulty);
    }
    if (taskType) {
      conditions.push('t.task_type = ?');
      params.push(taskType);
    }
    if (search && search.trim()) {
      conditions.push('(t.title LIKE ? OR t.description LIKE ? OR t.instructions LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const tasks = await query(`
      SELECT t.*,
             tr.name as track_name, tr.code as track_code,
             c.name as cohort_name, c.cohort_code,
             tm.title as module_title, tm.module_code,
             u.first_name as author_first, u.last_name as author_last,
             (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id = t.id) as assignment_count,
             (SELECT COUNT(*) FROM task_submissions ts WHERE ts.task_id = t.id) as submission_count,
             (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id = t.id AND ta.status = 'completed') as completed_count
      FROM tasks t
      JOIN tracks tr ON t.track_id = tr.id
      LEFT JOIN cohorts c ON t.cohort_id = c.id
      LEFT JOIN training_modules tm ON t.module_id = tm.id
      JOIN users u ON t.assigned_by = u.id
      ${whereClause}
      ORDER BY t.due_date ASC, t.id DESC
    `, params);

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('getAllTasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tasks.' });
  }
};

/**
 * Get single task details
 */
export const getTaskById = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const [task] = await query(`
      SELECT t.*,
             tr.name as track_name, tr.code as track_code,
             c.name as cohort_name, c.cohort_code,
             tm.title as module_title, tm.module_code,
             u.first_name as author_first, u.last_name as author_last,
             (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id = t.id) as assignment_count,
             (SELECT COUNT(*) FROM task_submissions ts WHERE ts.task_id = t.id) as submission_count
      FROM tasks t
      JOIN tracks tr ON t.track_id = tr.id
      LEFT JOIN cohorts c ON t.cohort_id = c.id
      LEFT JOIN training_modules tm ON t.module_id = tm.id
      JOIN users u ON t.assigned_by = u.id
      WHERE t.id = ?
    `, [taskId]);

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    if (req.user.role === 'intern' && task.track_id !== req.user.trackId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot access tasks outside your assigned track.' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('getTaskById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve task details.' });
  }
};

/**
 * Create a new task definition
 */
export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      instructions,
      expectedDeliverable,
      trackId,
      cohortId,
      moduleId,
      taskType = 'assignment',
      difficulty = 'intermediate',
      dueDate,
      dueDays,
      estimatedHours = 8,
      maxScore = 100,
      passScore = 60,
      priority = 'medium',
      status = 'published',
      attachmentUrl
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Task description is required.' });
    }
    if (!trackId) {
      return res.status(400).json({ success: false, message: 'Track ID is required.' });
    }

    // Rule 2 verification: Verify Track exists
    const [track] = await query('SELECT id FROM tracks WHERE id = ?', [trackId]);
    if (!track) {
      return res.status(400).json({ success: false, message: 'Invalid track ID: Track does not exist.' });
    }

    // Rule 1: If moduleId provided, verify module exists and belongs to trackId
    let finalModuleId = moduleId ? parseInt(moduleId, 10) : null;
    if (finalModuleId) {
      const [mod] = await query('SELECT id, track_id FROM training_modules WHERE id = ?', [finalModuleId]);
      if (!mod) {
        return res.status(400).json({ success: false, message: 'Invalid module ID: Module does not exist.' });
      }
      if (mod.track_id !== parseInt(trackId, 10)) {
        return res.status(400).json({
          success: false,
          message: 'Relational Integrity Error: Module belongs to a different track than specified.'
        });
      }
    }

    // Rule 4: If cohortId provided, verify cohort belongs to trackId
    let finalCohortId = cohortId ? parseInt(cohortId, 10) : null;
    if (finalCohortId) {
      const [coh] = await query('SELECT id, track_id FROM cohorts WHERE id = ?', [finalCohortId]);
      if (!coh) {
        return res.status(400).json({ success: false, message: 'Invalid cohort ID: Cohort does not exist.' });
      }
      if (coh.track_id !== parseInt(trackId, 10)) {
        return res.status(400).json({
          success: false,
          message: 'Relational Integrity Error: Cohort belongs to a different track than specified.'
        });
      }
    }

    const maxPts = parseInt(maxScore, 10) || 100;
    const passPts = parseInt(passScore, 10) || 60;
    if (passPts > maxPts) {
      return res.status(400).json({ success: false, message: 'Pass score cannot exceed maximum score.' });
    }

    const finalDueDate = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const result = await query(`
      INSERT INTO tasks (
        title, description, instructions, expected_deliverable, track_id, cohort_id, module_id,
        task_type, difficulty, assigned_by, due_date, due_days, estimated_hours, max_score, pass_score,
        priority, status, attachment_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      description.trim(),
      instructions ? instructions.trim() : null,
      expectedDeliverable ? expectedDeliverable.trim() : null,
      trackId,
      finalCohortId,
      finalModuleId,
      taskType,
      difficulty,
      req.user.id,
      finalDueDate,
      dueDays ? parseInt(dueDays, 10) : null,
      parseInt(estimatedHours, 10) || 8,
      maxPts,
      passPts,
      priority,
      status,
      attachmentUrl || null
    ]);

    const taskId = result.insertId;
    await recordAuditLog(req.user.id, 'CREATE_TASK', 'tasks', taskId, null, { title: title.trim(), trackId, moduleId: finalModuleId }, req);

    res.status(201).json({
      success: true,
      message: `Task '${title.trim()}' created successfully.`,
      data: { id: taskId, title: title.trim(), trackId, moduleId: finalModuleId, status }
    });
  } catch (error) {
    console.error('createTask error:', error);
    res.status(500).json({ success: false, message: 'Failed to create task.' });
  }
};

/**
 * Update an existing task
 */
export const updateTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const {
      title,
      description,
      instructions,
      expectedDeliverable,
      trackId,
      cohortId,
      moduleId,
      taskType,
      difficulty,
      dueDate,
      dueDays,
      estimatedHours,
      maxScore,
      passScore,
      priority,
      status,
      attachmentUrl
    } = req.body;

    const targetTrackId = trackId ? parseInt(trackId, 10) : existing.track_id;

    let targetModuleId = moduleId !== undefined ? (moduleId ? parseInt(moduleId, 10) : null) : existing.module_id;
    if (targetModuleId) {
      const [mod] = await query('SELECT id, track_id FROM training_modules WHERE id = ?', [targetModuleId]);
      if (!mod || mod.track_id !== targetTrackId) {
        return res.status(400).json({ success: false, message: 'Module must belong to the same track as the task.' });
      }
    }

    let targetCohortId = cohortId !== undefined ? (cohortId ? parseInt(cohortId, 10) : null) : existing.cohort_id;
    if (targetCohortId) {
      const [coh] = await query('SELECT id, track_id FROM cohorts WHERE id = ?', [targetCohortId]);
      if (!coh || coh.track_id !== targetTrackId) {
        return res.status(400).json({ success: false, message: 'Cohort must belong to the same track as the task.' });
      }
    }

    await query(`
      UPDATE tasks SET
        title = ?, description = ?, instructions = ?, expected_deliverable = ?, track_id = ?, cohort_id = ?, module_id = ?,
        task_type = ?, difficulty = ?, due_date = ?, due_days = ?, estimated_hours = ?, max_score = ?, pass_score = ?,
        priority = ?, status = ?, attachment_url = ?
      WHERE id = ?
    `, [
      title !== undefined ? title.trim() : existing.title,
      description !== undefined ? description.trim() : existing.description,
      instructions !== undefined ? (instructions ? instructions.trim() : null) : existing.instructions,
      expectedDeliverable !== undefined ? (expectedDeliverable ? expectedDeliverable.trim() : null) : existing.expected_deliverable,
      targetTrackId,
      targetCohortId,
      targetModuleId,
      taskType !== undefined ? taskType : existing.task_type,
      difficulty !== undefined ? difficulty : existing.difficulty,
      dueDate !== undefined ? dueDate : existing.due_date,
      dueDays !== undefined ? (dueDays ? parseInt(dueDays, 10) : null) : existing.due_days,
      estimatedHours !== undefined ? parseInt(estimatedHours, 10) : existing.estimated_hours,
      maxScore !== undefined ? parseInt(maxScore, 10) : existing.max_score,
      passScore !== undefined ? parseInt(passScore, 10) : existing.pass_score,
      priority !== undefined ? priority : existing.priority,
      status !== undefined ? status : existing.status,
      attachmentUrl !== undefined ? attachmentUrl : existing.attachment_url,
      taskId
    ]);

    await recordAuditLog(req.user.id, 'UPDATE_TASK', 'tasks', taskId, existing, req.body, req);

    res.json({
      success: true,
      message: 'Task updated successfully.',
      data: { id: taskId, title: title || existing.title }
    });
  } catch (error) {
    console.error('updateTask error:', error);
    res.status(500).json({ success: false, message: 'Failed to update task.' });
  }
};

/**
 * Toggle or change task publish status
 */
export const toggleTaskStatus = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const [existing] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    let newStatus = status;
    if (!newStatus) {
      newStatus = existing.status === 'published' ? 'archived' : 'published';
    }

    if (!['draft', 'published', 'archived'].includes(newStatus)) {
      return res.status(400).json({ success: false, message: "Status must be 'draft', 'published', or 'archived'." });
    }

    await query('UPDATE tasks SET status = ? WHERE id = ?', [newStatus, taskId]);
    await recordAuditLog(req.user.id, 'TOGGLE_TASK_STATUS', 'tasks', taskId, { status: existing.status }, { status: newStatus }, req);

    res.json({
      success: true,
      message: `Task status changed from '${existing.status}' to '${newStatus}'.`,
      data: { id: taskId, status: newStatus }
    });
  } catch (error) {
    console.error('toggleTaskStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle task status.' });
  }
};

/**
 * Delete a task (prevented if assignments or submissions exist)
 */
export const deleteTask = async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const [assignCount] = await query('SELECT COUNT(*) as count FROM task_assignments WHERE task_id = ?', [taskId]);
    const [subCount] = await query('SELECT COUNT(*) as count FROM task_submissions WHERE task_id = ?', [taskId]);

    if ((assignCount?.count || 0) > 0 || (subCount?.count || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete task '${existing.title}' because it has ${assignCount.count} assignment(s) and ${subCount.count} submission(s). Archive the task instead to preserve execution history.`
      });
    }

    await query('DELETE FROM tasks WHERE id = ?', [taskId]);
    await recordAuditLog(req.user.id, 'DELETE_TASK', 'tasks', taskId, existing, null, req);

    res.json({ success: true, message: `Task '${existing.title}' deleted successfully.` });
  } catch (error) {
    console.error('deleteTask error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task.' });
  }
};


// ============================================================================
// GATE 4: TASK ASSIGNMENT ENGINE
// ============================================================================

/**
 * Assign task to an individual intern or entire cohort
 */
export const assignTask = async (req, res) => {
  try {
    const { taskId, internId, cohortId, dueDate, notes } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required.' });
    }
    if (!internId && !cohortId) {
      return res.status(400).json({
        success: false,
        message: 'Ambiguous Assignment: You must specify either an individual internId or a cohortId.'
      });
    }
    if (internId && cohortId) {
      return res.status(400).json({
        success: false,
        message: 'Ambiguous Assignment: Specify either internId OR cohortId, not both simultaneously.'
      });
    }

    const [task] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const targetDueDate = dueDate || task.due_date;

    // CASE A: Assigning to an individual intern
    if (internId) {
      const [intern] = await query('SELECT * FROM intern_profiles WHERE id = ?', [internId]);
      if (!intern) {
        return res.status(404).json({ success: false, message: 'Intern profile not found.' });
      }

      // Rule 3: Intern must be in the same track as the task
      if (intern.track_id !== task.track_id) {
        return res.status(400).json({
          success: false,
          message: `Track Incompatibility: Intern is in Track ID ${intern.track_id}, but task belongs to Track ID ${task.track_id}. Interns can only be assigned work matching their track.`
        });
      }

      // Rule 5: Duplicate active task assignment prevention
      const [existingActive] = await query(`
        SELECT id, status FROM task_assignments
        WHERE task_id = ? AND intern_id = ? AND status NOT IN ('cancelled')
      `, [taskId, internId]);

      if (existingActive) {
        return res.status(400).json({
          success: false,
          message: `Duplicate Assignment Rejected: Intern already has an active assignment for this task with status '${existingActive.status}'.`
        });
      }

      const result = await query(`
        INSERT INTO task_assignments (task_id, intern_id, cohort_id, assigned_by, assigned_at, due_date, status, notes)
        VALUES (?, ?, ?, ?, NOW(), ?, 'assigned', ?)
      `, [taskId, internId, intern.cohort_id, req.user.id, targetDueDate, notes || null]);

      const assignmentId = result.insertId;
      await recordAuditLog(req.user.id, 'ASSIGN_TASK_INTERN', 'task_assignments', assignmentId, null, { taskId, internId, dueDate: targetDueDate }, req);

      return res.status(201).json({
        success: true,
        message: `Task successfully assigned to intern (Code: ${intern.intern_code}).`,
        data: { id: assignmentId, taskId, internId, status: 'assigned' }
      });
    }

    // CASE B: Assigning to an entire cohort
    if (cohortId) {
      const [cohort] = await query('SELECT * FROM cohorts WHERE id = ?', [cohortId]);
      if (!cohort) {
        return res.status(404).json({ success: false, message: 'Cohort not found.' });
      }

      // Rule 4: Cohort must belong to the task track
      if (cohort.track_id !== task.track_id) {
        return res.status(400).json({
          success: false,
          message: `Track Incompatibility: Cohort belongs to Track ID ${cohort.track_id}, but task belongs to Track ID ${task.track_id}.`
        });
      }

      // Find active interns in cohort
      const interns = await query(`
        SELECT id, intern_code FROM intern_profiles
        WHERE cohort_id = ? AND status = 'active'
      `, [cohortId]);

      if (interns.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No active interns found in this cohort to assign.'
        });
      }

      let createdCount = 0;
      let skippedCount = 0;

      for (const intern of interns) {
        // Check for duplicate active assignment
        const [existing] = await query(`
          SELECT id FROM task_assignments
          WHERE task_id = ? AND intern_id = ? AND status NOT IN ('cancelled')
        `, [taskId, intern.id]);

        if (existing) {
          skippedCount++;
        } else {
          await query(`
            INSERT INTO task_assignments (task_id, intern_id, cohort_id, assigned_by, assigned_at, due_date, status, notes)
            VALUES (?, ?, ?, ?, NOW(), ?, 'assigned', ?)
          `, [taskId, intern.id, cohortId, req.user.id, targetDueDate, notes || null]);
          createdCount++;
        }
      }

      await recordAuditLog(req.user.id, 'ASSIGN_TASK_COHORT', 'cohorts', cohortId, null, { taskId, cohortId, createdCount, skippedCount }, req);

      return res.status(201).json({
        success: true,
        message: `Cohort assignment complete. ${createdCount} intern(s) assigned, ${skippedCount} existing active assignment(s) skipped.`,
        data: { taskId, cohortId, createdCount, skippedCount }
      });
    }
  } catch (error) {
    console.error('assignTask error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign task.' });
  }
};

/**
 * List assignments with status, filters, and intern details
 */
export const getAssignments = async (req, res) => {
  try {
    const { taskId, cohortId, trackId, internId, status, search } = req.query;
    let conditions = [];
    let params = [];

    // Mentor scoping: mentors only see assignments for interns they supervise
    if (req.user.role === 'mentor') {
      conditions.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      params.push(req.user.mentorId, req.user.mentorId);
    } else if (req.user.role === 'intern') {
      conditions.push('ta.intern_id = ?');
      params.push(req.user.internProfileId);
    }

    if (taskId) {
      conditions.push('ta.task_id = ?');
      params.push(taskId);
    }
    if (cohortId) {
      conditions.push('ta.cohort_id = ?');
      params.push(cohortId);
    }
    if (trackId) {
      conditions.push('t.track_id = ?');
      params.push(trackId);
    }
    if (internId) {
      conditions.push('ta.intern_id = ?');
      params.push(internId);
    }
    if (status) {
      conditions.push('ta.status = ?');
      params.push(status);
    }
    if (search && search.trim()) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR ip.intern_code LIKE ? OR t.title LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const assignments = await query(`
      SELECT ta.*,
             t.title as task_title, t.task_type, t.difficulty, t.max_score, t.pass_score, t.due_date as task_default_due,
             tr.name as track_name,
             c.name as cohort_name,
             u.first_name, u.last_name, u.email,
             ip.intern_code,
             ts.id as submission_id, ts.status as submission_status, ts.score, ts.feedback, ts.attempt_number, ts.submitted_at
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      JOIN tracks tr ON t.track_id = tr.id
      JOIN intern_profiles ip ON ta.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN cohorts c ON ta.cohort_id = c.id
      LEFT JOIN task_submissions ts ON ta.id = ts.task_assignment_id
      ${whereClause}
      ORDER BY ta.due_date ASC, ta.id DESC
    `, params);

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error('getAssignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve task assignments.' });
  }
};

/**
 * Cancel a task assignment
 */
export const cancelAssignment = async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    const [assignment] = await query('SELECT * FROM task_assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Task assignment not found.' });
    }

    await query(
      `UPDATE task_assignments SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ' [Cancelled: ', ?, ']') WHERE id = ?`,
      [reason || 'Administrative cancellation', assignmentId]
    );

    await recordAuditLog(req.user.id, 'CANCEL_TASK_ASSIGNMENT', 'task_assignments', assignmentId, assignment, { status: 'cancelled', reason }, req);

    res.json({ success: true, message: 'Assignment cancelled successfully.' });
  } catch (error) {
    console.error('cancelAssignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel assignment.' });
  }
};


// ============================================================================
// GATE 5: INTERN TASK WORKSPACE & WORKFLOW ENGINE (Gate 8)
// ============================================================================

/**
 * Intern retrieves their assigned technical deliverables
 */
export const getMyTasks = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Intern profile not found.' });
    }

    const { status, moduleId } = req.query;
    let conditions = ['ta.intern_id = ?'];
    let params = [internProfileId];

    if (status) {
      conditions.push('ta.status = ?');
      params.push(status);
    }
    if (moduleId) {
      conditions.push('t.module_id = ?');
      params.push(moduleId);
    }

    const tasks = await query(`
      SELECT ta.id as assignment_id, ta.status as assignment_status, ta.due_date as assignment_due_date, ta.assigned_at,
             t.id as task_id, t.title, t.description, t.instructions, t.expected_deliverable,
             t.task_type, t.difficulty, t.max_score, t.pass_score, t.estimated_hours, t.attachment_url as reference_url,
             tr.name as track_name,
             tm.id as module_id, tm.title as module_title, tm.module_code,
             ts.id as submission_id, ts.submission_text, ts.submission_url, ts.attachment_path,
             ts.submitted_at, ts.attempt_number, ts.status as submission_status,
             ts.score, ts.feedback, ts.graded_at,
             gu.first_name as grader_first, gu.last_name as grader_last
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      JOIN tracks tr ON t.track_id = tr.id
      LEFT JOIN training_modules tm ON t.module_id = tm.id
      LEFT JOIN task_submissions ts ON ta.id = ts.task_assignment_id
      LEFT JOIN users gu ON ts.graded_by = gu.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY FIELD(ta.status, 'returned', 'assigned', 'in_progress', 'submitted', 'under_review', 'completed', 'cancelled'), ta.due_date ASC
    `, params);

    // Compute overdue indicator
    const now = new Date();
    const enriched = tasks.map(t => ({
      ...t,
      isOverdue: ['assigned', 'in_progress', 'returned'].includes(t.assignment_status) && new Date(t.assignment_due_date) < now
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('getMyTasks error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve your tasks.' });
  }
};

/**
 * Intern updates their task workflow state (e.g. assigned -> in_progress)
 */
export const updateMyTaskStatus = async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const internProfileId = req.user.internProfileId;

    const [assignment] = await query('SELECT * FROM task_assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    // Ownership check (Rule 6)
    if (assignment.intern_id !== internProfileId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot modify another intern assignment.' });
    }

    // State machine check (Gate 8)
    // Intern can only transition: assigned -> in_progress or returned -> in_progress
    const current = assignment.status;
    if (status === 'in_progress') {
      if (!['assigned', 'returned'].includes(current)) {
        return res.status(400).json({
          success: false,
          message: `Invalid State Transition: Cannot move to 'in_progress' from current state '${current}'.`
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: `Forbidden State Transition: Interns can only transition tasks to 'in_progress'. Use the submission endpoint to submit work.`
      });
    }

    await query('UPDATE task_assignments SET status = ? WHERE id = ?', [status, assignmentId]);
    await recordAuditLog(req.user.id, 'WORKFLOW_STATE_CHANGE', 'task_assignments', assignmentId, { status: current }, { status }, req);

    res.json({ success: true, message: `Task status updated to '${status}'.`, data: { id: assignmentId, status } });
  } catch (error) {
    console.error('updateMyTaskStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to update task status.' });
  }
};


// ============================================================================
// GATE 6: SUBMISSION SYSTEM
// ============================================================================

/**
 * Intern submits deliverables (Text, URL, File)
 */
export const submitTaskWork = async (req, res) => {
  try {
    const internProfileId = req.user.internProfileId;
    if (!internProfileId) {
      return res.status(403).json({ success: false, message: 'Only interns can submit tasks.' });
    }

    const { assignmentId, taskId, submissionText, submissionUrl } = req.body;
    const uploadedFile = req.file;

    // Find assignment by assignmentId or by (taskId, internProfileId)
    let assignment;
    if (assignmentId) {
      const [row] = await query('SELECT * FROM task_assignments WHERE id = ?', [assignmentId]);
      assignment = row;
    } else if (taskId) {
      const [row] = await query('SELECT * FROM task_assignments WHERE task_id = ? AND intern_id = ?', [taskId, internProfileId]);
      assignment = row;
    } else {
      return res.status(400).json({ success: false, message: 'assignmentId or taskId is required.' });
    }

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Task assignment not found for your profile.' });
    }

    // Strict ownership check (Rule 6)
    if (assignment.intern_id !== internProfileId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You cannot submit work for another intern.' });
    }

    // State machine check (Gate 8)
    // Permitted to submit from: 'assigned', 'in_progress', 'returned'
    if (!['assigned', 'in_progress', 'returned'].includes(assignment.status)) {
      return res.status(400).json({
        success: false,
        message: `Submission Rejected: Cannot submit when assignment is currently '${assignment.status}'. Awaiting mentor review or already completed.`
      });
    }

    // Deliverable content validation
    if (!submissionUrl && !submissionText && !uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'Deliverable required: Please provide a project URL, written submission text, or attach a file.'
      });
    }

    const attachmentPath = uploadedFile ? `/uploads/submissions/${uploadedFile.filename}` : null;

    // Check existing submission record for attempt counter
    const [existingSub] = await query(`
      SELECT id, attempt_number, attachment_path FROM task_submissions
      WHERE task_assignment_id = ? OR (task_id = ? AND intern_id = ?)
    `, [assignment.id, assignment.task_id, internProfileId]);

    let attemptNumber = 1;
    let subId;

    if (existingSub) {
      attemptNumber = (existingSub.attempt_number || 1) + 1;
      const finalAttachment = attachmentPath || existingSub.attachment_path;

      await query(`
        UPDATE task_submissions
        SET submission_text = ?,
            submission_url = ?,
            attachment_path = ?,
            submitted_at = NOW(),
            attempt_number = ?,
            status = 'submitted',
            score = NULL,
            feedback = NULL,
            graded_by = NULL,
            graded_at = NULL
        WHERE id = ?
      `, [
        submissionText ? submissionText.trim() : null,
        submissionUrl ? submissionUrl.trim() : null,
        finalAttachment,
        attemptNumber,
        existingSub.id
      ]);
      subId = existingSub.id;
    } else {
      const result = await query(`
        INSERT INTO task_submissions (
          task_assignment_id, task_id, intern_id, submission_text, submission_url, attachment_path, submitted_at, attempt_number, status
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), 1, 'submitted')
      `, [
        assignment.id,
        assignment.task_id,
        internProfileId,
        submissionText ? submissionText.trim() : null,
        submissionUrl ? submissionUrl.trim() : null,
        attachmentPath
      ]);
      subId = result.insertId;
    }

    // Update assignment status to 'submitted'
    await query(`UPDATE task_assignments SET status = 'submitted' WHERE id = ?`, [assignment.id]);

    await recordAuditLog(
      req.user.id,
      'SUBMIT_TASK_WORK',
      'task_submissions',
      subId,
      existingSub ? { attempt: existingSub.attempt_number } : null,
      { attemptNumber, submissionUrl, hasAttachment: !!attachmentPath },
      req
    );

    res.status(201).json({
      success: true,
      message: attemptNumber > 1 ? `Revision submitted successfully (Attempt #${attemptNumber}).` : 'Work submitted successfully.',
      data: {
        submissionId: subId,
        assignmentId: assignment.id,
        attemptNumber,
        status: 'submitted',
        attachmentPath
      }
    });
  } catch (error) {
    console.error('submitTaskWork error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to submit task work.' });
  }
};


// ============================================================================
// GATE 7: MENTOR REVIEW & SUPERVISION
// ============================================================================

/**
 * List submissions with mentor scoping
 */
export const getSubmissions = async (req, res) => {
  try {
    const { taskId, cohortId, trackId, internId, status, search } = req.query;
    let conditions = [];
    let params = [];

    // Rule 8: Mentor scoping
    if (req.user.role === 'mentor') {
      conditions.push('(ip.mentor_id = ? OR c.lead_mentor_id = ?)');
      params.push(req.user.mentorId, req.user.mentorId);
    } else if (req.user.role === 'intern') {
      conditions.push('ts.intern_id = ?');
      params.push(req.user.internProfileId);
    }

    if (taskId) {
      conditions.push('ts.task_id = ?');
      params.push(taskId);
    }
    if (cohortId) {
      conditions.push('c.id = ?');
      params.push(cohortId);
    }
    if (trackId) {
      conditions.push('t.track_id = ?');
      params.push(trackId);
    }
    if (internId) {
      conditions.push('ts.intern_id = ?');
      params.push(internId);
    }
    if (status) {
      conditions.push('ts.status = ?');
      params.push(status);
    }
    if (search && search.trim()) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR ip.intern_code LIKE ? OR t.title LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const submissions = await query(`
      SELECT ts.*,
             t.title as task_title, t.max_score, t.pass_score, t.due_date, t.task_type, t.difficulty,
             tr.name as track_name,
             c.name as cohort_name,
             u.first_name, u.last_name, u.email,
             ip.intern_code,
             gu.first_name as grader_first, gu.last_name as grader_last,
             ta.id as assignment_id, ta.status as assignment_status
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN tracks tr ON t.track_id = tr.id
      JOIN intern_profiles ip ON ts.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      LEFT JOIN task_assignments ta ON ts.task_assignment_id = ta.id
      LEFT JOIN users gu ON ts.graded_by = gu.id
      ${whereClause}
      ORDER BY ts.submitted_at DESC
    `, params);

    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error('getSubmissions error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve submissions.' });
  }
};

/**
 * Mentor or Admin reviews/grades a submission
 */
export const reviewSubmission = async (req, res) => {
  try {
    const submissionId = parseInt(req.params.id, 10);
    const { score, feedback, outcome = 'completed' } = req.body;

    const [submission] = await query(`
      SELECT ts.*, t.max_score, t.pass_score, ip.mentor_id, ip.cohort_id, c.lead_mentor_id
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN intern_profiles ip ON ts.intern_id = ip.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ts.id = ?
    `, [submissionId]);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    // Rule 8: Mentor authorization scoping
    if (req.user.role === 'mentor') {
      const isDirectMentor = submission.mentor_id === req.user.mentorId;
      const isLeadMentor = submission.lead_mentor_id === req.user.mentorId;
      if (!isDirectMentor && !isLeadMentor) {
        return res.status(403).json({
          success: false,
          message: 'Security Alert: You are not authorized to review work for an intern outside your supervision.'
        });
      }
    }

    // Rule 7, 9: Interns cannot review work
    if (req.user.role === 'intern') {
      return res.status(403).json({ success: false, message: 'Interns cannot grade submissions.' });
    }

    // Validation
    const numericScore = score !== undefined && score !== null ? parseFloat(score) : null;
    if (outcome === 'completed') {
      if (numericScore === null || isNaN(numericScore) || numericScore < 0 || numericScore > submission.max_score) {
        return res.status(400).json({
          success: false,
          message: `Score must be a number between 0 and ${submission.max_score}.`
        });
      }
    } else if (outcome === 'returned') {
      if (!feedback || !feedback.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Constructive feedback is required when returning work for revision.'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid outcome. Must be 'completed' or 'returned'."
      });
    }

    const subStatus = outcome === 'completed' ? 'graded' : 'returned';
    const assignStatus = outcome === 'completed' ? 'completed' : 'returned';

    // Update submission record
    await query(`
      UPDATE task_submissions
      SET score = ?, feedback = ?, graded_by = ?, graded_at = NOW(), status = ?
      WHERE id = ?
    `, [numericScore, feedback ? feedback.trim() : null, req.user.id, subStatus, submissionId]);

    // Update assignment record if linked
    if (submission.task_assignment_id) {
      await query(`UPDATE task_assignments SET status = ? WHERE id = ?`, [assignStatus, submission.task_assignment_id]);
    } else {
      await query(`UPDATE task_assignments SET status = ? WHERE task_id = ? AND intern_id = ?`, [assignStatus, submission.task_id, submission.intern_id]);
    }

    // Insert into task_reviews history
    await query(`
      INSERT INTO task_reviews (submission_id, reviewer_id, score, feedback, status, reviewed_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [submissionId, req.user.id, numericScore, feedback ? feedback.trim() : null, outcome]);

    await recordAuditLog(
      req.user.id,
      'REVIEW_SUBMISSION',
      'task_submissions',
      submissionId,
      { status: submission.status, score: submission.score },
      { outcome, score: numericScore, subStatus, assignStatus },
      req
    );

    res.json({
      success: true,
      message: outcome === 'completed'
        ? `Submission approved and graded (${numericScore}/${submission.max_score} pts).`
        : 'Deliverable returned to intern with revision notes.',
      data: {
        submissionId,
        score: numericScore,
        outcome,
        status: subStatus
      }
    });
  } catch (error) {
    console.error('reviewSubmission error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
};


// ============================================================================
// GATE 9: TRAINING PROGRESS CALCULATION ENGINE
// ============================================================================

/**
 * Determine operational training progress for an intern, cohort, or track
 */
export const getTrainingProgress = async (req, res) => {
  try {
    let { internId, cohortId, trackId } = req.query;

    if (req.user.role === 'intern') {
      internId = req.user.internProfileId;
    }

    // Intern-specific progress
    if (internId) {
      const [intern] = await query(`
        SELECT ip.id, ip.intern_code, ip.track_id, ip.cohort_id,
               t.name as track_name, c.name as cohort_name,
               u.first_name, u.last_name
        FROM intern_profiles ip
        JOIN tracks t ON ip.track_id = t.id
        JOIN cohorts c ON ip.cohort_id = c.id
        JOIN users u ON ip.user_id = u.id
        WHERE ip.id = ?
      `, [internId]);

      if (!intern) {
        return res.status(404).json({ success: false, message: 'Intern profile not found.' });
      }

      // 1. Task Assignment metrics
      const [taskAgg] = await query(`
        SELECT
          COUNT(*) as total_assigned,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
          SUM(CASE WHEN status IN ('assigned', 'in_progress') AND due_date < NOW() THEN 1 ELSE 0 END) as overdue_tasks,
          SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned_tasks,
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as pending_review_tasks
        FROM task_assignments
        WHERE intern_id = ? AND status != 'cancelled'
      `, [internId]);

      // 2. Average score from graded submissions
      const [scoreAgg] = await query(`
        SELECT
          AVG(score) as avg_score,
          AVG((score / t.max_score) * 100) as avg_percentage
        FROM task_submissions ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE ts.intern_id = ? AND ts.score IS NOT NULL
      `, [internId]);

      // 3. Module-by-module breakdown
      const modules = await query(`
        SELECT tm.id, tm.title, tm.module_code, tm.sequence_order, tm.estimated_hours,
               COUNT(t.id) as total_module_tasks,
               COUNT(CASE WHEN ta.status = 'completed' THEN 1 ELSE NULL END) as completed_module_tasks
        FROM training_modules tm
        LEFT JOIN tasks t ON tm.id = t.module_id
        LEFT JOIN task_assignments ta ON t.id = ta.task_id AND ta.intern_id = ? AND ta.status != 'cancelled'
        WHERE tm.track_id = ? AND tm.status = 'active'
        GROUP BY tm.id
        ORDER BY tm.sequence_order ASC
      `, [internId, intern.track_id]);

      const modulesWithProgress = modules.map(m => {
        const total = parseInt(m.total_module_tasks, 10);
        const comp = parseInt(m.completed_module_tasks, 10);
        const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
        return {
          id: m.id,
          title: m.title,
          code: m.module_code,
          order: m.sequence_order,
          estimatedHours: m.estimated_hours,
          totalTasks: total,
          completedTasks: comp,
          completionPercentage: pct,
          isCompleted: total > 0 && comp === total
        };
      });

      const totalModules = modulesWithProgress.length;
      const completedModules = modulesWithProgress.filter(m => m.isCompleted).length;
      const overallModulePct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

      const totalAssignedTasks = parseInt(taskAgg.total_assigned || 0, 10);
      const totalCompletedTasks = parseInt(taskAgg.completed_tasks || 0, 10);
      const taskCompletionRate = totalAssignedTasks > 0 ? Math.round((totalCompletedTasks / totalAssignedTasks) * 100) : 0;

      return res.json({
        success: true,
        data: {
          intern: {
            id: intern.id,
            code: intern.intern_code,
            name: `${intern.first_name} ${intern.last_name}`,
            track: intern.track_name,
            cohort: intern.cohort_name
          },
          summary: {
            modulesAssigned: totalModules,
            modulesCompleted: completedModules,
            moduleCompletionRate: overallModulePct,
            tasksAssigned: totalAssignedTasks,
            tasksCompleted: totalCompletedTasks,
            tasksPending: totalAssignedTasks - totalCompletedTasks,
            tasksOverdue: parseInt(taskAgg.overdue_tasks || 0, 10),
            tasksReturned: parseInt(taskAgg.returned_tasks || 0, 10),
            submissionsAwaitingReview: parseInt(taskAgg.pending_review_tasks || 0, 10),
            taskCompletionRate,
            averageScore: Math.round(parseFloat(scoreAgg.avg_score || 0) * 10) / 10,
            averagePercentage: Math.round(parseFloat(scoreAgg.avg_percentage || 0))
          },
          modules: modulesWithProgress
        }
      });
    }

    // Cohort or Track aggregate progress
    let whereFilter = '';
    let filterParam = [];
    if (cohortId) {
      whereFilter = 'WHERE ip.cohort_id = ?';
      filterParam = [cohortId];
    } else if (trackId) {
      whereFilter = 'WHERE ip.track_id = ?';
      filterParam = [trackId];
    }

    const [cohortAgg] = await query(`
      SELECT
        COUNT(DISTINCT ip.id) as enrolled_interns,
        COUNT(ta.id) as total_assignments,
        SUM(CASE WHEN ta.status = 'completed' THEN 1 ELSE 0 END) as completed_assignments,
        SUM(CASE WHEN ta.status IN ('assigned', 'in_progress') AND ta.due_date < NOW() THEN 1 ELSE 0 END) as overdue_assignments,
        SUM(CASE WHEN ta.status = 'submitted' THEN 1 ELSE 0 END) as awaiting_review
      FROM intern_profiles ip
      LEFT JOIN task_assignments ta ON ip.id = ta.intern_id AND ta.status != 'cancelled'
      ${whereFilter}
    `, filterParam);

    const [scoreAgg] = await query(`
      SELECT AVG(ts.score) as avg_score, AVG((ts.score / t.max_score) * 100) as avg_percentage
      FROM intern_profiles ip
      JOIN task_submissions ts ON ip.id = ts.intern_id
      JOIN tasks t ON ts.task_id = t.id
      ${whereFilter}
    `, filterParam);

    res.json({
      success: true,
      data: {
        enrolledInterns: parseInt(cohortAgg.enrolled_interns || 0, 10),
        totalAssignments: parseInt(cohortAgg.total_assignments || 0, 10),
        completedAssignments: parseInt(cohortAgg.completed_assignments || 0, 10),
        overdueAssignments: parseInt(cohortAgg.overdue_assignments || 0, 10),
        awaitingReview: parseInt(cohortAgg.awaiting_review || 0, 10),
        avgScore: Math.round(parseFloat(scoreAgg.avg_score || 0) * 10) / 10,
        avgPercentage: Math.round(parseFloat(scoreAgg.avg_percentage || 0))
      }
    });
  } catch (error) {
    console.error('getTrainingProgress error:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate training progress.' });
  }
};


// ============================================================================
// GATE 10 & 11: OPERATIONS DASHBOARD & MENTOR WORKSPACE
// ============================================================================

/**
 * Admin-facing operational dashboard (Gate 10)
 */
export const getTrainingOperationsDashboard = async (req, res) => {
  try {
    const { trackId, cohortId, mentorId } = req.query;
    let trackFilter = trackId ? 'WHERE track_id = ' + parseInt(trackId, 10) : '';

    const [counts] = await query(`
      SELECT
        (SELECT COUNT(*) FROM training_modules ${trackFilter}) as active_modules,
        (SELECT COUNT(*) FROM tasks ${trackFilter}) as active_tasks,
        (SELECT COUNT(*) FROM task_assignments WHERE status != 'cancelled') as total_assignments,
        (SELECT COUNT(*) FROM task_assignments WHERE status = 'completed') as completed_assignments,
        (SELECT COUNT(*) FROM task_assignments WHERE status IN ('assigned', 'in_progress') AND due_date < NOW()) as overdue_assignments,
        (SELECT COUNT(*) FROM task_assignments WHERE status = 'returned') as returned_assignments,
        (SELECT COUNT(*) FROM task_submissions WHERE status = 'submitted') as pending_reviews
    `);

    // Average Score
    const [avgScore] = await query(`SELECT AVG(score) as avg_score FROM task_submissions WHERE score IS NOT NULL`);

    // Track Breakdown
    const trackBreakdown = await query(`
      SELECT tr.id, tr.name, tr.code,
             COUNT(DISTINCT tm.id) as module_count,
             COUNT(DISTINCT t.id) as task_count,
             COUNT(DISTINCT ip.id) as enrolled_interns,
             COUNT(DISTINCT CASE WHEN ta.status = 'completed' THEN ta.id ELSE NULL END) as completed_tasks
      FROM tracks tr
      LEFT JOIN training_modules tm ON tr.id = tm.track_id
      LEFT JOIN tasks t ON tr.id = t.track_id
      LEFT JOIN intern_profiles ip ON tr.id = ip.track_id
      LEFT JOIN task_assignments ta ON ip.id = ta.intern_id AND ta.status != 'cancelled'
      WHERE tr.is_active = 1
      GROUP BY tr.id
    `);

    // Recent Submissions Awaiting Action
    const pendingQueue = await query(`
      SELECT ts.id, ts.submitted_at, ts.attempt_number,
             t.title as task_title, t.max_score,
             u.first_name, u.last_name, ip.intern_code,
             c.name as cohort_name
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN intern_profiles ip ON ts.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ts.status = 'submitted'
      ORDER BY ts.submitted_at ASC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        metrics: {
          activeModules: parseInt(counts.active_modules || 0, 10),
          activeTasks: parseInt(counts.active_tasks || 0, 10),
          totalAssignments: parseInt(counts.total_assignments || 0, 10),
          completedAssignments: parseInt(counts.completed_assignments || 0, 10),
          overdueAssignments: parseInt(counts.overdue_assignments || 0, 10),
          returnedAssignments: parseInt(counts.returned_assignments || 0, 10),
          pendingReviews: parseInt(counts.pending_reviews || 0, 10),
          averageScore: Math.round(parseFloat(avgScore.avg_score || 0) * 10) / 10
        },
        trackBreakdown,
        pendingQueue
      }
    });
  } catch (error) {
    console.error('getTrainingOperationsDashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load operations dashboard.' });
  }
};

/**
 * Mentor-facing Workspace (Gate 11)
 */
export const getMentorWorkspace = async (req, res) => {
  try {
    const mentorId = req.user.mentorId;
    if (!mentorId && req.user.role === 'mentor') {
      return res.status(403).json({ success: false, message: 'Mentor profile not found.' });
    }

    const mentorFilter = req.user.role === 'mentor' ? `(ip.mentor_id = ${mentorId} OR c.lead_mentor_id = ${mentorId})` : '1=1';

    // 1. Assigned Cohorts
    const cohorts = await query(`
      SELECT c.*, tr.name as track_name,
             COUNT(DISTINCT ip.id) as intern_count
      FROM cohorts c
      JOIN tracks tr ON c.track_id = tr.id
      LEFT JOIN intern_profiles ip ON c.id = ip.cohort_id
      WHERE ${req.user.role === 'mentor' ? 'c.lead_mentor_id = ' + mentorId : '1=1'}
      GROUP BY c.id
    `);

    // 2. Supervised Interns
    const interns = await query(`
      SELECT ip.id, ip.intern_code, ip.status,
             u.first_name, u.last_name, u.email,
             tr.name as track_name, c.name as cohort_name,
             (SELECT COUNT(*) FROM task_assignments ta WHERE ta.intern_id = ip.id AND ta.status = 'completed') as completed_tasks,
             (SELECT COUNT(*) FROM task_assignments ta WHERE ta.intern_id = ip.id AND ta.status IN ('assigned', 'in_progress') AND ta.due_date < NOW()) as overdue_tasks
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks tr ON ip.track_id = tr.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ${mentorFilter}
      ORDER BY ip.id DESC
      LIMIT 25
    `);

    // 3. Submissions Awaiting Mentor's Review
    const pendingReviews = await query(`
      SELECT ts.id, ts.submitted_at, ts.attempt_number, ts.submission_url, ts.submission_text, ts.attachment_path,
             t.id as task_id, t.title as task_title, t.max_score, t.pass_score,
             u.first_name, u.last_name, ip.intern_code,
             c.name as cohort_name
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN intern_profiles ip ON ts.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ts.status = 'submitted' AND ${mentorFilter}
      ORDER BY ts.submitted_at ASC
    `);

    // 4. Recently Reviewed Work
    const recentlyReviewed = await query(`
      SELECT ts.id, ts.score, ts.feedback, ts.graded_at, ts.status,
             t.title as task_title, t.max_score,
             u.first_name, u.last_name, ip.intern_code
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN intern_profiles ip ON ts.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ts.graded_by = ?
      ORDER BY ts.graded_at DESC
      LIMIT 10
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        cohorts,
        interns,
        pendingReviews,
        recentlyReviewed,
        summary: {
          cohortCount: cohorts.length,
          internCount: interns.length,
          pendingReviewCount: pendingReviews.length
        }
      }
    });
  } catch (error) {
    console.error('getMentorWorkspace error:', error);
    res.status(500).json({ success: false, message: 'Failed to load mentor workspace.' });
  }
};
