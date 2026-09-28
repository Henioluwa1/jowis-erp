import pool, { query } from '../config/db.js';

async function migrate() {
  console.log('Running Onboarding & Profile Schema Migration...');
  try {
    // 1. Add columns to mentors table if not exist
    const mentorCols = await query('DESCRIBE mentors');
    const mColNames = mentorCols.map(c => c.Field);

    if (!mColNames.includes('address')) {
      console.log('Adding address column to mentors...');
      await query('ALTER TABLE mentors ADD COLUMN address TEXT NULL AFTER specialization');
    }
    if (!mColNames.includes('phone')) {
      console.log('Adding phone column to mentors...');
      await query('ALTER TABLE mentors ADD COLUMN phone VARCHAR(50) NULL AFTER address');
    }
    if (!mColNames.includes('teaching_subjects')) {
      console.log('Adding teaching_subjects column to mentors...');
      await query('ALTER TABLE mentors ADD COLUMN teaching_subjects TEXT NULL AFTER bio');
    }
    if (!mColNames.includes('qualifications')) {
      console.log('Adding qualifications column to mentors...');
      await query('ALTER TABLE mentors ADD COLUMN qualifications TEXT NULL AFTER teaching_subjects');
    }
    if (!mColNames.includes('credentials_url')) {
      console.log('Adding credentials_url column to mentors...');
      await query('ALTER TABLE mentors ADD COLUMN credentials_url VARCHAR(255) NULL AFTER qualifications');
    }
    if (!mColNames.includes('onboarding_completed')) {
      console.log('Adding onboarding_completed column to mentors...');
      await query('ALTER TABLE mentors ADD COLUMN onboarding_completed TINYINT(1) DEFAULT 0 AFTER credentials_url');
    }

    // 2. Add onboarding_completed to intern_profiles if not exist
    const internCols = await query('DESCRIBE intern_profiles');
    const iColNames = internCols.map(c => c.Field);
    if (!iColNames.includes('onboarding_completed')) {
      console.log('Adding onboarding_completed column to intern_profiles...');
      await query('ALTER TABLE intern_profiles ADD COLUMN onboarding_completed TINYINT(1) DEFAULT 0 AFTER schedule_locked');
    }

    console.log('✓ Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
