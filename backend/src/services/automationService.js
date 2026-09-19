import crypto from 'crypto';
import { query } from '../config/db.js';
import { getLagosDate, isWorkingDay } from '../utils/timezone.js';
import { createNotification } from './notificationService.js';
import { recordAuditLog } from '../middleware/audit.js';

/**
 * Enterprise Automation Service (Phase 9)
 * Deterministic, idempotent, and auditable ERP workflow engine.
 */
class AutomationService {
  /**
   * Helper to generate a deterministic SHA-256 idempotency key
   */
  generateIdempotencyKey(ruleCode, entityRef, cycleDate) {
    const raw = `${ruleCode}:${entityRef || 'global'}:${cycleDate}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 64);
  }

  /**
   * Master execution dispatcher for an automation rule
   */
  async executeRule(ruleCode, options = {}) {
    const {
      triggerType = 'manual',
      executedBy = null,
      targetDate = null,
      force = false,
      req = null
    } = options;

    const { date: currentDate } = getLagosDate();
    const effectiveDate = targetDate || currentDate;

    // 1. Fetch rule configuration
    const [rule] = await query(`SELECT * FROM automation_rules WHERE rule_code = ?`, [ruleCode]);
    if (!rule) {
      throw new Error(`Automation rule '${ruleCode}' not found.`);
    }

    if (!rule.is_enabled && !force) {
      return {
        success: false,
        status: 'skipped',
        message: `Automation rule '${rule.name}' is currently disabled.`,
        affectedCount: 0
      };
    }

    const config = typeof rule.config === 'string' ? JSON.parse(rule.config) : (rule.config || {});
    const idempotencyKey = this.generateIdempotencyKey(ruleCode, 'all', effectiveDate);

    // 2. Idempotency Check (Gate 17)
    if (!force) {
      const existingCompleted = await query(
        `SELECT id, status, completion_time, affected_count 
         FROM automation_executions 
         WHERE rule_id = ? AND idempotency_key = ? AND status = 'completed'
         ORDER BY id DESC LIMIT 1`,
        [rule.id, idempotencyKey]
      );

      if (existingCompleted.length > 0) {
        // Record skipped run in history
        await query(
          `INSERT INTO automation_executions 
           (rule_id, rule_code, trigger_type, idempotency_key, status, start_time, completion_time, affected_count, details, executed_by)
           VALUES (?, ?, ?, ?, 'skipped', NOW(), NOW(), 0, ?, ?)`,
          [
            rule.id,
            ruleCode,
            triggerType,
            `${idempotencyKey}-skip-${Date.now()}`,
            JSON.stringify({ reason: 'Idempotency protection: execution already completed for this cycle', existingExecutionId: existingCompleted[0].id }),
            executedBy
          ]
        );

        return {
          success: true,
          status: 'skipped',
          message: `Execution skipped: rule '${rule.name}' has already successfully executed for cycle '${effectiveDate}'.`,
          affectedCount: 0,
          idempotencyKey
        };
      }
    }

    // 3. Create initial execution record with 'running' status
    const execResult = await query(
      `INSERT INTO automation_executions 
       (rule_id, rule_code, trigger_type, idempotency_key, status, start_time, executed_by)
       VALUES (?, ?, ?, ?, 'running', NOW(), ?)`,
      [rule.id, ruleCode, triggerType, idempotencyKey, executedBy]
    );
    const executionId = execResult.insertId;

    // 4. Dispatch to authoritative handler
    try {
      let result = { affectedCount: 0, details: {} };

      switch (rule.rule_code) {
        case 'AUTO_ATTENDANCE_CLOSE':
          result = await this.handleAttendanceClose(config, effectiveDate, executedBy);
          break;
        case 'AUTO_OVERDUE_TASKS':
          result = await this.handleOverdueTasks(config);
          break;
        case 'AUTO_TRAINING_PROGRESS':
          result = await this.handleTrainingProgress(config);
          break;
        case 'AUTO_PERF_REMINDERS':
          result = await this.handlePerformanceReminders(config);
          break;
        case 'AUTO_DOC_EXPIRY':
          result = await this.handleDocumentExpiry(config);
          break;
        case 'AUTO_CERT_ELIGIBILITY':
          result = await this.handleCertificateEligibility(config);
          break;
        case 'AUTO_COHORT_LIFECYCLE':
          result = await this.handleCohortLifecycle(config);
          break;
        case 'AUTO_MENTOR_WORKLOAD':
          result = await this.handleMentorWorkload(config);
          break;
        case 'AUTO_SCHEDULED_REPORT':
          result = await this.handleScheduledReport(config);
          break;
        default:
          throw new Error(`Unsupported automation action '${rule.action_type}'.`);
      }

      // 5. Update execution to completed
      await query(
        `UPDATE automation_executions 
         SET status = 'completed', 
             completion_time = NOW(), 
             affected_count = ?, 
             details = ?
         WHERE id = ?`,
        [result.affectedCount, JSON.stringify(result.details || {}), executionId]
      );

      // Update last_run_at on rule
      await query(`UPDATE automation_rules SET last_run_at = NOW() WHERE id = ?`, [rule.id]);

      // Audit log the automation execution
      if (executedBy) {
        await recordAuditLog(
          executedBy,
          'AUTOMATION_EXECUTION_COMPLETED',
          'automation_rules',
          rule.id,
          null,
          { executionId, ruleCode, affectedCount: result.affectedCount, details: result.details },
          req
        );
      }

      return {
        success: true,
        executionId,
        ruleCode,
        status: 'completed',
        affectedCount: result.affectedCount,
        details: result.details
      };
    } catch (err) {
      console.error(`Automation rule [${ruleCode}] failed:`, err);

      // Record failure state (Gate 16)
      await query(
        `UPDATE automation_executions 
         SET status = 'failed', 
             completion_time = NOW(), 
             error_message = ?
         WHERE id = ?`,
        [err.message || 'Unknown automation execution error', executionId]
      );

      if (executedBy) {
        await recordAuditLog(
          executedBy,
          'AUTOMATION_EXECUTION_FAILED',
          'automation_rules',
          rule.id,
          null,
          { executionId, ruleCode, error: err.message },
          req
        );
      }

      return {
        success: false,
        executionId,
        ruleCode,
        status: 'failed',
        error: err.message
      };
    }
  }

  /**
   * Controlled Retry Handler (Gate 16)
   */
  async retryExecution(executionId, userId = null, req = null) {
    const [exec] = await query(`SELECT * FROM automation_executions WHERE id = ?`, [executionId]);
    if (!exec) {
      throw new Error(`Execution record #${executionId} not found.`);
    }

    if (exec.status !== 'failed') {
      throw new Error(`Only failed executions can be retried. Current status is '${exec.status}'.`);
    }

    if (exec.retry_count >= exec.max_retries) {
      throw new Error(`Execution #${executionId} has reached maximum retry limit (${exec.max_retries}).`);
    }

    const newRetryCount = exec.retry_count + 1;
    await query(
      `UPDATE automation_executions 
       SET status = 'retrying', retry_count = ?, error_message = NULL 
       WHERE id = ?`,
      [newRetryCount, executionId]
    );

    // Re-run the rule with force = true
    const runResult = await this.executeRule(exec.rule_code, {
      triggerType: 'manual',
      executedBy: userId || exec.executed_by,
      force: true,
      req
    });

    // Update retry record with new result
    await query(
      `UPDATE automation_executions 
       SET status = ?, 
           completion_time = NOW(), 
           affected_count = ?, 
           details = ?, 
           error_message = ? 
       WHERE id = ?`,
      [
        runResult.status,
        runResult.affectedCount || 0,
        JSON.stringify(runResult.details || {}),
        runResult.error || null,
        executionId
      ]
    );

    return {
      success: runResult.success,
      executionId,
      status: runResult.status,
      retryCount: newRetryCount,
      affectedCount: runResult.affectedCount
    };
  }

  // =========================================================================
  // GATE 4: AUTOMATED ATTENDANCE CLOSING
  // =========================================================================
  async handleAttendanceClose(config, targetDate, executedBy) {
    // 1. Working day and holiday checks
    const [wdSetting] = await query(`SELECT setting_value FROM system_settings WHERE setting_key = 'working_days'`);
    let workingDaysConfig = null;
    if (wdSetting?.setting_value) {
      try { workingDaysConfig = JSON.parse(wdSetting.setting_value); } catch (e) {}
    }

    const holidayRows = await query(`SELECT holiday_date FROM company_holidays WHERE is_active = 1`);
    const holidaySet = new Set(holidayRows.map(h => h.holiday_date));

    if (!isWorkingDay(targetDate, workingDaysConfig, holidaySet)) {
      return {
        affectedCount: 0,
        details: { message: `${targetDate} is a non-working day or company holiday. Attendance auto-close skipped.` }
      };
    }

    // 2. Fetch active interns who started on or before targetDate and have NO attendance record
    const unmarkedInterns = await query(`
      SELECT ip.id, ip.user_id, u.first_name, u.last_name
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      WHERE ip.status = 'active'
        AND ip.start_date <= ?
        AND ip.id NOT IN (
          SELECT intern_id FROM attendance WHERE attendance_date = ?
        )
    `, [targetDate, targetDate]);

    const cutoffClosingTime = config.cutoff_closing_time || '17:00:00';
    let insertedCount = 0;

    for (const intern of unmarkedInterns) {
      await query(`
        INSERT INTO attendance (intern_id, attendance_date, check_in_time, status, late_minutes, marked_by, notes)
        VALUES (?, ?, ?, 'ABSENT', 0, ?, 'Automated end-of-day attendance closure')
        ON DUPLICATE KEY UPDATE status = status
      `, [intern.id, targetDate, cutoffClosingTime, executedBy]);

      insertedCount++;

      // Notify intern of recorded absence (Gate 10)
      await createNotification({
        userId: intern.user_id,
        type: 'attendance',
        title: 'Daily Attendance Recorded: ABSENT',
        message: `You were marked ABSENT for ${targetDate} as no check-in was registered prior to daily closing.`,
        relatedEntityType: 'attendance',
        link: '/intern/attendance'
      });
    }

    // Notify administrators if enabled
    if (config.notify_admin_on_completion && insertedCount > 0) {
      const admins = await query(`SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = 1`);
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'system',
          title: 'Daily Attendance Closed',
          message: `Daily attendance for ${targetDate} has closed. ${insertedCount} active unmarked intern(s) were recorded as ABSENT.`,
          relatedEntityType: 'attendance',
          link: '/admin/attendance'
        });
      }
    }

    return {
      affectedCount: insertedCount,
      details: {
        targetDate,
        unmarkedInternsCount: unmarkedInterns.length,
        recordedAbsences: insertedCount
      }
    };
  }

  // =========================================================================
  // GATE 5: AUTOMATED OVERDUE TASK DETECTION
  // =========================================================================
  async handleOverdueTasks(config) {
    // Find active assignments past due_date that are not submitted/completed/overdue
    const overdueAssignments = await query(`
      SELECT ta.id as assignment_id, ta.task_id, ta.intern_id, ta.due_date,
             t.title as task_title,
             ip.user_id as intern_user_id, ip.mentor_id,
             u.first_name as intern_first, u.last_name as intern_last,
             m_user.id as mentor_user_id
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      JOIN intern_profiles ip ON ta.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users m_user ON m.user_id = m_user.id
      WHERE ta.status IN ('assigned', 'in_progress')
        AND ta.due_date < NOW()
    `);

    let transitionedCount = 0;
    for (const a of overdueAssignments) {
      await query(`UPDATE task_assignments SET status = 'overdue' WHERE id = ?`, [a.assignment_id]);
      transitionedCount++;

      // Notify intern (Gate 10)
      if (config.notify_intern) {
        await createNotification({
          userId: a.intern_user_id,
          type: 'task',
          title: `Task Overdue: ${a.task_title}`,
          message: `Your assignment "${a.task_title}" was due on ${a.due_date}. Please complete and submit your deliverable immediately.`,
          relatedEntityType: 'task',
          relatedEntityId: a.task_id,
          link: '/intern/tasks'
        });
      }

      // Notify assigned mentor (Gate 12)
      if (config.notify_mentor && a.mentor_user_id) {
        await createNotification({
          userId: a.mentor_user_id,
          type: 'task',
          title: `Overdue Task Alert: ${a.intern_first} ${a.intern_last}`,
          message: `Intern ${a.intern_first} ${a.intern_last} has an overdue task: "${a.task_title}".`,
          relatedEntityType: 'task',
          relatedEntityId: a.task_id,
          link: '/admin/tasks'
        });
      }
    }

    return {
      affectedCount: transitionedCount,
      details: {
        overdueAssignmentsCount: overdueAssignments.length,
        transitionedCount
      }
    };
  }

  // =========================================================================
  // GATE 6: TRAINING & PROGRESS AUTO-PROPAGATION
  // =========================================================================
  async handleTrainingProgress(config) {
    // Check for modules where all assigned tasks have passing, completed submissions
    const activeInterns = await query(`SELECT id, user_id, track_id FROM intern_profiles WHERE status = 'active'`);
    let completedModulesCount = 0;

    for (const intern of activeInterns) {
      const modules = await query(`
        SELECT tm.id, tm.title, tm.module_code 
        FROM training_modules tm 
        WHERE tm.track_id = ? AND tm.status = 'active'
      `, [intern.track_id]);

      for (const mod of modules) {
        // Total tasks in module
        const [taskCountRow] = await query(
          `SELECT COUNT(*) as total FROM tasks WHERE module_id = ? AND status = 'published'`,
          [mod.id]
        );
        const totalTasks = taskCountRow?.total || 0;
        if (totalTasks === 0) continue;

        // Completed tasks for intern in this module
        const [completedCountRow] = await query(`
          SELECT COUNT(DISTINCT ta.task_id) as completed
          FROM task_assignments ta
          JOIN tasks t ON ta.task_id = t.id
          WHERE ta.intern_id = ? 
            AND t.module_id = ? 
            AND ta.status = 'completed'
        `, [intern.id, mod.id]);
        const completedTasks = completedCountRow?.completed || 0;

        if (completedTasks >= totalTasks) {
          // Check if already completed in curriculum_progress
          const [existingProgress] = await query(
            `SELECT id, status FROM curriculum_progress WHERE intern_id = ? AND module_name = ?`,
            [intern.id, mod.title]
          );

          if (!existingProgress || existingProgress.status !== 'completed') {
            await query(`
              INSERT INTO curriculum_progress (intern_id, module_name, status, completion_percentage, completed_at)
              VALUES (?, ?, 'completed', 100, NOW())
              ON DUPLICATE KEY UPDATE status = 'completed', completion_percentage = 100, completed_at = NOW()
            `, [intern.id, mod.title]);

            completedModulesCount++;

            if (config.notify_intern_on_module_complete) {
              await createNotification({
                userId: intern.user_id,
                type: 'system',
                title: `Curriculum Module Completed: ${mod.title}`,
                message: `Congratulations! You have completed 100% of tasks in training module "${mod.title}".`,
                relatedEntityType: 'training_module',
                relatedEntityId: mod.id,
                link: '/intern/dashboard'
              });
            }
          }
        }
      }
    }

    return {
      affectedCount: completedModulesCount,
      details: { completedModulesCount }
    };
  }

  // =========================================================================
  // GATE 7: PERFORMANCE-CYCLE REMINDERS
  // =========================================================================
  async handlePerformanceReminders(config) {
    const reminderDays = config.reminder_days_before_end || 3;

    // Find active performance periods near end_date
    const activePeriods = await query(`
      SELECT pp.* 
      FROM performance_periods pp
      WHERE pp.status = 'active'
        AND pp.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
    `, [reminderDays]);

    let remindersSent = 0;
    for (const period of activePeriods) {
      // Find unfinalized evaluations in this period
      const unfinalizedEvals = await query(`
        SELECT pe.id, pe.reviewer_id, pe.intern_id,
               u.first_name as intern_first, u.last_name as intern_last
        FROM performance_evaluations pe
        JOIN intern_profiles ip ON pe.intern_id = ip.id
        JOIN users u ON ip.user_id = u.id
        WHERE pe.period_id = ? AND pe.status IN ('draft', 'submitted')
      `, [period.id]);

      for (const ev of unfinalizedEvals) {
        await createNotification({
          userId: ev.reviewer_id,
          type: 'evaluation',
          title: `Evaluation Deadline Approaching: ${period.name}`,
          message: `Evaluation for ${ev.intern_first} ${ev.intern_last} is still unfinalized. Period "${period.name}" concludes on ${period.end_date}.`,
          relatedEntityType: 'performance_evaluation',
          relatedEntityId: ev.id,
          link: '/admin/performance'
        });
        remindersSent++;
      }
    }

    return {
      affectedCount: remindersSent,
      details: { activePeriodsCount: activePeriods.length, remindersSent }
    };
  }

  // =========================================================================
  // GATE 8: DOCUMENT EXPIRY MONITORING
  // =========================================================================
  async handleDocumentExpiry(config) {
    const warningDays = config.warning_window_days || 14;

    // 1. Mark past-due documents as expired
    let expiredCount = 0;
    if (config.auto_expire_past_due) {
      const expiredDocs = await query(`
        SELECT id, intern_id, title 
        FROM intern_documents 
        WHERE expiry_date < CURRENT_DATE 
          AND status != 'expired'
      `);

      for (const doc of expiredDocs) {
        await query(`UPDATE intern_documents SET status = 'expired' WHERE id = ?`, [doc.id]);
        expiredCount++;

        // Notify intern
        const [intern] = await query(`SELECT user_id FROM intern_profiles WHERE id = ?`, [doc.intern_id]);
        if (intern) {
          await createNotification({
            userId: intern.user_id,
            type: 'document',
            title: `Document Expired: ${doc.title}`,
            message: `Your document "${doc.title}" has expired. Please upload a renewed version for institutional compliance.`,
            relatedEntityType: 'intern_document',
            relatedEntityId: doc.id,
            link: '/intern/documents'
          });
        }
      }
    }

    // 2. Upcoming expiry warnings
    let warningCount = 0;
    const upcomingDocs = await query(`
      SELECT id, intern_id, title, expiry_date 
      FROM intern_documents 
      WHERE expiry_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
        AND status = 'verified'
    `, [warningDays]);

    for (const doc of upcomingDocs) {
      const [intern] = await query(`SELECT user_id FROM intern_profiles WHERE id = ?`, [doc.intern_id]);
      if (intern) {
        await createNotification({
          userId: intern.user_id,
          type: 'document',
          title: `Document Renewal Notice: ${doc.title}`,
          message: `Your verified document "${doc.title}" expires on ${doc.expiry_date}. Please prepare updated renewal documents.`,
          relatedEntityType: 'intern_document',
          relatedEntityId: doc.id,
          link: '/intern/documents'
        });
        warningCount++;
      }
    }

    return {
      affectedCount: expiredCount + warningCount,
      details: { expiredCount, warningCount }
    };
  }

  // =========================================================================
  // GATE 9: 4-GATE CERTIFICATE ELIGIBILITY SCANNER
  // =========================================================================
  async handleCertificateEligibility(config) {
    const passScoreThreshold = config.pass_score_threshold || 60;

    // Find all active or completed interns who do NOT yet have an issued certificate
    const interns = await query(`
      SELECT ip.id, ip.user_id, ip.intern_code, ip.track_id, ip.cohort_id, ip.status as intern_status,
             u.first_name, u.last_name, t.name as track_name
      FROM intern_profiles ip
      JOIN users u ON ip.user_id = u.id
      JOIN tracks t ON ip.track_id = t.id
      WHERE ip.id NOT IN (
        SELECT intern_id FROM certificates WHERE status = 'issued'
      )
    `);

    const eligibleList = [];

    for (const intern of interns) {
      // Gate 1: Completed or active intern status check
      const statusGate = intern.intern_status === 'completed' || intern.intern_status === 'active';

      // Gate 2: 100% curriculum tasks completed
      const [totalTasksRow] = await query(
        `SELECT COUNT(*) as total FROM tasks WHERE track_id = ? AND status = 'published'`,
        [intern.track_id]
      );
      const [completedTasksRow] = await query(
        `SELECT COUNT(DISTINCT ta.task_id) as completed 
         FROM task_assignments ta 
         JOIN tasks t ON ta.task_id = t.id 
         WHERE ta.intern_id = ? AND t.track_id = ? AND ta.status = 'completed'`,
        [intern.id, intern.track_id]
      );
      const totalTasks = totalTasksRow?.total || 0;
      const completedTasks = completedTasksRow?.completed || 0;
      const tasksGate = totalTasks > 0 && completedTasks >= totalTasks;

      // Gate 3: Finalized passing evaluation
      const [evalRow] = await query(`
        SELECT overall_score 
        FROM performance_evaluations 
        WHERE intern_id = ? AND status = 'finalized'
        ORDER BY overall_score DESC LIMIT 1
      `, [intern.id]);
      const evalGate = evalRow && parseFloat(evalRow.overall_score) >= passScoreThreshold;

      // Gate 4: Mandatory documents verified and unexpired
      const requiredTypes = await query(`SELECT id FROM document_types WHERE is_required = 1 AND status = 'active'`);
      let docsGate = true;
      if (requiredTypes.length > 0) {
        const typeIds = requiredTypes.map(r => r.id);
        const [verifiedDocsCount] = await query(`
          SELECT COUNT(DISTINCT document_type_id) as cnt
          FROM intern_documents
          WHERE intern_id = ? 
            AND document_type_id IN (${typeIds.join(',')})
            AND status = 'verified'
            AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
        `, [intern.id]);
        docsGate = (verifiedDocsCount?.cnt || 0) >= requiredTypes.length;
      }

      if (statusGate && tasksGate && evalGate && docsGate) {
        eligibleList.push({
          internId: intern.id,
          userId: intern.user_id,
          code: intern.intern_code,
          name: `${intern.first_name} ${intern.last_name}`,
          trackName: intern.track_name
        });
      }
    }

    // Notify admins if eligible interns found
    if (config.notify_admin_on_eligible && eligibleList.length > 0) {
      const admins = await query(`SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = 1`);
      for (const admin of admins) {
        await createNotification({
          userId: admin.id,
          type: 'certificate',
          title: 'Certificate Eligibility Alert',
          message: `${eligibleList.length} intern(s) have satisfied all 4 institutional qualification gates and are eligible for credential issuance.`,
          relatedEntityType: 'certificate',
          link: '/admin/certificates'
        });
      }
    }

    return {
      affectedCount: eligibleList.length,
      details: {
        scannedInternsCount: interns.length,
        eligibleCount: eligibleList.length,
        eligibleList
      }
    };
  }

  // =========================================================================
  // GATE 11: COHORT LIFECYCLE MONITORING
  // =========================================================================
  async handleCohortLifecycle(config) {
    const startReminderDays = config.start_reminder_days || 7;
    const endReminderDays = config.end_reminder_days || 7;

    // Upcoming cohorts starting soon
    const upcomingCohorts = await query(`
      SELECT c.*, t.name as track_name, m_user.id as mentor_user_id
      FROM cohorts c
      JOIN tracks t ON c.track_id = t.id
      LEFT JOIN mentors m ON c.lead_mentor_id = m.id
      LEFT JOIN users m_user ON m.user_id = m_user.id
      WHERE c.status = 'upcoming'
        AND c.start_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
    `, [startReminderDays]);

    // Active cohorts ending soon
    const endingCohorts = await query(`
      SELECT c.*, t.name as track_name, m_user.id as mentor_user_id
      FROM cohorts c
      JOIN tracks t ON c.track_id = t.id
      LEFT JOIN mentors m ON c.lead_mentor_id = m.id
      LEFT JOIN users m_user ON m.user_id = m_user.id
      WHERE c.status = 'active'
        AND c.end_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
    `, [endReminderDays]);

    let alertsCount = 0;

    for (const c of upcomingCohorts) {
      if (config.notify_lead_mentor && c.mentor_user_id) {
        await createNotification({
          userId: c.mentor_user_id,
          type: 'system',
          title: `Cohort Launch Warning: ${c.name}`,
          message: `Cohort "${c.name}" (${c.track_name}) starts on ${c.start_date}. Please review curriculum readiness.`,
          relatedEntityType: 'cohort',
          relatedEntityId: c.id,
          link: '/admin/training'
        });
        alertsCount++;
      }
    }

    for (const c of endingCohorts) {
      if (config.notify_lead_mentor && c.mentor_user_id) {
        await createNotification({
          userId: c.mentor_user_id,
          type: 'system',
          title: `Cohort Conclusion Approaching: ${c.name}`,
          message: `Cohort "${c.name}" concludes on ${c.end_date}. Finalize pending evaluations and project grades.`,
          relatedEntityType: 'cohort',
          relatedEntityId: c.id,
          link: '/admin/training'
        });
        alertsCount++;
      }
    }

    return {
      affectedCount: alertsCount,
      details: {
        upcomingCount: upcomingCohorts.length,
        endingCount: endingCohorts.length,
        alertsCount
      }
    };
  }

  // =========================================================================
  // GATE 12: MENTOR WORKLOAD & BACKLOG ESCALATION
  // =========================================================================
  async handleMentorWorkload(config) {
    const backlogHours = config.backlog_hours_threshold || 48;

    // Submissions pending review older than backlogHours
    const staleSubmissions = await query(`
      SELECT ts.id as submission_id, ts.submitted_at,
             t.title as task_title,
             u.first_name as intern_first, u.last_name as intern_last,
             m_user.id as mentor_user_id
      FROM task_submissions ts
      JOIN tasks t ON ts.task_id = t.id
      JOIN intern_profiles ip ON ts.intern_id = ip.id
      JOIN users u ON ip.user_id = u.id
      LEFT JOIN mentors m ON ip.mentor_id = m.id
      LEFT JOIN users m_user ON m.user_id = m_user.id
      WHERE ts.status IN ('submitted', 'under_review')
        AND ts.submitted_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
    `, [backlogHours]);

    let backlogAlertsSent = 0;
    for (const s of staleSubmissions) {
      if (s.mentor_user_id) {
        await createNotification({
          userId: s.mentor_user_id,
          type: 'task',
          title: 'Grading Backlog Alert: Submission Awaiting Review',
          message: `Submission by ${s.intern_first} ${s.intern_last} for "${s.task_title}" has been pending for over ${backlogHours} hours.`,
          relatedEntityType: 'task_submission',
          relatedEntityId: s.submission_id,
          link: '/admin/tasks'
        });
        backlogAlertsSent++;
      }
    }

    return {
      affectedCount: backlogAlertsSent,
      details: {
        staleSubmissionsCount: staleSubmissions.length,
        backlogAlertsSent
      }
    };
  }

  // =========================================================================
  // GATE 13: SCHEDULED REPORT AUTOMATION
  // =========================================================================
  async handleScheduledReport(config) {
    // Generate operational health snapshot
    const [userStats] = await query(`
      SELECT 
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeUsers,
        SUM(CASE WHEN role_id = 4 AND is_active = 1 THEN 1 ELSE 0 END) as activeInterns,
        SUM(CASE WHEN role_id = 3 AND is_active = 1 THEN 1 ELSE 0 END) as activeMentors
      FROM users
    `);

    const { date: today } = getLagosDate();
    const [attStats] = await query(`
      SELECT 
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as presentToday,
        SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as lateToday,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absentToday
      FROM attendance WHERE attendance_date = ?
    `, [today]);

    const [taskStats] = await query(`
      SELECT 
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdueCount,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedCount
      FROM task_assignments
    `);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      date: today,
      users: userStats || {},
      attendanceToday: attStats || {},
      tasks: taskStats || {}
    };

    // Notify administrators of report readiness
    const admins = await query(`SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = 1`);
    for (const a of admins) {
      await createNotification({
        userId: a.id,
        type: 'system',
        title: 'Weekly Management Intelligence Snapshot',
        message: `Executive operational analytics snapshot generated for ${today}. Active interns: ${userStats?.activeInterns || 0}, Overdue tasks: ${taskStats?.overdueCount || 0}.`,
        relatedEntityType: 'report',
        link: '/admin/reports'
      });
    }

    return {
      affectedCount: 1,
      details: snapshot
    };
  }

  // =========================================================================
  // GATE 14: DASHBOARD OPERATIONAL ALERTS FEED
  // =========================================================================
  async getOperationalAlerts(userRole, userId = null) {
    const alerts = [];

    // 1. Overdue tasks count
    let overdueQuery = `
      SELECT COUNT(*) as count 
      FROM task_assignments ta
      WHERE ta.status = 'overdue'
    `;
    const overdueParams = [];
    if (userRole === 'mentor' && userId) {
      overdueQuery = `
        SELECT COUNT(*) as count 
        FROM task_assignments ta
        JOIN intern_profiles ip ON ta.intern_id = ip.id
        JOIN mentors m ON ip.mentor_id = m.id
        WHERE ta.status = 'overdue' AND m.user_id = ?
      `;
      overdueParams.push(userId);
    }
    const [overdueRow] = await query(overdueQuery, overdueParams);
    const overdueCount = overdueRow?.count || 0;
    if (overdueCount > 0) {
      alerts.push({
        id: 'alert-overdue-tasks',
        category: 'tasks',
        severity: 'high',
        title: `${overdueCount} Overdue Task Assignment(s)`,
        message: 'Intern assignments have passed their authoritative due date and require follow-up.',
        link: userRole === 'intern' ? '/intern/tasks' : '/admin/tasks',
        count: overdueCount
      });
    }

    // 2. Pending mentor reviews
    let pendingReviewsQuery = `
      SELECT COUNT(*) as count 
      FROM task_submissions ts
      WHERE ts.status IN ('submitted', 'under_review')
    `;
    const pendingParams = [];
    if (userRole === 'mentor' && userId) {
      pendingReviewsQuery = `
        SELECT COUNT(*) as count 
        FROM task_submissions ts
        JOIN intern_profiles ip ON ts.intern_id = ip.id
        JOIN mentors m ON ip.mentor_id = m.id
        WHERE ts.status IN ('submitted', 'under_review') AND m.user_id = ?
      `;
      pendingParams.push(userId);
    }
    const [pendingRow] = await query(pendingReviewsQuery, pendingParams);
    const pendingCount = pendingRow?.count || 0;
    if (pendingCount > 0 && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'mentor')) {
      alerts.push({
        id: 'alert-pending-reviews',
        category: 'training',
        severity: 'medium',
        title: `${pendingCount} Submission(s) Awaiting Review`,
        message: 'Intern deliverables are pending mentor grading and evaluation feedback.',
        link: '/admin/tasks',
        count: pendingCount
      });
    }

    // 3. Expiring documents count (Admin/Super Admin or specific intern)
    if (userRole === 'super_admin' || userRole === 'admin') {
      const [expiringRow] = await query(`
        SELECT COUNT(*) as count 
        FROM intern_documents 
        WHERE expiry_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)
          AND status = 'verified'
      `);
      const expiringCount = expiringRow?.count || 0;
      if (expiringCount > 0) {
        alerts.push({
          id: 'alert-expiring-docs',
          category: 'documents',
          severity: 'warning',
          title: `${expiringCount} Document(s) Expiring Soon`,
          message: 'Institutional documents are expiring within 30 days and require renewal.',
          link: '/admin/documents',
          count: expiringCount
        });
      }
    }

    // 4. Failed automation executions needing attention (Admin only)
    if (userRole === 'super_admin' || userRole === 'admin') {
      const [failedExecRow] = await query(`
        SELECT COUNT(*) as count 
        FROM automation_executions 
        WHERE status = 'failed' 
          AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);
      const failedCount = failedExecRow?.count || 0;
      if (failedCount > 0) {
        alerts.push({
          id: 'alert-failed-automation',
          category: 'automation',
          severity: 'critical',
          title: `${failedCount} Automation Execution Failure(s)`,
          message: 'One or more automated workflows failed in the last 24 hours and require review.',
          link: '/admin/automation',
          count: failedCount
        });
      }
    }

    return alerts;
  }
}

export const automationService = new AutomationService();
export default automationService;
