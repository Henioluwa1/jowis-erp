import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AttendancePage } from './pages/admin/AttendancePage';
import { InternsPage } from './pages/admin/InternsPage';
import { TrainingPage } from './pages/admin/TrainingPage';
import { TasksAdminPage } from './pages/admin/TasksAdminPage';
import { PerformancePage } from './pages/admin/PerformancePage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SystemSettingsPage } from './pages/admin/SystemSettingsPage';

// Intern Pages
import { InternDashboard } from './pages/intern/InternDashboard';
import { InternAttendancePage } from './pages/intern/InternAttendancePage';
import { InternTasksPage } from './pages/intern/InternTasksPage';
import { InternPerformancePage } from './pages/intern/InternPerformancePage';
import { AnnouncementsPage } from './pages/intern/AnnouncementsPage';
import { MyProfilePage } from './pages/intern/MyProfilePage';

export default function App() {
  const { isAuthenticated, role } = useAuth();

  return (
    <Routes>
      {/* Public Login Route */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            role === 'intern' ? (
              <Navigate to="/intern/dashboard" replace />
            ) : (
              <Navigate to="/admin/dashboard" replace />
            )
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Root redirect */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            role === 'intern' ? (
              <Navigate to="/intern/dashboard" replace />
            ) : (
              <Navigate to="/admin/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Admin / Mentor Protected Portal */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin', 'mentor']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/interns" element={<InternsPage />} />
        <Route path="/admin/training" element={<TrainingPage />} />
        <Route path="/admin/attendance" element={<AttendancePage />} />
        <Route path="/admin/tasks" element={<TasksAdminPage />} />
        <Route path="/admin/performance" element={<PerformancePage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/settings" element={<SystemSettingsPage />} />
      </Route>

      {/* Intern Protected Portal */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['intern']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/intern/dashboard" element={<InternDashboard />} />
        <Route path="/intern/profile" element={<MyProfilePage />} />
        <Route path="/intern/attendance" element={<InternAttendancePage />} />
        <Route path="/intern/tasks" element={<InternTasksPage />} />
        <Route path="/intern/performance" element={<InternPerformancePage />} />
        <Route path="/intern/announcements" element={<AnnouncementsPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
