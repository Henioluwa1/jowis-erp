import app from './src/app.js';
import { testConnection } from './src/config/db.js';

const PORT = process.env.PORT || 5000;

const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  console.log('⚡ Initializing Jowis Studio ERP Backend Server...');

  const dbReady = await testConnection();
  if (!dbReady) {
    console.error('⚠️ Warning: MySQL database connection failed. Server will still attempt to listen, but API requests may fail until MySQL is running.');
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 JOWIS STUDIO ERP BACKEND RUNNING ON ${HOST}:${PORT}`);
    console.log(`🔗 API Base URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api`);
    console.log(`🌍 Operational Timezone: ${process.env.APP_TIMEZONE || 'Africa/Lagos'}`);
    console.log(`⏰ Attendance Cutoff: ${process.env.ATTENDANCE_CUTOFF_TIME || '09:00:00'} AM`);
    console.log(`======================================================\n`);
  });
}

startServer();
