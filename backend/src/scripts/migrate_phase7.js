import { query } from '../config/db.js';

export async function runPhase7Migration() {
  console.log('🚀 Running Phase 7 Database Migration (Communication & Notifications)...');

  try {
    // -------------------------------------------------------------
    // 1. Evolve `announcements` Table
    // -------------------------------------------------------------
    console.log('  Verifying & evolving `announcements` table...');
    
    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        author_id INT UNSIGNED NOT NULL,
        target_type ENUM('all', 'interns', 'mentors', 'admins', 'track', 'cohort', 'intern') NOT NULL DEFAULT 'all',
        target_id INT UNSIGNED NULL,
        status ENUM('draft', 'scheduled', 'published', 'expired', 'archived') NOT NULL DEFAULT 'draft',
        priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal',
        is_pinned TINYINT(1) NOT NULL DEFAULT 0,
        requires_acknowledgement TINYINT(1) NOT NULL DEFAULT 0,
        published_at DATETIME NULL,
        scheduled_at DATETIME NULL,
        expires_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_ann_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check existing columns and alter if needed
    const annCols = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcements'
    `);
    const colNames = annCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!colNames.includes('status')) {
      console.log('    Adding `status` column to announcements...');
      await query(`ALTER TABLE announcements ADD COLUMN status ENUM('draft', 'scheduled', 'published', 'expired', 'archived') NOT NULL DEFAULT 'published' AFTER target_id`);
    } else {
      // Ensure enum values are correct
      await query(`ALTER TABLE announcements MODIFY COLUMN status ENUM('draft', 'scheduled', 'published', 'expired', 'archived') NOT NULL DEFAULT 'draft'`);
    }

    if (!colNames.includes('priority')) {
      console.log('    Adding `priority` column to announcements...');
      await query(`ALTER TABLE announcements ADD COLUMN priority ENUM('low', 'normal', 'high', 'urgent') NOT NULL DEFAULT 'normal' AFTER status`);
    }

    if (!colNames.includes('requires_acknowledgement')) {
      console.log('    Adding `requires_acknowledgement` column to announcements...');
      await query(`ALTER TABLE announcements ADD COLUMN requires_acknowledgement TINYINT(1) NOT NULL DEFAULT 0 AFTER is_pinned`);
    }

    if (!colNames.includes('published_at')) {
      console.log('    Adding `published_at` column to announcements...');
      await query(`ALTER TABLE announcements ADD COLUMN published_at DATETIME NULL AFTER requires_acknowledgement`);
      await query(`UPDATE announcements SET published_at = created_at WHERE published_at IS NULL AND status = 'published'`);
    }

    if (!colNames.includes('scheduled_at')) {
      console.log('    Adding `scheduled_at` column to announcements...');
      await query(`ALTER TABLE announcements ADD COLUMN scheduled_at DATETIME NULL AFTER published_at`);
    }

    if (!colNames.includes('expires_at')) {
      console.log('    Adding `expires_at` column to announcements...');
      await query(`ALTER TABLE announcements ADD COLUMN expires_at DATETIME NULL AFTER scheduled_at`);
    }

    // Modify target_type to support all required scopes
    await query(`
      ALTER TABLE announcements 
      MODIFY COLUMN target_type ENUM('all', 'interns', 'mentors', 'admins', 'track', 'cohort', 'intern') NOT NULL DEFAULT 'all'
    `);

    // Add indexes if not present
    try {
      await query(`CREATE INDEX idx_ann_status_pub ON announcements (status, published_at)`);
    } catch (e) {
      // index may already exist
    }
    try {
      await query(`CREATE INDEX idx_ann_target ON announcements (target_type, target_id)`);
    } catch (e) {}

    console.log('  ✅ `announcements` table ready.');

    // -------------------------------------------------------------
    // 2. Create `announcement_acknowledgements` Table
    // -------------------------------------------------------------
    console.log('  Verifying `announcement_acknowledgements` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS announcement_acknowledgements (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        announcement_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ack_ann FOREIGN KEY (announcement_id) REFERENCES announcements (id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_ack_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE KEY uk_ann_user (announcement_id, user_id),
        INDEX idx_ack_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `announcement_acknowledgements` table ready.');

    // -------------------------------------------------------------
    // 3. Evolve `notifications` Table
    // -------------------------------------------------------------
    console.log('  Verifying & evolving `notifications` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        type ENUM('attendance', 'task', 'evaluation', 'announcement', 'system', 'document', 'certificate') NOT NULL DEFAULT 'system',
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        related_entity_type VARCHAR(50) NULL,
        related_entity_id INT UNSIGNED NULL,
        link VARCHAR(255) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const notifCols = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
    `);
    const notifColNames = notifCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!notifColNames.includes('related_entity_type')) {
      console.log('    Adding `related_entity_type` column to notifications...');
      await query(`ALTER TABLE notifications ADD COLUMN related_entity_type VARCHAR(50) NULL AFTER message`);
    }

    if (!notifColNames.includes('related_entity_id')) {
      console.log('    Adding `related_entity_id` column to notifications...');
      await query(`ALTER TABLE notifications ADD COLUMN related_entity_id INT UNSIGNED NULL AFTER related_entity_type`);
    }

    if (!notifColNames.includes('read_at')) {
      console.log('    Adding `read_at` column to notifications...');
      await query(`ALTER TABLE notifications ADD COLUMN read_at DATETIME NULL AFTER is_read`);
    }

    // Expand type ENUM
    await query(`
      ALTER TABLE notifications 
      MODIFY COLUMN type ENUM('attendance', 'task', 'evaluation', 'announcement', 'system', 'document', 'certificate') NOT NULL DEFAULT 'system'
    `);

    // Modify message to TEXT for rich messages
    await query(`ALTER TABLE notifications MODIFY COLUMN message TEXT NOT NULL`);

    try {
      await query(`CREATE INDEX idx_notif_user_read ON notifications (user_id, is_read)`);
    } catch (e) {}
    try {
      await query(`CREATE INDEX idx_notif_user_created ON notifications (user_id, created_at)`);
    } catch (e) {}

    console.log('  ✅ `notifications` table ready.');

    // -------------------------------------------------------------
    // 4. Create `notification_preferences` Table
    // -------------------------------------------------------------
    console.log('  Verifying `notification_preferences` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL UNIQUE,
        announcements_in_app TINYINT(1) NOT NULL DEFAULT 1,
        tasks_in_app TINYINT(1) NOT NULL DEFAULT 1,
        performance_in_app TINYINT(1) NOT NULL DEFAULT 1,
        documents_in_app TINYINT(1) NOT NULL DEFAULT 1,
        system_in_app TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Mandatory system notifications cannot be disabled',
        email_notifications TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_notif_pref_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ `notification_preferences` table ready.');

    // Seed default preferences for all active users who do not yet have them
    console.log('  Seeding default notification preferences for existing users...');
    await query(`
      INSERT IGNORE INTO notification_preferences (user_id, announcements_in_app, tasks_in_app, performance_in_app, documents_in_app, system_in_app, email_notifications)
      SELECT id, 1, 1, 1, 1, 1, 0 FROM users WHERE is_active = 1
    `);
    console.log('  ✅ Default preferences seeded.');

    // -------------------------------------------------------------
    // 5. Seed Realistic Demo Announcements & Notifications
    // -------------------------------------------------------------
    console.log('  Seeding Phase 7 demo announcements & notifications...');

    const superAdmin = await query(`SELECT id FROM users WHERE email = 'admin@jowis.com' LIMIT 1`);
    const adminId = superAdmin.length > 0 ? superAdmin[0].id : 1;

    // Check if announcements already exist
    const existingAnn = await query(`SELECT COUNT(*) as cnt FROM announcements`);
    if (existingAnn[0].cnt === 0) {
      console.log('    Seeding initial announcements...');
      await query(`
        INSERT INTO announcements (title, content, author_id, target_type, target_id, status, priority, is_pinned, requires_acknowledgement, published_at)
        VALUES 
        (
          'Jowis Studio Operational Guidelines & Attendance Policy Reminder',
          'All interns are reminded that authoritative morning check-in closes strictly at 09:00:00 AM (Africa/Lagos timezone). Late arrivals are automatically tracked. Please review the studio handbook.',
          ?, 'all', NULL, 'published', 'high', 1, 1, NOW()
        ),
        (
          'Mid-Term Project Milestone Submissions Open',
          'Software Development & Product Design tracks have opened their mid-term project repositories. Ensure all code deliverables and Figma prototypes are submitted before Friday 5:00 PM.',
          ?, 'interns', NULL, 'published', 'normal', 0, 0, NOW()
        ),
        (
          'Mentor Weekly Briefing: Q3 Performance Review Calendar',
          'Dear mentors, the standardized evaluation desk for Cohort 2026-A is now accessible. Please complete all pending milestone assessments before the upcoming sprint review.',
          ?, 'mentors', NULL, 'published', 'normal', 0, 1, NOW()
        ),
        (
          'Cloud Architecture Masterclass (Draft)',
          'An upcoming guest lecture on Distributed Cloud Architectures hosted by Google Cloud engineers. Date and access links to be finalized.',
          ?, 'all', NULL, 'draft', 'low', 0, 0, NULL
        )
      `, [adminId, adminId, adminId, adminId]);
      console.log('    ✅ Demo announcements seeded.');
    }

    // Seed sample notifications for intern 1 and intern 2 if empty
    const existingNotifs = await query(`SELECT COUNT(*) as cnt FROM notifications`);
    if (existingNotifs[0].cnt === 0) {
      console.log('    Seeding initial notifications...');
      const internUser = await query(`SELECT id FROM users WHERE email = 'intern@jowis.com' LIMIT 1`);
      if (internUser.length > 0) {
        const uId = internUser[0].id;
        await query(`
          INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id, link, is_read, created_at)
          VALUES
          (?, 'announcement', 'Mandatory Policy Acknowledgment Required', 'Please review and acknowledge the Jowis Studio Operational Guidelines.', 'announcement', 1, '/intern/announcements', 0, NOW()),
          (?, 'system', 'Welcome to Jowis Studio ERP', 'Your internship profile is active. Check your track curriculum and attendance log.', 'system', NULL, '/intern/dashboard', 1, DATE_SUB(NOW(), INTERVAL 2 DAY)),
          (?, 'task', 'New Task Assigned: API Design Specification', 'A new curriculum task has been assigned to your track.', 'task', 1, '/intern/tasks', 0, DATE_SUB(NOW(), INTERVAL 1 HOUR))
        `, [uId, uId, uId]);
        console.log('    ✅ Demo notifications seeded.');
      }
    }

    console.log('✨ Phase 7 Database Migration Completed Successfully!');
  } catch (error) {
    console.error('❌ Phase 7 Database Migration Failed:', error);
    throw error;
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_phase7.js')) {
  runPhase7Migration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
