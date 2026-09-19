import { query } from '../config/db.js';

export async function runPhase9Migration() {
  console.log('🚀 Running Phase 9 Database Migration (Advanced ERP & Automation Engine)...');

  try {
    // -------------------------------------------------------------
    // 1. Create `automation_rules` Table
    // -------------------------------------------------------------
    console.log('  Creating `automation_rules` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        rule_code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        description TEXT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'operations',
        trigger_type ENUM('schedule', 'event', 'manual') NOT NULL DEFAULT 'schedule',
        schedule_interval VARCHAR(50) NOT NULL DEFAULT 'daily',
        action_type VARCHAR(100) NOT NULL,
        config JSON NULL,
        is_enabled TINYINT(1) NOT NULL DEFAULT 1,
        last_run_at DATETIME NULL,
        next_run_at DATETIME NULL,
        created_by INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_ar_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
        INDEX idx_ar_code (rule_code),
        INDEX idx_ar_category (category),
        INDEX idx_ar_enabled (is_enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // -------------------------------------------------------------
    // 2. Create `automation_executions` Table
    // -------------------------------------------------------------
    console.log('  Creating `automation_executions` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS automation_executions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        rule_id INT UNSIGNED NOT NULL,
        rule_code VARCHAR(64) NOT NULL,
        trigger_type VARCHAR(30) NOT NULL DEFAULT 'manual',
        idempotency_key VARCHAR(128) NOT NULL,
        status ENUM('pending', 'running', 'completed', 'failed', 'skipped', 'retrying') NOT NULL DEFAULT 'pending',
        start_time DATETIME NOT NULL,
        completion_time DATETIME NULL,
        retry_count INT UNSIGNED NOT NULL DEFAULT 0,
        max_retries INT UNSIGNED NOT NULL DEFAULT 3,
        affected_count INT UNSIGNED NOT NULL DEFAULT 0,
        details JSON NULL,
        error_message TEXT NULL,
        executed_by INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ae_rule FOREIGN KEY (rule_id) REFERENCES automation_rules (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_ae_executor FOREIGN KEY (executed_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
        INDEX idx_ae_rule_id (rule_id),
        INDEX idx_ae_status (status),
        INDEX idx_ae_key (idempotency_key),
        INDEX idx_ae_start (start_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // -------------------------------------------------------------
    // 3. Seed Canonical Automation Rules
    // -------------------------------------------------------------
    console.log('  Seeding canonical enterprise automation rules...');
    const canonicalRules = [
      {
        rule_code: 'AUTO_ATTENDANCE_CLOSE',
        name: 'Daily Attendance Closing & Unmarked Absent Automation',
        description: 'Evaluates daily attendance at closing cutoff (17:00 Lagos time). Excludes non-working days and holidays. Marks unmarked active interns as ABSENT with idempotent non-overwriting query.',
        category: 'attendance',
        trigger_type: 'schedule',
        schedule_interval: 'daily',
        action_type: 'CLOSE_DAILY_ATTENDANCE',
        config: JSON.stringify({
          cutoff_closing_time: '17:00:00',
          timezone: 'Africa/Lagos',
          exclude_holidays: true,
          exclude_weekends: true,
          notify_admin_on_completion: true
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_OVERDUE_TASKS',
        name: 'Overdue Task Detection & Escalation Engine',
        description: 'Scans active task assignments past due date. Transitions status to overdue and dispatches alerts to intern and supervising mentor without duplicating existing notifications.',
        category: 'tasks',
        trigger_type: 'schedule',
        schedule_interval: 'hourly',
        action_type: 'DETECT_OVERDUE_TASKS',
        config: JSON.stringify({
          grace_period_minutes: 0,
          notify_intern: true,
          notify_mentor: true,
          priority_threshold: 'high'
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_TRAINING_PROGRESS',
        name: 'Curriculum & Module Progress Auto-Propagation',
        description: 'Scans completed submissions across curriculum tasks. When 100% of tasks for a training module pass, automatically marks the module completed in curriculum progress.',
        category: 'training',
        trigger_type: 'event',
        schedule_interval: 'realtime',
        action_type: 'PROPAGATE_TRAINING_PROGRESS',
        config: JSON.stringify({
          auto_complete_module: true,
          notify_intern_on_module_complete: true,
          notify_mentor_on_module_complete: false
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_PERF_REMINDERS',
        name: 'Performance Cycle Review Reminders',
        description: 'Monitors active performance evaluation periods. Dispatches reminder notifications to reviewers when pending evaluations approach period deadlines. Never fabricates scores.',
        category: 'performance',
        trigger_type: 'schedule',
        schedule_interval: 'daily',
        action_type: 'SEND_PERFORMANCE_REMINDERS',
        config: JSON.stringify({
          reminder_days_before_end: 3,
          notify_unfinalized_reviewers: true
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_DOC_EXPIRY',
        name: 'Document Expiry Monitoring & Renewal Alerts',
        description: 'Detects upcoming document expirations within the notification window (14 days) and automatically transitions past-due documents to expired status.',
        category: 'documents',
        trigger_type: 'schedule',
        schedule_interval: 'daily',
        action_type: 'MONITOR_DOCUMENT_EXPIRY',
        config: JSON.stringify({
          warning_window_days: 14,
          auto_expire_past_due: true,
          notify_intern: true,
          notify_admin: false
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_CERT_ELIGIBILITY',
        name: '4-Gate Certificate Qualification Scanner',
        description: 'Evaluates interns against the 4 authoritative eligibility gates (Completed intern, 100% curriculum tasks passed, Finalized passing evaluation, Verified unexpired documents) and alerts admins.',
        category: 'certificates',
        trigger_type: 'schedule',
        schedule_interval: 'daily',
        action_type: 'SCAN_CERTIFICATE_ELIGIBILITY',
        config: JSON.stringify({
          pass_score_threshold: 60,
          notify_admin_on_eligible: true,
          auto_issue: false
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_COHORT_LIFECYCLE',
        name: 'Cohort Lifecycle Scheduling & Completion Alerts',
        description: 'Monitors upcoming cohort start dates and active cohort conclusion dates to alert lead mentors and administrators of key transition milestones.',
        category: 'cohorts',
        trigger_type: 'schedule',
        schedule_interval: 'daily',
        action_type: 'MONITOR_COHORT_LIFECYCLE',
        config: JSON.stringify({
          start_reminder_days: 7,
          end_reminder_days: 7,
          notify_lead_mentor: true,
          notify_admin: true
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_MENTOR_WORKLOAD',
        name: 'Mentor Submission Review Backlog Escalation',
        description: 'Identifies submissions awaiting mentor review for over 48 hours and sends reminder alerts to the assigned mentor to prevent grading bottlenecks.',
        category: 'mentors',
        trigger_type: 'schedule',
        schedule_interval: 'daily',
        action_type: 'ESCALATE_MENTOR_BACKLOG',
        config: JSON.stringify({
          backlog_hours_threshold: 48,
          notify_assigned_mentor_only: true
        }),
        is_enabled: 1
      },
      {
        rule_code: 'AUTO_SCHEDULED_REPORT',
        name: 'Scheduled Executive Management Intelligence Snapshot',
        description: 'Generates weekly executive analytics snapshots capturing attendance rates, task completion counts, and cohort performance metrics.',
        category: 'reports',
        trigger_type: 'schedule',
        schedule_interval: 'weekly',
        action_type: 'GENERATE_SCHEDULED_REPORT',
        config: JSON.stringify({
          report_type: 'executive_weekly',
          recipient_roles: ['super_admin', 'admin'],
          include_metrics: ['attendance', 'tasks', 'performance']
        }),
        is_enabled: 1
      }
    ];

    for (const rule of canonicalRules) {
      await query(`
        INSERT INTO automation_rules (rule_code, name, description, category, trigger_type, schedule_interval, action_type, config, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          category = VALUES(category),
          trigger_type = VALUES(trigger_type),
          schedule_interval = VALUES(schedule_interval),
          action_type = VALUES(action_type),
          config = VALUES(config),
          is_enabled = VALUES(is_enabled)
      `, [
        rule.rule_code,
        rule.name,
        rule.description,
        rule.category,
        rule.trigger_type,
        rule.schedule_interval,
        rule.action_type,
        rule.config,
        rule.is_enabled
      ]);
    }

    // -------------------------------------------------------------
    // 4. Register Phase 9 Canonical Permissions (RBAC Matrix)
    // -------------------------------------------------------------
    console.log('  Registering Phase 9 automation permissions...');
    const automationPerms = [
      { module: 'automation', action: 'read', slug: 'automation:read', description: 'View automation rules, execution logs, and system alerts' },
      { module: 'automation', action: 'write', slug: 'automation:write', description: 'Update automation rule configurations and thresholds' },
      { module: 'automation', action: 'trigger', slug: 'automation:trigger', description: 'Manually trigger automation workflows (Run Now)' },
      { module: 'automation', action: 'retry', slug: 'automation:retry', description: 'Retry failed automation executions' }
    ];

    for (const perm of automationPerms) {
      await query(`
        INSERT INTO permissions (module, action, slug, description)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE description = VALUES(description)
      `, [perm.module, perm.action, perm.slug, perm.description]);
    }

    // Grant all automation permissions to super_admin (1) and admin (2)
    const permRows = await query(`SELECT id FROM permissions WHERE module = 'automation'`);
    for (const p of permRows) {
      await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, ?)`, [p.id]);
      await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (2, ?)`, [p.id]);
    }

    console.log('✅ Phase 9 Database Migration Complete: Tables, Rules, and Permissions Seeded.');
    return { success: true };
  } catch (error) {
    console.error('❌ Phase 9 Migration Failed:', error);
    throw error;
  }
}

// Direct CLI execution
if (process.argv[1]?.endsWith('migrate_phase9.js')) {
  runPhase9Migration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
