import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find the newest SQL backup file in the backups directory.
 * @param {string} backupsDir
 * @returns {string|null}
 */
function getLatestBackup(backupsDir) {
  if (!fs.existsSync(backupsDir)) return null;
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.sql'))
    .map(f => ({
      name: f,
      fullPath: path.join(backupsDir, f),
      time: fs.statSync(path.join(backupsDir, f)).mtimeMs
    }))
    .sort((a, b) => b.time - a.time);

  return files.length > 0 ? files[0].fullPath : null;
}

/**
 * Restores a database from a SQL dump file.
 *
 * @param {Object} options
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {string} [options.user]
 * @param {string} [options.password]
 * @param {string} [options.database]
 * @param {string} [options.filePath]
 * @returns {Promise<{ filePath: string, tablesRestored: number, durationSeconds: string }>}
 */
export async function restoreDatabase(options = {}) {
  const host = options.host || process.env.DB_HOST || 'localhost';
  const port = parseInt(options.port || process.env.DB_PORT || '3306', 10);
  const user = options.user || process.env.DB_USER || 'root';
  const password = options.password !== undefined ? options.password : (process.env.DB_PASSWORD || '');
  const database = options.database || process.env.DB_NAME || 'jowis_studio_erp';

  let filePath = options.filePath;
  if (!filePath) {
    const defaultDir = path.resolve(__dirname, '../../../database/backups');
    filePath = getLatestBackup(defaultDir);
    if (!filePath) {
      throw new Error(`No backup SQL files found in ${defaultDir}. Please specify a backup file path.`);
    }
  } else {
    filePath = path.resolve(filePath);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file does not exist: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  if (fileStats.size === 0) {
    throw new Error(`Backup file is empty: ${filePath}`);
  }

  console.log(`\n🔄 Starting database restore into \`${database}\` on ${host}:${port}...`);
  console.log(`📁 Source file: ${filePath} (${(fileStats.size / 1024).toFixed(2)} KB)`);
  const startTime = Date.now();

  // Connect to MySQL server (without selecting DB first in case it needs to be created)
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
    charset: 'utf8mb4'
  });

  try {
    // Create DB if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);

    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    await connection.query(sqlContent);

    // Verify tables count
    const [tableRows] = await connection.query(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
    const tablesCount = tableRows.length;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Database restore completed successfully!`);
    console.log(`📊 Restored tables: ${tablesCount}`);
    console.log(`⏱️ Duration: ${duration}s\n`);

    return {
      filePath,
      tablesRestored: tablesCount,
      durationSeconds: duration
    };
  } finally {
    await connection.end();
  }
}

// Standalone CLI execution check
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];
  
  let customPath = null;
  let customDb = null;

  if (arg1) {
    if (arg1.endsWith('.sql') || fs.existsSync(arg1)) {
      customPath = arg1;
      customDb = arg2 || null;
    } else {
      // First arg is target database name, use latest backup
      customDb = arg1;
      customPath = arg2 || null;
    }
  }

  restoreDatabase({ filePath: customPath, database: customDb })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Database restore failed:', err.message);
      process.exit(1);
    });
}
