import { query } from '../config/db.js';

export async function runPhase12Migration() {
  console.log('🚀 Running Phase 12 Database Migration (User Account Provisioning & First-Login Onboarding)...');

  try {
    // 1. Check if must_change_password column exists on users table
    const columns = await query('SHOW COLUMNS FROM users');
    const columnNames = columns.map(c => c.Field);

    if (!columnNames.includes('must_change_password')) {
      console.log('  Adding `must_change_password` TINYINT(1) column to `users` table...');
      await query(`
        ALTER TABLE users
        ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active
      `);
      console.log('  ✅ Column `must_change_password` successfully added to `users`.');
    } else {
      console.log('  ℹ️ Column `must_change_password` already exists on `users`.');
    }

    // 2. Ensure existing users have must_change_password = 0 so existing accounts are unaffected
    await query(`
      UPDATE users SET must_change_password = 0 WHERE must_change_password IS NULL
    `);
    console.log('  ✅ Verified existing accounts have must_change_password = 0.');

    console.log('🎉 Phase 12 Database Migration completed successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Phase 12 Migration Error:', error);
    throw error;
  }
}

// Allow direct execution
if (process.argv[1]?.endsWith('migrate_phase12.js')) {
  runPhase12Migration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
