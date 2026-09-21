import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

// Route imports
import authRoutes from './routes/authRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import internRoutes from './routes/internRoutes.js';
import trainingRoutes from './routes/trainingRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import communicationRoutes from './routes/communicationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import automationRoutes from './routes/automationRoutes.js';

const app = express();

import { query } from './config/db.js';

// Production & Development CORS Configuration (Gate 9)
const isProd = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const devOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

const allowedOrigins = isProd
  ? (configuredOrigins.length > 0 ? configuredOrigins : ['https://erp.jowis.com'])
  : [...new Set([...devOrigins, ...configuredOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, automated scripts, health probes)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || (!isProd && origin.startsWith('http://localhost:'))) {
      return callback(null, true);
    }
    return callback(new Error(`CORS Alert: Origin '${origin}' is not permitted by institutional Access-Control policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve uploaded submission files with directory indexing disabled (Gate 5)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { dotfiles: 'ignore', index: false }));

// Root Health & Uptime Check (Gate 13)
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      status: 'ok',
      system: 'Jowis Studio Internship ERP API',
      database: 'connected',
      uptime: process.uptime(),
      timezone: process.env.APP_TIMEZONE || 'Africa/Lagos',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      system: 'Jowis Studio Internship ERP API',
      database: 'disconnected',
      error: 'Database unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/automation', automationRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd && status === 500
    ? 'An internal server error occurred.'
    : (err.message || 'An internal server error occurred.');

  res.status(status).json({
    success: false,
    message
  });
});

export default app;
