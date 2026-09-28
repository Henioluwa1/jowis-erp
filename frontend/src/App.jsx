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
import { DocumentsPage } from './pages/admin/DocumentsPage';
import { CertificatesPage } from './pages/admin/CertificatesPage';
import { CommunicationsPage } from './pages/admin/CommunicationsPage';
import { SystemSettingsPage } from './pages/admin/SystemSettingsPage';
import { AdministrationHub } from './pages/admin/governance/AdministrationHub';
import { AutomationPage } from './pages/admin/automation/AutomationPage';
import { SecurityAuditLogsPage } from './pages/admin/security/SecurityAuditLogsPage';

// Intern Pages
import { InternDashboard } from './pages/intern/InternDashboard';
import { InternAttendancePage } from './pages/intern/InternAttendancePage';
import { InternTasksPage } from './pages/intern/InternTasksPage';
import { InternPerformancePage } from './pages/intern/InternPerformancePage';
import { InternReportsPage } from './pages/intern/InternReportsPage';
import { InternDocumentsPage } from './pages/intern/InternDocumentsPage';
import { InternCertificatesPage } from './pages/intern/InternCertificatesPage';
import { AnnouncementsPage } from './pages/intern/AnnouncementsPage';
import { MyProfilePage } from './pages/intern/MyProfilePage';

// Common / Shared Pages
import { NotificationInboxPage } from './pages/common/NotificationInboxPage';
import { UniversalProfilePage } from './pages/common/UniversalProfilePage';

// Public Pages
import { CertificateVerificationPage } from './pages/public/CertificateVerificationPage';

export default function App() {
  const { isAuthenticated, role } = useAuth();

  return (
    <Routes>
      {/* Public Certificate Verification (Zero Auth Required) */}
      <Route path="/verify/certificate/:verificationCode" element={<CertificateVerificationPage />} />
      <Route path="/verify/certificate" element={<CertificateVerificationPage />} />

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
        <Route path="/admin/profile" element={<UniversalProfilePage />} />
        <Route path="/profile" element={<UniversalProfilePage />} />
        <Route path="/admin/interns" element={<InternsPage />} />
        <Route path="/admin/training" element={<TrainingPage />} />
        <Route path="/admin/attendance" element={<AttendancePage />} />
        <Route path="/admin/tasks" element={<TasksAdminPage />} />
        <Route path="/admin/performance" element={<PerformancePage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/documents" element={<DocumentsPage />} />
        <Route path="/admin/certificates" element={<CertificatesPage />} />
        <Route path="/admin/communications" element={<CommunicationsPage />} />
        <Route path="/admin/notifications" element={<NotificationInboxPage />} />
        <Route path="/admin/settings" element={<SystemSettingsPage />} />
        <Route
          path="/admin/governance"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
              <AdministrationHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/automation"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
              <AutomationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/security"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <SecurityAuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <SecurityAuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/administration"
          element={<Navigate to="/admin/governance" replace />}
        />
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
        <Route path="/intern/profile" element={<UniversalProfilePage />} />
        <Route path="/intern/attendance" element={<InternAttendancePage />} />
        <Route path="/intern/tasks" element={<InternTasksPage />} />
        <Route path="/intern/performance" element={<InternPerformancePage />} />
        <Route path="/intern/reports" element={<InternReportsPage />} />
        <Route path="/intern/documents" element={<InternDocumentsPage />} />
        <Route path="/intern/certificates" element={<InternCertificatesPage />} />
        <Route path="/intern/announcements" element={<AnnouncementsPage />} />
        <Route path="/intern/notifications" element={<NotificationInboxPage />} />
      </Route>

      {/* Generic Notifications Redirect based on role */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin', 'mentor', 'intern']}>
            {role === 'intern' ? (
              <Navigate to="/intern/notifications" replace />
            ) : (
              <Navigate to="/admin/notifications" replace />
            )}
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
