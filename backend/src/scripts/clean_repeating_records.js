import pool, { query } from '../config/db.js';

/**
 * Clean up all repeating and duplicate records created during test runs.
 * Retains single canonical records and maintains relational integrity.
 */
async function cleanRepeatingRecords() {
  console.log('================================================================');
  console.log('🧹 JOWIS STUDIO ERP — REPEATING & DUPLICATE RECORDS CLEANUP');
  console.log('================================================================\n');

  try {
    // 1. CLEAN UP REPEATING ANNOUNCEMENTS
    console.log('🔹 1. Cleaning repeating announcements...');
    const duplicateAnnTitles = await query(`
      SELECT title, MIN(id) as keep_id, COUNT(*) as cnt
      FROM announcements
      GROUP BY title
      HAVING cnt > 1
    `);

    for (const item of duplicateAnnTitles) {
      console.log(`   Found ${item.cnt} records for: "${item.title}". Keeping ID ${item.keep_id}...`);
      // Delete acknowledgements for duplicates
      await query(`
        DELETE FROM announcement_acknowledgements
        WHERE announcement_id IN (
          SELECT id FROM announcements WHERE title = ? AND id != ?
        )
      `, [item.title, item.keep_id]);

      // Delete duplicate announcements
      const delRes = await query(`
        DELETE FROM announcements
        WHERE title = ? AND id != ?
      `, [item.title, item.keep_id]);
      console.log(`   ✓ Deleted ${delRes.affectedRows} duplicate announcement records.`);
    }

    // 2. CLEAN UP REPEATING TASKS & ASSOCIATED RECORDS
    console.log('\n🔹 2. Cleaning repeating tasks...');
    const duplicateTasks = await query(`
      SELECT title, track_id, MIN(id) as keep_id, COUNT(*) as cnt
      FROM tasks
      GROUP BY title, track_id
      HAVING cnt > 1
    `);

    for (const item of duplicateTasks) {
      console.log(`   Found ${item.cnt} records for task: "${item.title}". Keeping ID ${item.keep_id}...`);
      
      const dupTaskIds = await query(`
        SELECT id FROM tasks WHERE title = ? AND track_id = ? AND id != ?
      `, [item.title, item.track_id, item.keep_id]);
      const idList = dupTaskIds.map(t => t.id);

      if (idList.length > 0) {
        const idListStr = idList.map(Number).join(',');
        // Delete reviews on submissions for duplicate tasks
        await query(`
          DELETE tr FROM task_reviews tr
          JOIN task_submissions ts ON tr.submission_id = ts.id
          WHERE ts.task_id IN (${idListStr})
        `);

        // Delete submissions for duplicate tasks
        await query(`
          DELETE FROM task_submissions WHERE task_id IN (${idListStr})
        `);

        // Delete assignments for duplicate tasks
        await query(`
          DELETE FROM task_assignments WHERE task_id IN (${idListStr})
        `);

        // Delete duplicate tasks
        const delRes = await query(`
          DELETE FROM tasks WHERE id IN (${idListStr})
        `);
        console.log(`   ✓ Deleted ${delRes.affectedRows} duplicate task records.`);
      }
    }

    // 3. CLEAN UP REPEATING TRAINING MODULES
    console.log('\n🔹 3. Cleaning repeating training modules...');
    const duplicateModules = await query(`
      SELECT title, track_id, MIN(id) as keep_id, COUNT(*) as cnt
      FROM training_modules
      GROUP BY title, track_id
      HAVING cnt > 1
    `);

    for (const item of duplicateModules) {
      console.log(`   Found ${item.cnt} records for module: "${item.title}". Keeping ID ${item.keep_id}...`);
      
      const dupModIds = await query(`
        SELECT id FROM training_modules WHERE title = ? AND track_id = ? AND id != ?
      `, [item.title, item.track_id, item.keep_id]);
      const idList = dupModIds.map(m => m.id);

      if (idList.length > 0) {
        const idListStr = idList.map(Number).join(',');
        // Re-point any tasks referencing duplicate modules to keep_id
        await query(`
          UPDATE tasks SET module_id = ? WHERE module_id IN (${idListStr})
        `, [item.keep_id]);

        // Delete duplicate modules
        const delRes = await query(`
          DELETE FROM training_modules WHERE id IN (${idListStr})
        `);
        console.log(`   ✓ Deleted ${delRes.affectedRows} duplicate training module records.`);
      }
    }

    // 4. CLEAN UP REPEATING PERMISSION REQUESTS
    console.log('\n🔹 4. Cleaning repeating permission requests...');
    const duplicatePerms = await query(`
      SELECT intern_id, start_date, end_date, MIN(id) as keep_id, COUNT(*) as cnt
      FROM permission_requests
      GROUP BY intern_id, start_date, end_date
      HAVING cnt > 1
    `);

    for (const item of duplicatePerms) {
      console.log(`   Found ${item.cnt} permission requests for intern ${item.intern_id} (${item.start_date} to ${item.end_date}). Keeping ID ${item.keep_id}...`);
      const delRes = await query(`
        DELETE FROM permission_requests
        WHERE intern_id = ? AND start_date = ? AND end_date = ? AND id != ?
      `, [item.intern_id, item.start_date, item.end_date, item.keep_id]);
      console.log(`   ✓ Deleted ${delRes.affectedRows} duplicate permission requests.`);
    }

    // 5. CLEAN UP REPEATING / TEMPORARY TEST USERS
    console.log('\n🔹 5. Cleaning temporary test users...');
    const tempUsers = await query(`
      SELECT id, email, first_name, last_name, role_id
      FROM users
      WHERE email LIKE 'test.governance.%'
         OR email LIKE 'test.mentor.%'
         OR email LIKE 'test.intern.%'
         OR email LIKE 'browsertest.mentor%'
         OR email LIKE 'test.intern.form%'
         OR email LIKE 'test.candidate.%'
         OR email LIKE 'test.onboarding.%'
         OR email = 'nnuiubvbj@gmail.com'
    `);

    console.log(`   Found ${tempUsers.length} temporary test user accounts.`);
    if (tempUsers.length > 0) {
      const userIds = tempUsers.map(u => u.id);
      const userIdsStr = userIds.map(Number).join(',');

      // Clean up intern profiles for test users
      const internProfs = await query(`
        SELECT id FROM intern_profiles WHERE user_id IN (${userIdsStr})
      `);
      if (internProfs.length > 0) {
        const ipIds = internProfs.map(ip => ip.id);
        const ipIdsStr = ipIds.map(Number).join(',');
        await query(`DELETE FROM attendance WHERE intern_id IN (${ipIdsStr})`);
        await query(`DELETE FROM permission_requests WHERE intern_id IN (${ipIdsStr})`);
        await query(`DELETE FROM task_assignments WHERE intern_id IN (${ipIdsStr})`);
        await query(`DELETE FROM intern_lifecycle_history WHERE intern_id IN (${ipIdsStr})`);
        await query(`DELETE FROM intern_assignment_history WHERE intern_id IN (${ipIdsStr})`);
        await query(`DELETE FROM performance_evaluations WHERE intern_id IN (${ipIdsStr})`);
        await query(`DELETE FROM intern_profiles WHERE id IN (${ipIdsStr})`);
      }

      // Clean up mentors for test users
      await query(`DELETE FROM mentors WHERE user_id IN (${userIdsStr})`);
      await query(`DELETE FROM notifications WHERE user_id IN (${userIdsStr})`);
      await query(`DELETE FROM notification_preferences WHERE user_id IN (${userIdsStr})`);
      await query(`DELETE FROM audit_logs WHERE user_id IN (${userIdsStr})`);
      const delUsers = await query(`DELETE FROM users WHERE id IN (${userIdsStr})`);
      console.log(`   ✓ Deleted ${delUsers.affectedRows} temporary test user accounts and their associated profiles.`);
    }

    // 6. CLEAN UP DUPLICATE NOTIFICATIONS
    console.log('\n🔹 6. De-duplicating notifications...');
    const dupNotifs = await query(`
      SELECT user_id, title, MIN(id) as keep_id, COUNT(*) as cnt
      FROM notifications
      GROUP BY user_id, title
      HAVING cnt > 1
    `);

    let totalNotifsCleaned = 0;
    for (const item of dupNotifs) {
      const delRes = await query(`
        DELETE FROM notifications
        WHERE user_id = ? AND title = ? AND id != ?
      `, [item.user_id, item.title, item.keep_id]);
      totalNotifsCleaned += delRes.affectedRows;
    }
    console.log(`   ✓ Cleaned ${totalNotifsCleaned} repetitive notification alerts.`);

    // 7. ENSURE ACTIVE COHORTS EXIST FOR ALL TRACKS
    console.log('\n🔹 7. Ensuring all tracks have active cohorts for enrollment...');
    const allTracks = await query('SELECT id, name, code FROM tracks WHERE is_active = 1');
    const allCohorts = await query('SELECT id, track_id, status FROM cohorts WHERE status != "archived"');
    const tracksWithCohorts = new Set(allCohorts.map(c => c.track_id));

    const mentorList = await query('SELECT id FROM mentors LIMIT 2');
    const defaultMentorId = mentorList[0]?.id || 1;

    for (const trk of allTracks) {
      if (!tracksWithCohorts.has(trk.id)) {
        const codeSuffix = trk.code.replace('TRK-', '');
        const cohortName = `Cohort JOWIS-2026-${codeSuffix}`;
        const cohortCode = `COH-2026-${codeSuffix}`;
        console.log(`   Creating active cohort for track ${trk.name} (${trk.code})...`);
        await query(`
          INSERT INTO cohorts (name, cohort_code, track_id, lead_mentor_id, start_date, end_date, capacity, status)
          VALUES (?, ?, ?, ?, '2026-03-01', '2026-09-30', 30, 'active')
        `, [cohortName, cohortCode, trk.id, defaultMentorId]);
        console.log(`   ✓ Created cohort '${cohortName}' for track '${trk.name}'.`);
      }
    }

    console.log('\n================================================================');
    console.log('✨ ALL DUPLICATES & REPEATING RECORDS CLEANED UP SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanRepeatingRecords();
