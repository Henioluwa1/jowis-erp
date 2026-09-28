import pool, { query } from '../config/db.js';

async function migrateChatSystem() {
  console.log('🔄 Running Chat System Database Migration...');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        sender_id INT UNSIGNED NOT NULL,
        receiver_id INT UNSIGNED NULL,
        channel_id VARCHAR(50) NULL,
        ciphertext LONGTEXT NOT NULL,
        iv VARCHAR(64) NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender_receiver (sender_id, receiver_id),
        INDEX idx_receiver_read (receiver_id, is_read),
        INDEX idx_channel (channel_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Table `chat_messages` created or verified successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateChatSystem();
