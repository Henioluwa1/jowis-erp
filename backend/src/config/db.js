import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jowis_studio_erp',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  timezone: '+01:00', // Africa/Lagos UTC+1
  dateStrings: true
});

export const query = async (sql, params = []) => {
  const [results] = await pool.execute(sql, params);
  return results;
};

export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'jowis_studio_erp');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

export default pool;
