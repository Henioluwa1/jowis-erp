import { query } from '../config/db.js';

export async function runPhase2Migration() {
  console.log('🚀 Running Phase 2 Database Migration...');

  try {
    // 1. Add `code` to `tracks` if not present
    const trackCols = await query(`SHOW COLUMNS FROM tracks LIKE 'code'`);
    if (trackCols.length === 0) {
      console.log('  Adding `code` column to `tracks`...');
      await query(`ALTER TABLE tracks ADD COLUMN code VARCHAR(50) NULL AFTER name`);

      // Populate existing track codes from mapping
      const trackCodeMap = {
        1: 'TRK-FSD',
        2: 'TRK-UXD',
        3: 'TRK-CSH',
        4: 'TRK-DAN',
        5: 'TRK-CLD'
      };

      for (const [id, code] of Object.entries(trackCodeMap)) {
        await query(`UPDATE tracks SET code = ? WHERE id = ?`, [code, id]);
      }

      // Fallback for any other tracks
      await query(`UPDATE tracks SET code = CONCAT('TRK-', UPPER(SUBSTRING(REPLACE(slug, '-', ''), 1, 6))) WHERE code IS NULL OR code = ''`);

      // Set NOT NULL and UNIQUE
      await query(`ALTER TABLE tracks MODIFY COLUMN code VARCHAR(50) NOT NULL`);
      await query(`ALTER TABLE tracks ADD UNIQUE INDEX idx_tracks_code (code)`);
      console.log('  ✅ `code` column added and indexed on `tracks`.');
    } else {
      console.log('  ℹ️ `tracks.code` already exists.');
    }

    // 2. Add `cohort_code` and `description` to `cohorts` if not present
    const cohortCols = await query(`SHOW COLUMNS FROM cohorts LIKE 'cohort_code'`);
    if (cohortCols.length === 0) {
      console.log('  Adding `cohort_code` and `description` columns to `cohorts`...');
      await query(`ALTER TABLE cohorts ADD COLUMN cohort_code VARCHAR(50) NULL AFTER name`);
      await query(`ALTER TABLE cohorts ADD COLUMN description TEXT NULL AFTER capacity`);

      // Populate existing cohort codes
      const cohortCodeMap = {
        1: 'COH-2026-A',
        2: 'COH-2026-B',
        3: 'COH-2025-Q4'
      };

      for (const [id, code] of Object.entries(cohortCodeMap)) {
        await query(`UPDATE cohorts SET cohort_code = ? WHERE id = ?`, [code, id]);
      }

      await query(`UPDATE cohorts SET cohort_code = CONCAT('COH-', UPPER(SUBSTRING(REPLACE(name, ' ', '-'), 1, 8))) WHERE cohort_code IS NULL OR cohort_code = ''`);

      // Set NOT NULL and UNIQUE
      await query(`ALTER TABLE cohorts MODIFY COLUMN cohort_code VARCHAR(50) NOT NULL`);
      await query(`ALTER TABLE cohorts ADD UNIQUE INDEX idx_cohorts_code (cohort_code)`);
      console.log('  ✅ `cohort_code` and `description` added to `cohorts`.');
    } else {
      console.log('  ℹ️ `cohorts.cohort_code` already exists.');
    }

    // 3. Create `intern_assignment_history` table
    console.log('  Verifying `intern_assignment_history` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS intern_assignment_history (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        intern_id INT UNSIGNED NOT NULL,
        assignment_type ENUM('track', 'cohort', 'mentor') NOT NULL,
        previous_id INT UNSIGNED NULL,
        new_id INT UNSIGNED NOT NULL,
        previous_name VARCHAR(150) NULL,
        new_name VARCHAR(150) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        changed_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_iah_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_iah_changer FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
        INDEX idx_iah_intern (intern_id),
        INDEX idx_iah_type (assignment_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `intern_assignment_history` ready.');

    // 4. Create `intern_lifecycle_history` table
    console.log('  Verifying `intern_lifecycle_history` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS intern_lifecycle_history (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        intern_id INT UNSIGNED NOT NULL,
        previous_status VARCHAR(50) NULL,
        new_status VARCHAR(50) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        changed_by INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ilh_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_ilh_changer FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
        INDEX idx_ilh_intern (intern_id),
        INDEX idx_ilh_status (new_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `intern_lifecycle_history` ready.');

    console.log('🎉 Phase 2 Database Migration Completed Successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Migration Error:', error);
    throw error;
  }
}

// Run standalone if executed directly
runPhase2Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
