import { query } from '../config/db.js';

export async function runPhase3Migration() {
  console.log('🚀 Running Phase 3 Database Migration (Training Execution Layer)...');

  try {
    // 1. Create `training_modules` table
    console.log('  Verifying `training_modules` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS training_modules (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        track_id INT UNSIGNED NOT NULL,
        title VARCHAR(150) NOT NULL,
        description TEXT NULL,
        module_code VARCHAR(50) NOT NULL,
        sequence_order INT UNSIGNED NOT NULL DEFAULT 1,
        estimated_hours INT UNSIGNED NOT NULL DEFAULT 10,
        status ENUM('draft', 'active', 'archived') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_tm_track FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        UNIQUE KEY uk_track_module_code (track_id, module_code),
        INDEX idx_tm_track (track_id),
        INDEX idx_tm_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `training_modules` table ready.');

    // 2. Augment `tasks` table with Phase 3 attributes
    console.log('  Augmenting `tasks` table attributes...');
    const taskCols = await query(`SHOW COLUMNS FROM tasks`);
    const taskColNames = taskCols.map(c => c.Field);

    if (!taskColNames.includes('module_id')) {
      await query(`ALTER TABLE tasks ADD COLUMN module_id INT UNSIGNED NULL AFTER track_id`);
      await query(`ALTER TABLE tasks ADD CONSTRAINT fk_tasks_module FOREIGN KEY (module_id) REFERENCES training_modules (id) ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log('  ✅ Added `tasks.module_id` foreign key.');
    }

    if (!taskColNames.includes('task_type')) {
      await query(`ALTER TABLE tasks ADD COLUMN task_type ENUM('assignment', 'project', 'quiz', 'practical', 'research', 'coding', 'design', 'presentation', 'other') NOT NULL DEFAULT 'assignment' AFTER module_id`);
      console.log('  ✅ Added `tasks.task_type`.');
    }

    if (!taskColNames.includes('difficulty')) {
      await query(`ALTER TABLE tasks ADD COLUMN difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'intermediate' AFTER task_type`);
      console.log('  ✅ Added `tasks.difficulty`.');
    }

    if (!taskColNames.includes('pass_score')) {
      await query(`ALTER TABLE tasks ADD COLUMN pass_score INT UNSIGNED NOT NULL DEFAULT 60 AFTER max_score`);
      console.log('  ✅ Added `tasks.pass_score`.');
    }

    if (!taskColNames.includes('estimated_hours')) {
      await query(`ALTER TABLE tasks ADD COLUMN estimated_hours INT UNSIGNED NOT NULL DEFAULT 8 AFTER pass_score`);
      console.log('  ✅ Added `tasks.estimated_hours`.');
    }

    if (!taskColNames.includes('due_days')) {
      await query(`ALTER TABLE tasks ADD COLUMN due_days INT UNSIGNED NULL AFTER estimated_hours`);
      console.log('  ✅ Added `tasks.due_days`.');
    }

    if (!taskColNames.includes('instructions')) {
      await query(`ALTER TABLE tasks ADD COLUMN instructions TEXT NULL AFTER description`);
      console.log('  ✅ Added `tasks.instructions`.');
    }

    if (!taskColNames.includes('expected_deliverable')) {
      await query(`ALTER TABLE tasks ADD COLUMN expected_deliverable VARCHAR(255) NULL AFTER instructions`);
      console.log('  ✅ Added `tasks.expected_deliverable`.');
    }

    if (!taskColNames.includes('status')) {
      await query(`ALTER TABLE tasks ADD COLUMN status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published' AFTER priority`);
      console.log('  ✅ Added `tasks.status`.');
    }

    // 3. Create `task_assignments` table
    console.log('  Verifying `task_assignments` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        task_id INT UNSIGNED NOT NULL,
        intern_id INT UNSIGNED NOT NULL,
        cohort_id INT UNSIGNED NULL,
        assigned_by INT UNSIGNED NOT NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_date DATETIME NOT NULL,
        status ENUM('assigned', 'in_progress', 'submitted', 'under_review', 'returned', 'completed', 'overdue', 'cancelled') NOT NULL DEFAULT 'assigned',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_ta_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_ta_cohort FOREIGN KEY (cohort_id) REFERENCES cohorts (id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_ta_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE KEY uk_task_intern_assignment (task_id, intern_id),
        INDEX idx_ta_status (status),
        INDEX idx_ta_intern (intern_id),
        INDEX idx_ta_cohort (cohort_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `task_assignments` table ready.');

    // 4. Augment `task_submissions` table
    console.log('  Augmenting `task_submissions` table...');
    const subCols = await query(`SHOW COLUMNS FROM task_submissions`);
    const subColNames = subCols.map(c => c.Field);

    if (!subColNames.includes('task_assignment_id')) {
      await query(`ALTER TABLE task_submissions ADD COLUMN task_assignment_id INT UNSIGNED NULL AFTER id`);
      await query(`ALTER TABLE task_submissions ADD CONSTRAINT fk_sub_ta FOREIGN KEY (task_assignment_id) REFERENCES task_assignments (id) ON DELETE CASCADE ON UPDATE CASCADE`);
      console.log('  ✅ Added `task_submissions.task_assignment_id`.');
    }

    if (!subColNames.includes('attempt_number')) {
      await query(`ALTER TABLE task_submissions ADD COLUMN attempt_number INT UNSIGNED NOT NULL DEFAULT 1 AFTER submitted_at`);
      console.log('  ✅ Added `task_submissions.attempt_number`.');
    }

    if (!subColNames.includes('attachment_path')) {
      await query(`ALTER TABLE task_submissions ADD COLUMN attachment_path VARCHAR(255) NULL AFTER submission_url`);
      console.log('  ✅ Added `task_submissions.attachment_path`.');
    }

    // Modify status enum in task_submissions to support returned, completed
    await query(`
      ALTER TABLE task_submissions
      MODIFY COLUMN status ENUM('submitted', 'under_review', 'returned', 'graded', 'completed') NOT NULL DEFAULT 'submitted'
    `);

    // 5. Create `task_reviews` table
    console.log('  Verifying `task_reviews` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS task_reviews (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        submission_id INT UNSIGNED NOT NULL,
        reviewer_id INT UNSIGNED NOT NULL,
        score DECIMAL(5, 2) NULL,
        feedback TEXT NULL,
        status ENUM('completed', 'returned') NOT NULL DEFAULT 'completed',
        reviewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tr_sub FOREIGN KEY (submission_id) REFERENCES task_submissions (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_tr_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
        INDEX idx_tr_sub (submission_id),
        INDEX idx_tr_reviewer (reviewer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `task_reviews` table ready.');

    // 6. Seed default training modules if none exist
    const [existingModules] = await query(`SELECT COUNT(*) as count FROM training_modules`);
    if (existingModules.count === 0) {
      console.log('  Seeding foundation training modules...');
      const defaultModules = [
        // Track 1: Full-Stack Software Development
        { track_id: 1, title: 'HTML5 & Responsive CSS Architecture', code: 'MOD-FSD-01', order: 1, hours: 20 },
        { track_id: 1, title: 'JavaScript ES6+ & Async Programming', code: 'MOD-FSD-02', order: 2, hours: 30 },
        { track_id: 1, title: 'React.js Component Ecosystem & State', code: 'MOD-FSD-03', order: 3, hours: 40 },
        { track_id: 1, title: 'Node.js & Express RESTful Architecture', code: 'MOD-FSD-04', order: 4, hours: 35 },
        { track_id: 1, title: 'MySQL Relational Modeling & Performance', code: 'MOD-FSD-05', order: 5, hours: 25 },
        { track_id: 1, title: 'Full-Stack Capstone System Deployment', code: 'MOD-FSD-06', order: 6, hours: 50 },

        // Track 2: UI/UX & Product Design
        { track_id: 2, title: 'Design Thinking & UX Research Methods', code: 'MOD-UXD-01', order: 1, hours: 20 },
        { track_id: 2, title: 'Information Architecture & Wireframing', code: 'MOD-UXD-02', order: 2, hours: 25 },
        { track_id: 2, title: 'Figma Mastery & Corporate Design Systems', code: 'MOD-UXD-03', order: 3, hours: 35 },
        { track_id: 2, title: 'Interactive Prototyping & Usability Testing', code: 'MOD-UXD-04', order: 4, hours: 30 },
        { track_id: 2, title: 'Design Handoff & Capstone Product Showcase', code: 'MOD-UXD-05', order: 5, hours: 40 },

        // Track 3: Cybersecurity
        { track_id: 3, title: 'Network Security & Protocol Analysis', code: 'MOD-CSH-01', order: 1, hours: 30 },
        { track_id: 3, title: 'Web Application Vulnerability Assessment', code: 'MOD-CSH-02', order: 2, hours: 35 },
        { track_id: 3, title: 'Incident Response & Defensive Hardening', code: 'MOD-CSH-03', order: 3, hours: 40 },

        // Track 4: Data Analytics
        { track_id: 4, title: 'Data Cleaning & Statistical Foundations', code: 'MOD-DAN-01', order: 1, hours: 25 },
        { track_id: 4, title: 'SQL for Business Intelligence & Warehousing', code: 'MOD-DAN-02', order: 2, hours: 35 },
        { track_id: 4, title: 'PowerBI & Interactive Executive Dashboards', code: 'MOD-DAN-03', order: 3, hours: 30 },

        // Track 5: Cloud & DevOps
        { track_id: 5, title: 'Linux System Administration & Automation', code: 'MOD-CLD-01', order: 1, hours: 25 },
        { track_id: 5, title: 'Docker Containerization & CI/CD Pipelines', code: 'MOD-CLD-02', order: 2, hours: 35 },
        { track_id: 5, title: 'Cloud Infrastructure & Kubernetes Orchestration', code: 'MOD-CLD-03', order: 3, hours: 40 }
      ];

      for (const m of defaultModules) {
        await query(`
          INSERT INTO training_modules (track_id, title, module_code, sequence_order, estimated_hours, status)
          VALUES (?, ?, ?, ?, ?, 'active')
        `, [m.track_id, m.title, m.code, m.order, m.hours]);
      }
      console.log(`  ✅ Seeded ${defaultModules.length} training modules.`);
    }

    // 7. Associate existing tasks with appropriate training modules
    console.log('  Linking existing tasks to training modules...');
    const modFsd4 = await query(`SELECT id FROM training_modules WHERE module_code = 'MOD-FSD-04'`);
    if (modFsd4.length > 0) {
      await query(`
        UPDATE tasks SET module_id = ?, task_type = 'coding', difficulty = 'intermediate', pass_score = 70, instructions = description
        WHERE id = 1 AND (module_id IS NULL OR module_id = 0)
      `, [modFsd4[0].id]);
    }

    const modFsd5 = await query(`SELECT id FROM training_modules WHERE module_code = 'MOD-FSD-05'`);
    if (modFsd5.length > 0) {
      await query(`
        UPDATE tasks SET module_id = ?, task_type = 'practical', difficulty = 'intermediate', pass_score = 65, instructions = description
        WHERE id = 2 AND (module_id IS NULL OR module_id = 0)
      `, [modFsd5[0].id]);
    }

    const modUxd3 = await query(`SELECT id FROM training_modules WHERE module_code = 'MOD-UXD-03'`);
    if (modUxd3.length > 0) {
      await query(`
        UPDATE tasks SET module_id = ?, task_type = 'design', difficulty = 'intermediate', pass_score = 70, instructions = description
        WHERE id = 3 AND (module_id IS NULL OR module_id = 0)
      `, [modUxd3[0].id]);
    }

    // 8. Backfill `task_assignments` for existing tasks and active interns
    console.log('  Backfilling `task_assignments` for active interns...');
    const existingTasks = await query(`SELECT * FROM tasks`);
    for (const t of existingTasks) {
      let internQuery = `SELECT id, cohort_id FROM intern_profiles WHERE track_id = ? AND status = 'active'`;
      let params = [t.track_id];
      if (t.cohort_id) {
        internQuery += ` AND cohort_id = ?`;
        params.push(t.cohort_id);
      }
      const interns = await query(internQuery, params);

      for (const intern of interns) {
        const existingAssigned = await query(`
          SELECT id, status FROM task_assignments WHERE task_id = ? AND intern_id = ?
        `, [t.id, intern.id]);

        let assignmentId;
        if (existingAssigned.length === 0) {
          const ins = await query(`
            INSERT INTO task_assignments (task_id, intern_id, cohort_id, assigned_by, assigned_at, due_date, status)
            VALUES (?, ?, ?, ?, ?, ?, 'assigned')
          `, [t.id, intern.id, intern.cohort_id, t.assigned_by, t.created_at, t.due_date]);
          assignmentId = ins.insertId;
        } else {
          assignmentId = existingAssigned[0].id;
        }

        const existingSub = await query(`
          SELECT id, status, score, feedback, graded_by, graded_at FROM task_submissions WHERE task_id = ? AND intern_id = ?
        `, [t.id, intern.id]);

        if (existingSub.length > 0) {
          const sub = existingSub[0];
          await query(`
            UPDATE task_submissions SET task_assignment_id = ? WHERE id = ?
          `, [assignmentId, sub.id]);

          let assignStatus = 'submitted';
          if (sub.status === 'graded' || sub.score !== null) {
            assignStatus = 'completed';
          } else if (sub.status === 'under_review') {
            assignStatus = 'under_review';
          }
          await query(`UPDATE task_assignments SET status = ? WHERE id = ?`, [assignStatus, assignmentId]);

          if (sub.graded_by && sub.score !== null) {
            const rev = await query(`SELECT id FROM task_reviews WHERE submission_id = ?`, [sub.id]);
            if (rev.length === 0) {
              await query(`
                INSERT INTO task_reviews (submission_id, reviewer_id, score, feedback, status, reviewed_at)
                VALUES (?, ?, ?, ?, 'completed', ?)
              `, [sub.id, sub.graded_by, sub.score, sub.feedback, sub.graded_at || new Date()]);
            }
          }
        }
      }
    }
    console.log('  ✅ `task_assignments` and review backfill complete.');

    console.log('🎉 Phase 3 Database Migration Completed Successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Phase 3 Migration Error:', error);
    throw error;
  }
}

// Run if called directly
runPhase3Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
