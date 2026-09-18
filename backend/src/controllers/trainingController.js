import { query } from '../config/db.js';
import { recordAuditLog } from '../middleware/audit.js';

// ============================================================================
// TRACK MANAGEMENT MODULE (Gate 2)
// ============================================================================

/**
 * List all training tracks with cohort & intern statistics and optional search/status filters
 */
export const getTracks = async (req, res) => {
  try {
    const { search, status } = req.query;
    let whereConditions = [];
    let params = [];

    if (status !== undefined && status !== '') {
      if (status === 'active' || status === '1') {
        whereConditions.push('t.is_active = 1');
      } else if (status === 'inactive' || status === '0') {
        whereConditions.push('t.is_active = 0');
      }
    }

    if (search && search.trim()) {
      whereConditions.push('(t.name LIKE ? OR t.code LIKE ? OR t.slug LIKE ? OR t.description LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const tracks = await query(`
      SELECT t.*,
             COUNT(DISTINCT c.id) as cohort_count,
             COUNT(DISTINCT ip.id) as intern_count,
             COUNT(DISTINCT CASE WHEN ip.status = 'active' THEN ip.id ELSE NULL END) as active_intern_count
      FROM tracks t
      LEFT JOIN cohorts c ON t.id = c.track_id
      LEFT JOIN intern_profiles ip ON t.id = ip.track_id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.is_active DESC, t.name ASC
    `, params);

    res.json({ success: true, data: tracks });
  } catch (error) {
    console.error('getTracks error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve tracks.' });
  }
};

/**
 * Get single track details with associated cohorts and active intern roster
 */
export const getTrackById = async (req, res) => {
  try {
    const trackId = parseInt(req.params.id, 10);
    const [track] = await query(`SELECT * FROM tracks WHERE id = ?`, [trackId]);

    if (!track) {
      return res.status(404).json({ success: false, message: 'Track not found.' });
    }

    // Associated cohorts
    const cohorts = await query(`
      SELECT c.*,
             u.first_name as mentor_first, u.last_name as mentor_last,
             COUNT(ip.id) as enrolled_interns
      FROM cohorts c
      LEFT JOIN mentors m ON c.lead_mentor_id = m.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN intern_profiles ip ON c.id = ip.cohort_id
      WHERE c.track_id = ?
      GROUP BY c.id
      ORDER BY c.start_date DESC
    `, [trackId]);

    // Active interns in this track
    const interns = await query(`
      SELECT ip.id, ip.intern_code, ip.status,
             u.first_name, u.last_name, u.email,
             c.name as cohort_name
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN cohorts c ON ip.cohort_id = c.id
      WHERE ip.track_id = ?
      ORDER BY ip.status ASC, u.first_name ASC
      LIMIT 100
    `, [trackId]);

    res.json({
      success: true,
      data: {
        track,
        cohorts,
        interns,
        summary: {
          totalCohorts: cohorts.length,
          totalInterns: interns.length
        }
      }
    });
  } catch (error) {
    console.error('getTrackById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve track details.' });
  }
};

/**
 * Create a new Track
 */
export const createTrack = async (req, res) => {
  try {
    const { name, code, description, durationWeeks, curriculumSummary, requiredSkills } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Track name is required.' });
    }

    const trimmedCode = (code || '').trim().toUpperCase();
    if (!trimmedCode) {
      return res.status(400).json({ success: false, message: 'Track code is required (e.g. TRK-FSD).' });
    }

    // Check code uniqueness
    const [existingCode] = await query('SELECT id FROM tracks WHERE code = ?', [trimmedCode]);
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `A track with code '${trimmedCode}' already exists.`
      });
    }

    // Generate slug
    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    const [existingSlug] = await query('SELECT id FROM tracks WHERE slug = ?', [slug]);
    if (existingSlug) {
      slug = `${baseSlug}-${trimmedCode.toLowerCase()}`;
    }

    const duration = parseInt(durationWeeks, 10);
    const validDuration = !isNaN(duration) && duration > 0 ? duration : 24;

    const result = await query(
      `INSERT INTO tracks (name, code, slug, description, duration_weeks, curriculum_summary, required_skills, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name.trim(),
        trimmedCode,
        slug,
        description ? description.trim() : null,
        validDuration,
        curriculumSummary ? curriculumSummary.trim() : null,
        requiredSkills ? requiredSkills.trim() : null
      ]
    );

    const trackId = result.insertId;
    await recordAuditLog(req.user.id, 'CREATE_TRACK', 'tracks', trackId, null, { name: name.trim(), code: trimmedCode }, req);

    res.status(201).json({
      success: true,
      message: `Track '${name.trim()}' (${trimmedCode}) created successfully.`,
      data: { id: trackId, name: name.trim(), code: trimmedCode }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'A track with this name or code already exists.' });
    }
    console.error('createTrack error:', error);
    res.status(500).json({ success: false, message: 'Failed to create track.' });
  }
};

/**
 * Update an existing Track
 */
export const updateTrack = async (req, res) => {
  try {
    const trackId = parseInt(req.params.id, 10);
    const { name, code, description, durationWeeks, curriculumSummary, requiredSkills, isActive } = req.body;

    const [existing] = await query('SELECT * FROM tracks WHERE id = ?', [trackId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Track not found.' });
    }

    if (code) {
      const trimmedCode = code.trim().toUpperCase();
      const [duplicate] = await query('SELECT id FROM tracks WHERE code = ? AND id != ?', [trimmedCode, trackId]);
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Track code '${trimmedCode}' is already in use by another track.` });
      }
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedCode = code !== undefined ? code.trim().toUpperCase() : existing.code;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedDuration = durationWeeks !== undefined ? (parseInt(durationWeeks, 10) || existing.duration_weeks) : existing.duration_weeks;
    const updatedCurriculum = curriculumSummary !== undefined ? curriculumSummary : existing.curriculum_summary;
    const updatedSkills = requiredSkills !== undefined ? requiredSkills : existing.required_skills;
    const updatedActive = isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active;

    await query(
      `UPDATE tracks
       SET name = ?, code = ?, description = ?, duration_weeks = ?, curriculum_summary = ?, required_skills = ?, is_active = ?
       WHERE id = ?`,
      [updatedName, updatedCode, updatedDesc, updatedDuration, updatedCurriculum, updatedSkills, updatedActive, trackId]
    );

    await recordAuditLog(req.user.id, 'UPDATE_TRACK', 'tracks', trackId, existing, req.body, req);

    res.json({
      success: true,
      message: 'Track updated successfully.',
      data: { id: trackId, name: updatedName, code: updatedCode, isActive: updatedActive }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'A track with this code or slug already exists.' });
    }
    console.error('updateTrack error:', error);
    res.status(500).json({ success: false, message: 'Failed to update track.' });
  }
};

/**
 * Toggle Track active/inactive status
 */
export const toggleTrackStatus = async (req, res) => {
  try {
    const trackId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM tracks WHERE id = ?', [trackId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Track not found.' });
    }

    const newStatus = existing.is_active === 1 ? 0 : 1;
    await query('UPDATE tracks SET is_active = ? WHERE id = ?', [newStatus, trackId]);

    await recordAuditLog(req.user.id, 'TOGGLE_TRACK_STATUS', 'tracks', trackId, { is_active: existing.is_active }, { is_active: newStatus }, req);

    res.json({
      success: true,
      message: `Track '${existing.name}' is now ${newStatus === 1 ? 'ACTIVE' : 'DEACTIVATED'}.`,
      data: { id: trackId, isActive: newStatus === 1 }
    });
  } catch (error) {
    console.error('toggleTrackStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle track status.' });
  }
};

/**
 * Delete a Track (prevented if historical cohorts or interns reference it)
 */
export const deleteTrack = async (req, res) => {
  try {
    const trackId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM tracks WHERE id = ?', [trackId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Track not found.' });
    }

    // Check for existing cohorts, interns, or training modules
    const [cohortCount] = await query('SELECT COUNT(*) as count FROM cohorts WHERE track_id = ?', [trackId]);
    const [internCount] = await query('SELECT COUNT(*) as count FROM intern_profiles WHERE track_id = ?', [trackId]);
    const [moduleCount] = await query('SELECT COUNT(*) as count FROM training_modules WHERE track_id = ?', [trackId]);

    const totalRefs = (cohortCount?.count || 0) + (internCount?.count || 0) + (moduleCount?.count || 0);
    if (totalRefs > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete track '${existing.name}' because it is referenced by ${cohortCount.count} cohort(s), ${internCount.count} intern(s), and ${moduleCount.count} module(s). Deactivate the track instead to preserve historical integrity.`
      });
    }

    await query('DELETE FROM tracks WHERE id = ?', [trackId]);
    await recordAuditLog(req.user.id, 'DELETE_TRACK', 'tracks', trackId, existing, null, req);

    res.json({
      success: true,
      message: `Track '${existing.name}' successfully deleted.`
    });
  } catch (error) {
    console.error('deleteTrack error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete track.' });
  }
};


// ============================================================================
// COHORT MANAGEMENT MODULE (Gate 3)
// ============================================================================

/**
 * List cohorts with track, lead mentor, member counts, and status/track filters
 */
export const getCohorts = async (req, res) => {
  try {
    const { trackId, status, search } = req.query;
    let whereConditions = [];
    let params = [];

    if (trackId) {
      whereConditions.push('c.track_id = ?');
      params.push(trackId);
    }

    if (status) {
      whereConditions.push('c.status = ?');
      params.push(status.toLowerCase());
    }

    if (search && search.trim()) {
      whereConditions.push('(c.name LIKE ? OR c.cohort_code LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const cohorts = await query(`
      SELECT c.*,
             t.name as track_name, t.code as track_code,
             m.id as mentor_id,
             u.first_name as mentor_first, u.last_name as mentor_last, u.email as mentor_email,
             COUNT(ip.id) as current_interns_count,
             SUM(CASE WHEN ip.status = 'active' THEN 1 ELSE 0 END) as active_interns_count
      FROM cohorts c
      JOIN tracks t ON c.track_id = t.id
      LEFT JOIN mentors m ON c.lead_mentor_id = m.id
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN intern_profiles ip ON c.id = ip.cohort_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY FIELD(c.status, 'active', 'upcoming', 'completed', 'archived'), c.start_date DESC
    `, params);

    res.json({ success: true, data: cohorts });
  } catch (error) {
    console.error('getCohorts error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve cohorts.' });
  }
};

/**
 * Get cohort details including assigned lead mentor and enrolled intern roster
 */
export const getCohortById = async (req, res) => {
  try {
    const cohortId = parseInt(req.params.id, 10);
    const [cohort] = await query(`
      SELECT c.*,
             t.name as track_name, t.code as track_code, t.duration_weeks,
             m.id as mentor_id, m.specialization as mentor_specialization,
             u.first_name as mentor_first, u.last_name as mentor_last, u.email as mentor_email, u.phone as mentor_phone
      FROM cohorts c
      JOIN tracks t ON c.track_id = t.id
      LEFT JOIN mentors m ON c.lead_mentor_id = m.id
      LEFT JOIN users u ON m.user_id = u.id
      WHERE c.id = ?
    `, [cohortId]);

    if (!cohort) {
      return res.status(404).json({ success: false, message: 'Cohort not found.' });
    }

    // Enrolled interns
    const members = await query(`
      SELECT ip.id, ip.intern_code, ip.status, ip.start_date, ip.expected_end_date,
             u.first_name, u.last_name, u.email, u.phone, u.avatar_url,
             m.id as intern_mentor_id,
             mu.first_name as intern_mentor_first, mu.last_name as intern_mentor_last
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users mu ON m.user_id = mu.id
      WHERE ip.cohort_id = ?
      ORDER BY ip.status ASC, u.first_name ASC
    `, [cohortId]);

    res.json({
      success: true,
      data: {
        cohort,
        members,
        stats: {
          enrolledCount: members.length,
          capacity: cohort.capacity,
          utilizationPercentage: cohort.capacity > 0 ? Math.round((members.length / cohort.capacity) * 100) : 0,
          activeCount: members.filter(m => m.status === 'active').length
        }
      }
    });
  } catch (error) {
    console.error('getCohortById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve cohort details.' });
  }
};

/**
 * Create a new Cohort with validations
 */
export const createCohort = async (req, res) => {
  try {
    const { name, cohortCode, trackId, leadMentorId, startDate, endDate, capacity, status, description } = req.body;

    if (!name || !name.trim() || !trackId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Name, track, start date, and end date are required.'
      });
    }

    // Code validation
    const trimmedCode = (cohortCode || '').trim().toUpperCase();
    if (!trimmedCode) {
      return res.status(400).json({ success: false, message: 'Cohort code is required (e.g. COH-2026-C).' });
    }

    // Check code uniqueness
    const [existingCode] = await query('SELECT id FROM cohorts WHERE cohort_code = ?', [trimmedCode]);
    if (existingCode) {
      return res.status(400).json({ success: false, message: `Cohort code '${trimmedCode}' already exists.` });
    }

    // Validate track exists and is active
    const [track] = await query('SELECT id, is_active FROM tracks WHERE id = ?', [trackId]);
    if (!track) {
      return res.status(400).json({ success: false, message: 'Selected track does not exist.' });
    }
    if (track.is_active === 0) {
      return res.status(400).json({ success: false, message: 'Cannot create cohort under a deactivated track.' });
    }

    // Validate dates: end_date cannot precede start_date
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot precede start date.'
      });
    }

    // Validate capacity
    const validCapacity = parseInt(capacity, 10);
    if (isNaN(validCapacity) || validCapacity <= 0) {
      return res.status(400).json({ success: false, message: 'Capacity must be a positive integer.' });
    }

    // Validate status
    const allowedStatuses = ['upcoming', 'active', 'completed', 'archived'];
    const cohortStatus = (status || 'active').toLowerCase();
    if (!allowedStatuses.includes(cohortStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status '${status}'. Allowed values: upcoming, active, completed, archived.`
      });
    }

    // Validate lead mentor if supplied
    if (leadMentorId) {
      const [mentor] = await query('SELECT id FROM mentors WHERE id = ?', [leadMentorId]);
      if (!mentor) {
        return res.status(400).json({ success: false, message: 'Assigned lead mentor does not exist.' });
      }
    }

    const result = await query(
      `INSERT INTO cohorts (name, cohort_code, track_id, lead_mentor_id, start_date, end_date, capacity, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        trimmedCode,
        trackId,
        leadMentorId || null,
        startDate,
        endDate,
        validCapacity,
        description ? description.trim() : null,
        cohortStatus
      ]
    );

    const cohortId = result.insertId;
    await recordAuditLog(req.user.id, 'CREATE_COHORT', 'cohorts', cohortId, null, { name: name.trim(), cohortCode: trimmedCode, trackId }, req);

    res.status(201).json({
      success: true,
      message: `Cohort '${name.trim()}' (${trimmedCode}) successfully created.`,
      data: { id: cohortId, name: name.trim(), cohortCode: trimmedCode, status: cohortStatus }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'A cohort with this code already exists.' });
    }
    console.error('createCohort error:', error);
    res.status(500).json({ success: false, message: 'Failed to create cohort.' });
  }
};

/**
 * Update an existing Cohort
 */
export const updateCohort = async (req, res) => {
  try {
    const cohortId = parseInt(req.params.id, 10);
    const { name, cohortCode, trackId, leadMentorId, startDate, endDate, capacity, status, description } = req.body;

    const [existing] = await query('SELECT * FROM cohorts WHERE id = ?', [cohortId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Cohort not found.' });
    }

    // Check code uniqueness if changed
    if (cohortCode) {
      const trimmedCode = cohortCode.trim().toUpperCase();
      const [dup] = await query('SELECT id FROM cohorts WHERE cohort_code = ? AND id != ?', [trimmedCode, cohortId]);
      if (dup) {
        return res.status(400).json({ success: false, message: `Cohort code '${trimmedCode}' already exists.` });
      }
    }

    // Validate dates
    const finalStart = startDate || existing.start_date;
    const finalEnd = endDate || existing.end_date;
    if (new Date(finalEnd) < new Date(finalStart)) {
      return res.status(400).json({ success: false, message: 'End date cannot precede start date.' });
    }

    // Validate status if provided
    let finalStatus = existing.status;
    if (status) {
      const allowed = ['upcoming', 'active', 'completed', 'archived'];
      if (!allowed.includes(status.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Invalid cohort status.' });
      }
      finalStatus = status.toLowerCase();
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedCode = cohortCode !== undefined ? cohortCode.trim().toUpperCase() : existing.cohort_code;
    const updatedTrack = trackId !== undefined ? trackId : existing.track_id;
    const updatedMentor = leadMentorId !== undefined ? (leadMentorId || null) : existing.lead_mentor_id;
    const updatedCapacity = capacity !== undefined ? (parseInt(capacity, 10) || existing.capacity) : existing.capacity;
    const updatedDesc = description !== undefined ? description : existing.description;

    await query(
      `UPDATE cohorts
       SET name = ?, cohort_code = ?, track_id = ?, lead_mentor_id = ?, start_date = ?, end_date = ?, capacity = ?, description = ?, status = ?
       WHERE id = ?`,
      [updatedName, updatedCode, updatedTrack, updatedMentor, finalStart, finalEnd, updatedCapacity, updatedDesc, finalStatus, cohortId]
    );

    await recordAuditLog(req.user.id, 'UPDATE_COHORT', 'cohorts', cohortId, existing, req.body, req);

    res.json({
      success: true,
      message: 'Cohort updated successfully.',
      data: { id: cohortId, name: updatedName, cohortCode: updatedCode, status: finalStatus }
    });
  } catch (error) {
    console.error('updateCohort error:', error);
    res.status(500).json({ success: false, message: 'Failed to update cohort.' });
  }
};

/**
 * Delete a Cohort (prevented if interns are enrolled)
 */
export const deleteCohort = async (req, res) => {
  try {
    const cohortId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM cohorts WHERE id = ?', [cohortId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Cohort not found.' });
    }

    const [internCount] = await query('SELECT COUNT(*) as count FROM intern_profiles WHERE cohort_id = ?', [cohortId]);
    if (internCount?.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete cohort '${existing.name}' because ${internCount.count} intern(s) are currently enrolled. Archive the cohort instead to preserve historical records.`
      });
    }

    await query('DELETE FROM cohorts WHERE id = ?', [cohortId]);
    await recordAuditLog(req.user.id, 'DELETE_COHORT', 'cohorts', cohortId, existing, null, req);

    res.json({
      success: true,
      message: `Cohort '${existing.name}' deleted successfully.`
    });
  } catch (error) {
    console.error('deleteCohort error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete cohort.' });
  }
};


// ============================================================================
// MENTORS DIRECTORY
// ============================================================================

export const getMentors = async (req, res) => {
  try {
    const mentors = await query(`
      SELECT m.id, m.specialization, m.bio,
             u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, u.is_active,
             COUNT(DISTINCT c.id) as assigned_cohorts,
             COUNT(DISTINCT ip.id) as assigned_interns
      FROM mentors m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN cohorts c ON m.id = c.lead_mentor_id
      LEFT JOIN intern_profiles ip ON m.id = ip.mentor_id
      WHERE u.is_active = 1
      GROUP BY m.id
      ORDER BY u.first_name ASC
    `);
    res.json({ success: true, data: mentors });
  } catch (error) {
    console.error('getMentors error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve mentors.' });
  }
};


// ============================================================================
// TRAINING MODULE MANAGEMENT MODULE (Phase 3 Gate 2)
// ============================================================================

export const getModules = async (req, res) => {
  try {
    const { trackId, status, search } = req.query;
    let whereConditions = [];
    let params = [];

    // Role-based scoping
    if (req.user.role === 'intern') {
      whereConditions.push('m.track_id = ?');
      params.push(req.user.trackId || 0);
      whereConditions.push("m.status = 'active'");
    } else {
      if (trackId) {
        whereConditions.push('m.track_id = ?');
        params.push(trackId);
      }
      if (status) {
        whereConditions.push('m.status = ?');
        params.push(status);
      }
    }

    if (search && search.trim()) {
      whereConditions.push('(m.title LIKE ? OR m.module_code LIKE ? OR m.description LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const modules = await query(`
      SELECT m.*,
             t.name as track_name, t.code as track_code,
             COUNT(DISTINCT tk.id) as task_count,
             COUNT(DISTINCT CASE WHEN tk.status = 'published' THEN tk.id ELSE NULL END) as published_task_count
      FROM training_modules m
      JOIN tracks t ON m.track_id = t.id
      LEFT JOIN tasks tk ON m.id = tk.module_id
      ${whereClause}
      GROUP BY m.id
      ORDER BY m.track_id ASC, m.sequence_order ASC, m.id ASC
    `, params);

    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('getModules error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve training modules.' });
  }
};

export const getModuleById = async (req, res) => {
  try {
    const moduleId = parseInt(req.params.id, 10);
    const [module] = await query(`
      SELECT m.*, t.name as track_name, t.code as track_code
      FROM training_modules m
      JOIN tracks t ON m.track_id = t.id
      WHERE m.id = ?
    `, [moduleId]);

    if (!module) {
      return res.status(404).json({ success: false, message: 'Training module not found.' });
    }

    if (req.user.role === 'intern' && module.track_id !== req.user.trackId) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only view modules for your assigned track.' });
    }

    let taskConditions = ['t.module_id = ?'];
    let taskParams = [moduleId];
    if (req.user.role === 'intern') {
      taskConditions.push("t.status = 'published'");
    }

    const tasks = await query(`
      SELECT t.*,
             u.first_name as author_first, u.last_name as author_last
      FROM tasks t
      JOIN users u ON t.assigned_by = u.id
      WHERE ${taskConditions.join(' AND ')}
      ORDER BY t.due_date ASC, t.id ASC
    `, taskParams);

    res.json({
      success: true,
      data: {
        ...module,
        tasks
      }
    });
  } catch (error) {
    console.error('getModuleById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve module details.' });
  }
};

export const createModule = async (req, res) => {
  try {
    const { trackId, title, description, moduleCode, sequenceOrder, estimatedHours, status } = req.body;

    if (!trackId) {
      return res.status(400).json({ success: false, message: 'Track ID is required.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Module title is required.' });
    }

    const [track] = await query('SELECT id, name FROM tracks WHERE id = ?', [trackId]);
    if (!track) {
      return res.status(400).json({ success: false, message: 'Invalid track ID: Track does not exist.' });
    }

    const trimmedCode = (moduleCode || '').trim().toUpperCase();
    if (!trimmedCode) {
      return res.status(400).json({ success: false, message: 'Module code is required (e.g. MOD-FSD-01).' });
    }

    const [existingCode] = await query(
      'SELECT id FROM training_modules WHERE track_id = ? AND module_code = ?',
      [trackId, trimmedCode]
    );
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `A module with code '${trimmedCode}' already exists in this track.`
      });
    }

    let order = parseInt(sequenceOrder, 10);
    if (isNaN(order) || order <= 0) {
      const [maxOrder] = await query('SELECT MAX(sequence_order) as max_o FROM training_modules WHERE track_id = ?', [trackId]);
      order = (maxOrder?.max_o || 0) + 1;
    }

    const hours = parseInt(estimatedHours, 10);
    const validHours = !isNaN(hours) && hours > 0 ? hours : 10;
    const finalStatus = ['draft', 'active', 'archived'].includes(status) ? status : 'active';

    const result = await query(`
      INSERT INTO training_modules (track_id, title, description, module_code, sequence_order, estimated_hours, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [trackId, title.trim(), description ? description.trim() : null, trimmedCode, order, validHours, finalStatus]);

    const moduleId = result.insertId;
    await recordAuditLog(req.user.id, 'CREATE_TRAINING_MODULE', 'training_modules', moduleId, null, { trackId, title: title.trim(), moduleCode: trimmedCode }, req);

    res.status(201).json({
      success: true,
      message: `Training module '${title.trim()}' (${trimmedCode}) created successfully.`,
      data: { id: moduleId, trackId, title: title.trim(), moduleCode: trimmedCode, sequenceOrder: order, status: finalStatus }
    });
  } catch (error) {
    console.error('createModule error:', error);
    res.status(500).json({ success: false, message: 'Failed to create training module.' });
  }
};

export const updateModule = async (req, res) => {
  try {
    const moduleId = parseInt(req.params.id, 10);
    const { title, description, moduleCode, sequenceOrder, estimatedHours, status, trackId } = req.body;

    const [existing] = await query('SELECT * FROM training_modules WHERE id = ?', [moduleId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Training module not found.' });
    }

    const targetTrackId = trackId ? parseInt(trackId, 10) : existing.track_id;
    if (trackId && trackId !== existing.track_id) {
      const [tr] = await query('SELECT id FROM tracks WHERE id = ?', [targetTrackId]);
      if (!tr) {
        return res.status(400).json({ success: false, message: 'Target track does not exist.' });
      }
    }

    const updatedCode = moduleCode ? moduleCode.trim().toUpperCase() : existing.module_code;
    if (updatedCode !== existing.module_code || targetTrackId !== existing.track_id) {
      const [duplicate] = await query(
        'SELECT id FROM training_modules WHERE track_id = ? AND module_code = ? AND id != ?',
        [targetTrackId, updatedCode, moduleId]
      );
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Module code '${updatedCode}' is already taken in this track.` });
      }
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedDesc = description !== undefined ? description : existing.description;
    const updatedOrder = sequenceOrder !== undefined ? parseInt(sequenceOrder, 10) : existing.sequence_order;
    const updatedHours = estimatedHours !== undefined ? parseInt(estimatedHours, 10) : existing.estimated_hours;
    const updatedStatus = status !== undefined && ['draft', 'active', 'archived'].includes(status) ? status : existing.status;

    await query(`
      UPDATE training_modules
      SET track_id = ?, title = ?, description = ?, module_code = ?, sequence_order = ?, estimated_hours = ?, status = ?
      WHERE id = ?
    `, [targetTrackId, updatedTitle, updatedDesc, updatedCode, updatedOrder, updatedHours, updatedStatus, moduleId]);

    await recordAuditLog(req.user.id, 'UPDATE_TRAINING_MODULE', 'training_modules', moduleId, existing, req.body, req);

    res.json({
      success: true,
      message: 'Training module updated successfully.',
      data: { id: moduleId, title: updatedTitle, moduleCode: updatedCode, sequenceOrder: updatedOrder, status: updatedStatus }
    });
  } catch (error) {
    console.error('updateModule error:', error);
    res.status(500).json({ success: false, message: 'Failed to update training module.' });
  }
};

export const toggleModuleStatus = async (req, res) => {
  try {
    const moduleId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const [existing] = await query('SELECT * FROM training_modules WHERE id = ?', [moduleId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Training module not found.' });
    }

    let newStatus = status;
    if (!newStatus) {
      newStatus = existing.status === 'active' ? 'archived' : 'active';
    }

    if (!['draft', 'active', 'archived'].includes(newStatus)) {
      return res.status(400).json({ success: false, message: "Status must be 'draft', 'active', or 'archived'." });
    }

    await query('UPDATE training_modules SET status = ? WHERE id = ?', [newStatus, moduleId]);
    await recordAuditLog(req.user.id, 'TOGGLE_MODULE_STATUS', 'training_modules', moduleId, { status: existing.status }, { status: newStatus }, req);

    res.json({
      success: true,
      message: `Training module status changed from '${existing.status}' to '${newStatus}'.`,
      data: { id: moduleId, status: newStatus }
    });
  } catch (error) {
    console.error('toggleModuleStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle module status.' });
  }
};

export const reorderModules = async (req, res) => {
  try {
    const { trackId, moduleOrders } = req.body;
    if (!trackId || !Array.isArray(moduleOrders)) {
      return res.status(400).json({ success: false, message: 'trackId and moduleOrders array are required.' });
    }

    for (const item of moduleOrders) {
      if (item.id && item.sequenceOrder !== undefined) {
        await query(
          'UPDATE training_modules SET sequence_order = ? WHERE id = ? AND track_id = ?',
          [parseInt(item.sequenceOrder, 10), parseInt(item.id, 10), parseInt(trackId, 10)]
        );
      }
    }

    await recordAuditLog(req.user.id, 'REORDER_TRAINING_MODULES', 'tracks', trackId, null, { moduleOrders }, req);

    res.json({ success: true, message: 'Modules reordered successfully.' });
  } catch (error) {
    console.error('reorderModules error:', error);
    res.status(500).json({ success: false, message: 'Failed to reorder modules.' });
  }
};

export const deleteModule = async (req, res) => {
  try {
    const moduleId = parseInt(req.params.id, 10);
    const [existing] = await query('SELECT * FROM training_modules WHERE id = ?', [moduleId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Training module not found.' });
    }

    const [taskCount] = await query('SELECT COUNT(*) as count FROM tasks WHERE module_id = ?', [moduleId]);
    if (taskCount?.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete module '${existing.title}' because ${taskCount.count} task(s) are assigned to it. Archive the module or reassign its tasks first.`
      });
    }

    await query('DELETE FROM training_modules WHERE id = ?', [moduleId]);
    await recordAuditLog(req.user.id, 'DELETE_TRAINING_MODULE', 'training_modules', moduleId, existing, null, req);

    res.json({ success: true, message: `Training module '${existing.title}' deleted successfully.` });
  } catch (error) {
    console.error('deleteModule error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete training module.' });
  }
};
