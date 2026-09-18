import { query } from '../config/db.js';

export async function runPhase5Migration() {
  console.log('🚀 Running Phase 5 Database Optimization (Reports & Analytics Index Layer)...');

  try {
    // 1. Check & Add index on `attendance` (attendance_date, status)
    console.log('  Optimizing `attendance` table indexes for reporting...');
    const attIndexes = await query(`SHOW INDEX FROM attendance WHERE Key_name = 'idx_att_date_status'`);
    if (attIndexes.length === 0) {
      await query(`ALTER TABLE attendance ADD INDEX idx_att_date_status (attendance_date, status)`);
      console.log('  ✅ Added `attendance.idx_att_date_status`.');
    } else {
      console.log('  ℹ️ `attendance.idx_att_date_status` already exists.');
    }

    // 2. Check & Add index on `task_assignments` (due_date, status)
    console.log('  Optimizing `task_assignments` table indexes for reporting...');
    const taIndexes = await query(`SHOW INDEX FROM task_assignments WHERE Key_name = 'idx_ta_due_status'`);
    if (taIndexes.length === 0) {
      await query(`ALTER TABLE task_assignments ADD INDEX idx_ta_due_status (due_date, status)`);
      console.log('  ✅ Added `task_assignments.idx_ta_due_status`.');
    } else {
      console.log('  ℹ️ `task_assignments.idx_ta_due_status` already exists.');
    }

    // 3. Check & Add index on `performance_evaluations` (period_id, status)
    console.log('  Optimizing `performance_evaluations` table indexes for reporting...');
    const peIndexes = await query(`SHOW INDEX FROM performance_evaluations WHERE Key_name = 'idx_pe_period_status'`);
    if (peIndexes.length === 0) {
      await query(`ALTER TABLE performance_evaluations ADD INDEX idx_pe_period_status (period_id, status)`);
      console.log('  ✅ Added `performance_evaluations.idx_pe_period_status`.');
    } else {
      console.log('  ℹ️ `performance_evaluations.idx_pe_period_status` already exists.');
    }

    // 4. Check & Add index on `intern_profiles` (track_id, status)
    console.log('  Optimizing `intern_profiles` table indexes for reporting...');
    const ipIndexes = await query(`SHOW INDEX FROM intern_profiles WHERE Key_name = 'idx_ip_track_status'`);
    if (ipIndexes.length === 0) {
      await query(`ALTER TABLE intern_profiles ADD INDEX idx_ip_track_status (track_id, status)`);
      console.log('  ✅ Added `intern_profiles.idx_ip_track_status`.');
    } else {
      console.log('  ℹ️ `intern_profiles.idx_ip_track_status` already exists.');
    }

    console.log('🎉 Phase 5 Database Optimization Completed Successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Phase 5 Migration Error:', error);
    throw error;
  }
}

// Run if called directly
runPhase5Migration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
