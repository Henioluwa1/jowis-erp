import express from 'express';
import {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleTaskStatus,
  deleteTask,
  assignTask,
  getAssignments,
  cancelAssignment,
  getMyTasks,
  updateMyTaskStatus,
  submitTaskWork,
  getSubmissions,
  reviewSubmission,
  getTrainingProgress,
  getTrainingOperationsDashboard,
  getMentorWorkspace
} from '../controllers/taskController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { submissionUpload } from '../utils/upload.js';

const router = express.Router();

// 1. Intern Specific Workspace Endpoints (Gate 5 & 8)
router.get('/me', authenticateJWT, getMyTasks);
router.get('/my-tasks', authenticateJWT, getMyTasks);
router.patch('/me/assignments/:id/status', authenticateJWT, updateMyTaskStatus);
router.patch('/my-tasks/:id/status', authenticateJWT, updateMyTaskStatus);


// 2. Submission System (Gate 6) - with optional multipart file attachment upload
router.post('/submit', authenticateJWT, submissionUpload.single('attachment'), submitTaskWork);
router.post('/:id/submit', authenticateJWT, (req, res, next) => {
  // Map :id to taskId or assignmentId in req.body for backward compatibility
  req.body.taskId = req.body.taskId || req.params.id;
  next();
}, submissionUpload.single('attachment'), submitTaskWork);

// 3. Submissions & Mentor Review (Gate 7 & 8)
router.get('/submissions', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getSubmissions);
router.post('/submissions/:id/review', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), reviewSubmission);
router.put('/submissions/:id/grade', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), reviewSubmission); // backward compatibility

// 4. Assignments Engine (Gate 4)
router.get('/assignments', authenticateJWT, getAssignments);
router.post('/assignments', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), assignTask);
router.patch('/assignments/:id/cancel', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), cancelAssignment);

// 5. Training Progress & Analytics (Gate 9)
router.get('/progress', authenticateJWT, getTrainingProgress);

// 6. Dashboards & Workspaces (Gates 10 & 11)
router.get('/operations-dashboard', authenticateJWT, authorizeRoles('super_admin', 'admin'), getTrainingOperationsDashboard);
router.get('/mentor-workspace', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), getMentorWorkspace);

// 7. General Task Catalog CRUD (Gate 3)
router.get('/', authenticateJWT, getAllTasks);
router.get('/:id', authenticateJWT, getTaskById);
router.post('/', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), createTask);
router.put('/:id', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), updateTask);
router.patch('/:id/status', authenticateJWT, authorizeRoles('super_admin', 'admin', 'mentor'), toggleTaskStatus);
router.delete('/:id', authenticateJWT, authorizeRoles('super_admin', 'admin'), deleteTask);

export default router;
