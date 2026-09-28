import { query } from '../config/db.js';

export async function runSecurityAndChatMigration() {
  console.log('🛡️ Running Security Defense, Access Logging & Chat System Migration...');

  try {
    // 1. Evolve `chat_messages` table
    console.log('  Evolving `chat_messages` for read receipts & multimedia...');
    const chatCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_messages'
    `);
    const chatColNames = chatCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!chatColNames.includes('is_delivered')) {
      await query(`ALTER TABLE chat_messages ADD COLUMN is_delivered TINYINT(1) NOT NULL DEFAULT 0 AFTER is_read`);
    }
    if (!chatColNames.includes('delivered_at')) {
      await query(`ALTER TABLE chat_messages ADD COLUMN delivered_at DATETIME NULL AFTER is_delivered`);
    }
    if (!chatColNames.includes('read_at')) {
      await query(`ALTER TABLE chat_messages ADD COLUMN read_at DATETIME NULL AFTER delivered_at`);
    }
    if (!chatColNames.includes('attachment_url')) {
      await query(`ALTER TABLE chat_messages ADD COLUMN attachment_url VARCHAR(500) NULL AFTER read_at`);
    }
    if (!chatColNames.includes('file_name')) {
      await query(`ALTER TABLE chat_messages ADD COLUMN file_name VARCHAR(255) NULL AFTER attachment_url`);
    }
    if (!chatColNames.includes('file_size')) {
      await query(`ALTER TABLE chat_messages ADD COLUMN file_size INT UNSIGNED NULL AFTER file_name`);
    }
    if (!chatColNames.includes('file_type')) {
      await query(`ALTER TABLE chat_messages ADD COLUMN file_type VARCHAR(100) NULL AFTER file_size`);
    }

    // 2. Create `system_access_logs` table (Captures all operations, requests, IPs, and errors for debugging & audit)
    console.log('  Creating `system_access_logs` table...');
    await query(`
      CREATE TABLE IF NOT EXISTS system_access_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NULL,
        user_name VARCHAR(150) NULL,
        user_role VARCHAR(50) NULL,
        ip_address VARCHAR(64) NOT NULL,
        method VARCHAR(10) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        status_code INT NOT NULL,
        duration_ms INT NOT NULL DEFAULT 0,
        user_agent VARCHAR(255) NULL,
        threat_level ENUM('NONE', 'SUSPICIOUS', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'NONE',
        threat_reason VARCHAR(255) NULL,
        request_payload LONGTEXT NULL,
        error_details LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_access_ip (ip_address),
        INDEX idx_access_user (user_id),
        INDEX idx_access_created (created_at),
        INDEX idx_access_threat (threat_level),
        INDEX idx_access_status (status_code),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Create `blocked_ips` table (Firewall & Hacker defense rule repository)
    console.log('  Creating `blocked_ips` firewall table...');
    await query(`
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(64) NOT NULL UNIQUE,
        reason VARCHAR(255) NOT NULL,
        threat_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL_SUPERADMIN_BAN',
        blocked_by INT UNSIGNED NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        INDEX idx_blocked_ip (ip_address, is_active),
        FOREIGN KEY (blocked_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Phase 14 Security, Logging & Chat Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  }
}

// Run immediately if executed directly
if (process.argv[1]?.endsWith('migrate_phase14_security_and_chat.js')) {
  runSecurityAndChatMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
