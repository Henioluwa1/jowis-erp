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

const app = express();

// CORS setup
const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in local development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Root Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Jowis Studio Internship ERP API',
    timezone: process.env.APP_TIMEZONE || 'Africa/Lagos',
    timestamp: new Date().toISOString()
  });
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
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'An internal server error occurred.'
  });
});

export default app;
