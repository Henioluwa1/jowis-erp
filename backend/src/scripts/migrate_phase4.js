import { query } from '../config/db.js';

export async function runPhase4Migration() {
  console.log('🚀 Running Phase 4 Database Migration (Performance & Evaluation Engine)...');

  try {
    // 1. Create `performance_periods` table
    console.log('  Verifying `performance_periods` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS performance_periods (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('draft', 'active', 'closed', 'archived') NOT NULL DEFAULT 'draft',
        created_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_pp_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        INDEX idx_pp_status (status),
        INDEX idx_pp_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `performance_periods` table ready.');

    // 2. Create `performance_criteria` table
    console.log('  Verifying `performance_criteria` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS performance_criteria (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        category ENUM('technical', 'delivery', 'behavioral', 'leadership', 'communication', 'general') NOT NULL DEFAULT 'technical',
        weight DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        max_score DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        order_index INT UNSIGNED NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pc_status (status),
        INDEX idx_pc_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `performance_criteria` table ready.');

    // 3. Create `performance_rating_bands` table
    console.log('  Verifying `performance_rating_bands` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS performance_rating_bands (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        min_score DECIMAL(5, 2) NOT NULL,
        max_score DECIMAL(5, 2) NOT NULL,
        color VARCHAR(20) NOT NULL DEFAULT 'emerald',
        description TEXT NULL,
        order_index INT UNSIGNED NOT NULL DEFAULT 1,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prb_scores (min_score, max_score)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `performance_rating_bands` table ready.');

    // 4. Augment `performance_evaluations` table
    console.log('  Augmenting `performance_evaluations` table...');
    const evalCols = await query(`SHOW COLUMNS FROM performance_evaluations`);
    const evalColNames = evalCols.map(c => c.Field);

    if (!evalColNames.includes('period_id')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN period_id INT UNSIGNED NULL AFTER intern_id`);
      await query(`ALTER TABLE performance_evaluations ADD CONSTRAINT fk_pe_period FOREIGN KEY (period_id) REFERENCES performance_periods (id) ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log('  ✅ Added `performance_evaluations.period_id`.');
    }

    if (!evalColNames.includes('reviewer_id')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN reviewer_id INT UNSIGNED NULL AFTER period_id`);
      await query(`UPDATE performance_evaluations SET reviewer_id = evaluator_id WHERE reviewer_id IS NULL AND evaluator_id IS NOT NULL`);
      await query(`ALTER TABLE performance_evaluations MODIFY COLUMN reviewer_id INT UNSIGNED NOT NULL`);
      await query(`ALTER TABLE performance_evaluations ADD CONSTRAINT fk_pe_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE`);
      console.log('  ✅ Added `performance_evaluations.reviewer_id`.');
    }

    if (!evalColNames.includes('cohort_id')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN cohort_id INT UNSIGNED NULL AFTER reviewer_id`);
      await query(`ALTER TABLE performance_evaluations ADD CONSTRAINT fk_pe_cohort FOREIGN KEY (cohort_id) REFERENCES cohorts (id) ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log('  ✅ Added `performance_evaluations.cohort_id`.');
    }

    if (!evalColNames.includes('track_id')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN track_id INT UNSIGNED NULL AFTER cohort_id`);
      await query(`ALTER TABLE performance_evaluations ADD CONSTRAINT fk_pe_track FOREIGN KEY (track_id) REFERENCES tracks (id) ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log('  ✅ Added `performance_evaluations.track_id`.');
    }

    if (!evalColNames.includes('status')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN status ENUM('draft', 'submitted', 'reviewed', 'finalized') NOT NULL DEFAULT 'finalized' AFTER evaluation_period`);
      console.log('  ✅ Added `performance_evaluations.status`.');
    }

    if (!evalColNames.includes('overall_rating')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN overall_rating VARCHAR(50) NULL AFTER overall_score`);
      console.log('  ✅ Added `performance_evaluations.overall_rating`.');
    }

    if (!evalColNames.includes('strengths')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN strengths TEXT NULL AFTER overall_rating`);
      console.log('  ✅ Added `performance_evaluations.strengths`.');
    }

    if (!evalColNames.includes('areas_for_improvement')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN areas_for_improvement TEXT NULL AFTER strengths`);
      console.log('  ✅ Added `performance_evaluations.areas_for_improvement`.');
    }

    if (!evalColNames.includes('reviewer_comments')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN reviewer_comments TEXT NULL AFTER areas_for_improvement`);
      console.log('  ✅ Added `performance_evaluations.reviewer_comments`.');
    }

    if (!evalColNames.includes('intern_comments')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN intern_comments TEXT NULL AFTER reviewer_comments`);
      console.log('  ✅ Added `performance_evaluations.intern_comments`.');
    }

    if (!evalColNames.includes('submitted_at')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN submitted_at DATETIME NULL AFTER intern_comments`);
      console.log('  ✅ Added `performance_evaluations.submitted_at`.');
    }

    if (!evalColNames.includes('reviewed_at')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN reviewed_at DATETIME NULL AFTER submitted_at`);
      console.log('  ✅ Added `performance_evaluations.reviewed_at`.');
    }

    if (!evalColNames.includes('finalized_at')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN finalized_at DATETIME NULL AFTER reviewed_at`);
      console.log('  ✅ Added `performance_evaluations.finalized_at`.');
    }

    if (!evalColNames.includes('finalized_by')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN finalized_by INT UNSIGNED NULL AFTER finalized_at`);
      await query(`ALTER TABLE performance_evaluations ADD CONSTRAINT fk_pe_finalized_by FOREIGN KEY (finalized_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log('  ✅ Added `performance_evaluations.finalized_by`.');
    }

    if (!evalColNames.includes('is_locked')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER finalized_by`);
      console.log('  ✅ Added `performance_evaluations.is_locked`.');
    }

    if (!evalColNames.includes('amendment_reason')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN amendment_reason TEXT NULL AFTER is_locked`);
      console.log('  ✅ Added `performance_evaluations.amendment_reason`.');
    }

    if (!evalColNames.includes('amended_by')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN amended_by INT UNSIGNED NULL AFTER amendment_reason`);
      await query(`ALTER TABLE performance_evaluations ADD CONSTRAINT fk_pe_amended_by FOREIGN KEY (amended_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log('  ✅ Added `performance_evaluations.amended_by`.');
    }

    if (!evalColNames.includes('amended_at')) {
      await query(`ALTER TABLE performance_evaluations ADD COLUMN amended_at DATETIME NULL AFTER amended_by`);
      console.log('  ✅ Added `performance_evaluations.amended_at`.');
    }

    // Check unique index on (intern_id, period_id)
    const indexes = await query(`SHOW INDEX FROM performance_evaluations WHERE Key_name = 'uk_pe_intern_period'`);
    if (indexes.length === 0) {
      await query(`ALTER TABLE performance_evaluations ADD UNIQUE KEY uk_pe_intern_period (intern_id, period_id)`);
      console.log('  ✅ Added unique constraint `uk_pe_intern_period`.');
    }

    // 5. Create `evaluation_scores` table
    console.log('  Verifying `evaluation_scores` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS evaluation_scores (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        evaluation_id INT UNSIGNED NOT NULL,
        criterion_id INT UNSIGNED NOT NULL,
        score DECIMAL(5, 2) NOT NULL,
        max_score DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
        weight DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        weighted_score DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
        comments TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_es_eval FOREIGN KEY (evaluation_id) REFERENCES performance_evaluations (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_es_criterion FOREIGN KEY (criterion_id) REFERENCES performance_criteria (id) ON DELETE RESTRICT ON UPDATE CASCADE,
        UNIQUE KEY uk_eval_criterion (evaluation_id, criterion_id),
        INDEX idx_es_eval (evaluation_id),
        INDEX idx_es_criterion (criterion_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `evaluation_scores` table ready.');

    // 6. Seed Foundation Performance Criteria (Total: 100.00%)
    const [existingCrit] = await query(`SELECT COUNT(*) as count FROM performance_criteria`);
    if (existingCrit.count === 0) {
      console.log('  Seeding foundation performance criteria...');
      const defaultCriteria = [
        {
          name: 'Technical Competence & Architecture',
          description: 'Mastery of track technologies, sound architectural decisions, and application of engineering best practices.',
          category: 'technical',
          weight: 25.00,
          max_score: 100.00,
          order_index: 1
        },
        {
          name: 'Code Quality & Problem Solving',
          description: 'Writing maintainable, clean, tested code and demonstrating strong analytical debugging abilities.',
          category: 'technical',
          weight: 25.00,
          max_score: 100.00,
          order_index: 2
        },
        {
          name: 'Execution & Milestone Delivery',
          description: 'Timely delivery of technical tasks, attention to specifications, and milestone completion velocity.',
          category: 'delivery',
          weight: 20.00,
          max_score: 100.00,
          order_index: 3
        },
        {
          name: 'Professional Communication & Collaboration',
          description: 'Clarity in technical documentation, constructive peer reviews, and effective teamwork with mentors.',
          category: 'communication',
          weight: 15.00,
          max_score: 100.00,
          order_index: 4
        },
        {
          name: 'Initiative & Continuous Learning',
          description: 'Proactiveness in exploring advanced topics, self-directed research, and receptive response to mentor feedback.',
          category: 'behavioral',
          weight: 15.00,
          max_score: 100.00,
          order_index: 5
        }
      ];

      for (const c of defaultCriteria) {
        await query(`
          INSERT INTO performance_criteria (name, description, category, weight, max_score, status, order_index)
          VALUES (?, ?, ?, ?, ?, 'active', ?)
        `, [c.name, c.description, c.category, c.weight, c.max_score, c.order_index]);
      }
      console.log(`  ✅ Seeded ${defaultCriteria.length} evaluation criteria (totaling 100% weight).`);
    }

    // 7. Seed Performance Rating Bands
    const [existingBands] = await query(`SELECT COUNT(*) as count FROM performance_rating_bands`);
    if (existingBands.count === 0) {
      console.log('  Seeding performance rating outcome bands...');
      const defaultBands = [
        { name: 'Outstanding', min: 90.00, max: 100.00, color: 'emerald', description: 'Consistently surpasses professional standards in technical execution and leadership.', order_index: 1 },
        { name: 'Exceeds Expectations', min: 80.00, max: 89.99, color: 'brand', description: 'Regularly exceeds expected milestones with high code quality and autonomy.', order_index: 2 },
        { name: 'Meets Expectations', min: 70.00, max: 79.99, color: 'sky', description: 'Demonstrates solid proficiency, delivers on schedule, and meets technical requirements.', order_index: 3 },
        { name: 'Needs Improvement', min: 60.00, max: 69.99, color: 'amber', description: 'Requires additional mentorship and deliberate practice on core competencies.', order_index: 4 },
        { name: 'Unsatisfactory', min: 0.00, max: 59.99, color: 'rose', description: 'Performance falls significantly below professional internship expectations.', order_index: 5 }
      ];

      for (const b of defaultBands) {
        await query(`
          INSERT INTO performance_rating_bands (name, min_score, max_score, color, description, order_index, status)
          VALUES (?, ?, ?, ?, ?, ?, 'active')
        `, [b.name, b.min, b.max, b.color, b.description, b.order_index]);
      }
      console.log(`  ✅ Seeded ${defaultBands.length} performance rating bands.`);
    }

    // 8. Seed Foundation Performance Periods
    const [existingPeriods] = await query(`SELECT COUNT(*) as count FROM performance_periods`);
    let activePeriodId;
    let closedPeriodId;

    if (existingPeriods.count === 0) {
      console.log('  Seeding foundation performance periods...');
      const p1 = await query(`
        INSERT INTO performance_periods (name, description, start_date, end_date, status, created_by)
        VALUES ('August 2026 Monthly Review', 'Mid-program performance review for Q3 cohort batches.', '2026-08-01', '2026-08-31', 'closed', 1)
      `);
      closedPeriodId = p1.insertId;

      const p2 = await query(`
        INSERT INTO performance_periods (name, description, start_date, end_date, status, created_by)
        VALUES ('Q3 2026 Evaluation Cycle', 'Comprehensive quarterly technical and behavioral evaluation cycle.', '2026-07-01', '2026-09-30', 'active', 1)
      `);
      activePeriodId = p2.insertId;

      console.log(`  ✅ Seeded 2 performance periods (Closed ID: ${closedPeriodId}, Active ID: ${activePeriodId}).`);
    } else {
      const periods = await query(`SELECT id, status FROM performance_periods ORDER BY id ASC`);
      closedPeriodId = periods[0].id;
      const active = periods.find(p => p.status === 'active');
      activePeriodId = active ? active.id : periods[0].id;
    }

    // 9. Backfill and align existing evaluation records
    console.log('  Aligning existing performance evaluations with periods and criteria...');
    const existingEvals = await query(`SELECT * FROM performance_evaluations`);
    const criteriaList = await query(`SELECT id, weight, max_score FROM performance_criteria WHERE status = 'active' ORDER BY order_index ASC`);

    for (const ev of existingEvals) {
      const pid = ev.period_id || closedPeriodId;
      const [intern] = await query(`SELECT track_id, cohort_id FROM intern_profiles WHERE id = ?`, [ev.intern_id]);

      let rating = ev.overall_rating;
      if (!rating) {
        const numScore = parseFloat(ev.overall_score || 80);
        if (numScore >= 90) rating = 'Outstanding';
        else if (numScore >= 80) rating = 'Exceeds Expectations';
        else if (numScore >= 70) rating = 'Meets Expectations';
        else if (numScore >= 60) rating = 'Needs Improvement';
        else rating = 'Unsatisfactory';
      }

      await query(`
        UPDATE performance_evaluations
        SET period_id = ?,
            reviewer_id = COALESCE(reviewer_id, evaluator_id, 1),
            track_id = ?,
            cohort_id = ?,
            status = 'finalized',
            overall_rating = ?,
            strengths = COALESCE(strengths, 'Demonstrates strong technical foundations, solid grasp of core stack, and consistent execution.'),
            areas_for_improvement = COALESCE(areas_for_improvement, 'Deepen hands-on knowledge in end-to-end integration testing and microservices design.'),
            reviewer_comments = COALESCE(reviewer_comments, summary_feedback, 'Recommended for continued progression in current track.'),
            finalized_at = COALESCE(finalized_at, created_at),
            finalized_by = COALESCE(finalized_by, evaluator_id, 1),
            is_locked = 1
        WHERE id = ?
      `, [pid, intern?.track_id || 1, intern?.cohort_id || 1, rating, ev.id]);

      // Seed child evaluation scores if none exist
      const existingScores = await query(`SELECT id FROM evaluation_scores WHERE evaluation_id = ?`, [ev.id]);
      if (existingScores.length === 0 && criteriaList.length > 0) {
        for (const crit of criteriaList) {
          const scoreVal = parseFloat(ev.overall_score || 85);
          const weightedScore = (scoreVal / crit.max_score) * crit.weight;

          await query(`
            INSERT INTO evaluation_scores (evaluation_id, criterion_id, score, max_score, weight, weighted_score, comments)
            VALUES (?, ?, ?, ?, ?, ?, 'Evaluated in line with overall competency.')
          `, [ev.id, crit.id, scoreVal, crit.max_score, crit.weight, weightedScore]);
        }
      }
    }
    console.log('  ✅ Historical evaluations aligned and child criteria scores established.');

    console.log('🎉 Phase 4 Database Migration Completed Successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Phase 4 Migration Error:', error);
    throw error;
  }
}

// Run if called directly
runPhase4Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
