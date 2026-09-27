import { query } from '../config/db.js';

export async function runPhase13Migration() {
  console.log('🚀 Running Phase 13 Database Migration (Intern Attendance Schedule & Permission Workflow)...');

  try {
    // 1. Check if schedule_days and schedule_locked columns exist on intern_profiles table
    const internCols = await query('SHOW COLUMNS FROM intern_profiles');
    const internColNames = internCols.map(c => c.Field);

    if (!internColNames.includes('schedule_days')) {
      console.log('  Adding `schedule_days` JSON column to `intern_profiles` table...');
      await query(`
        ALTER TABLE intern_profiles
        ADD COLUMN schedule_days JSON NULL DEFAULT NULL AFTER notes
      `);
      console.log('  ✅ Column `schedule_days` added to `intern_profiles`.');
    } else {
      console.log('  ℹ️ Column `schedule_days` already exists on `intern_profiles`.');
    }

    if (!internColNames.includes('schedule_locked')) {
      console.log('  Adding `schedule_locked` TINYINT(1) column to `intern_profiles` table...');
      await query(`
        ALTER TABLE intern_profiles
        ADD COLUMN schedule_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER schedule_days
      `);
      console.log('  ✅ Column `schedule_locked` added to `intern_profiles`.');
    } else {
      console.log('  ℹ️ Column `schedule_locked` already exists on `intern_profiles`.');
    }

    // 2. Create permission_requests table
    console.log('  Creating `permission_requests` table if not exists...');
    await query(`
      CREATE TABLE IF NOT EXISTS permission_requests (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        intern_id INT UNSIGNED NOT NULL,
        request_code VARCHAR(50) NOT NULL UNIQUE,
        request_type VARCHAR(50) NOT NULL DEFAULT 'absence',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        affected_days_count INT UNSIGNED NOT NULL DEFAULT 0,
        affected_dates JSON NOT NULL,
        reason VARCHAR(255) NOT NULL,
        message TEXT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
        mentor_review_status ENUM('PENDING', 'APPROVED', 'REJECTED', 'RECOMMENDED') NOT NULL DEFAULT 'PENDING',
        mentor_review_notes TEXT NULL,
        reviewed_by_mentor_id INT UNSIGNED NULL,
        mentor_reviewed_at DATETIME NULL,
        final_review_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        final_review_notes TEXT NULL,
        reviewed_by_user_id INT UNSIGNED NULL,
        final_reviewed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_perm_intern FOREIGN KEY (intern_id) REFERENCES intern_profiles (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_perm_mentor FOREIGN KEY (reviewed_by_mentor_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_perm_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
        INDEX idx_perm_intern (intern_id),
        INDEX idx_perm_status (status),
        INDEX idx_perm_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `permission_requests` table ready.');

    console.log('🎉 Phase 13 Database Migration completed successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Phase 13 Migration Error:', error);
    throw error;
  }
}

// Allow direct execution
if (process.argv[1]?.endsWith('migrate_phase13.js')) {
  runPhase13Migration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
