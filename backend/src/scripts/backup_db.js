import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Backup MySQL database schema and data to a timestamped or specified SQL dump file.
 *
 * @param {Object} options
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {string} [options.user]
 * @param {string} [options.password]
 * @param {string} [options.database]
 * @param {string} [options.outputPath]
 * @returns {Promise<{ filePath: string, tablesCount: number, rowsCount: number, sizeBytes: number }>}
 */
export async function backupDatabase(options = {}) {
  const host = options.host || process.env.DB_HOST || 'localhost';
  const port = parseInt(options.port || process.env.DB_PORT || '3306', 10);
  const user = options.user || process.env.DB_USER || 'root';
  const password = options.password !== undefined ? options.password : (process.env.DB_PASSWORD || '');
  const database = options.database || process.env.DB_NAME || 'jowis_studio_erp';

  const defaultDir = path.resolve(__dirname, '../../../database/backups');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetPath = options.outputPath 
    ? path.resolve(options.outputPath) 
    : path.join(defaultDir, `backup_${database}_${timestamp}.sql`);

  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`\n📦 Starting database backup for \`${database}\` on ${host}:${port}...`);
  const startTime = Date.now();

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4'
  });

  try {
    const lines = [];
    lines.push('-- ======================================================');
    lines.push('-- Jowis Studio ERP Production Database Backup');
    lines.push(`-- Database: ${database}`);
    lines.push(`-- Created: ${new Date().toISOString()}`);
    lines.push('-- ======================================================\n');
    lines.push('SET FOREIGN_KEY_CHECKS = 0;');
    lines.push('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";');
    lines.push('SET NAMES utf8mb4;\n');

    // Retrieve all base tables
    const [tableRows] = await connection.query(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
    const tableKey = Object.keys(tableRows[0] || {})[0];
    const tables = tableRows.map(row => row[tableKey]);

    let totalRows = 0;

    for (const table of tables) {
      lines.push(`-- ------------------------------------------------------`);
      lines.push(`-- Table structure & data for table \`${table}\``);
      lines.push(`-- ------------------------------------------------------`);
      lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);

      const [createResult] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
      const createTableSql = createResult[0]['Create Table'];
      lines.push(`${createTableSql};\n`);

      // Fetch all rows
      const [dataRows] = await connection.query(`SELECT * FROM \`${table}\``);
      if (dataRows.length > 0) {
        totalRows += dataRows.length;
        const columns = Object.keys(dataRows[0]);
        const quotedCols = columns.map(c => `\`${c}\``).join(', ');

        const chunkSize = 100;
        for (let i = 0; i < dataRows.length; i += chunkSize) {
          const chunk = dataRows.slice(i, i + chunkSize);
          const valueStrings = chunk.map(row => {
            const vals = columns.map(c => connection.escape(row[c]));
            return `(${vals.join(', ')})`;
          });

          lines.push(`INSERT INTO \`${table}\` (${quotedCols}) VALUES\n${valueStrings.join(',\n')};`);
        }
        lines.push('');
      }
    }

    lines.push('SET FOREIGN_KEY_CHECKS = 1;\n');
    lines.push('-- Backup completed successfully.');

    fs.writeFileSync(targetPath, lines.join('\n'), 'utf-8');
    const stats = fs.statSync(targetPath);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Backup successful!`);
    console.log(`📁 File: ${targetPath}`);
    console.log(`📊 Tables: ${tables.length} | Rows: ${totalRows} | Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`⏱️ Duration: ${duration}s\n`);

    return {
      filePath: targetPath,
      tablesCount: tables.length,
      rowsCount: totalRows,
      sizeBytes: stats.size
    };
  } finally {
    await connection.end();
  }
}

// Standalone CLI execution check
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const customPath = process.argv[2];
  const customDb = process.argv[3];
  backupDatabase({ outputPath: customPath, database: customDb })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Database backup failed:', err.message);
      process.exit(1);
    });
}
