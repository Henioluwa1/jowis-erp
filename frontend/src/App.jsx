import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { PageLoadingFallback } from './components/common/PageLoadingFallback';

// Helper for dynamic named exports
const lazyNamed = (factory, name) => lazy(() => factory().then(m => ({ default: m[name] })));

// Admin Pages (Code-Split)
const AdminDashboard = lazyNamed(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const AttendancePage = lazyNamed(() => import('./pages/admin/AttendancePage'), 'AttendancePage');
const InternsPage = lazyNamed(() => import('./pages/admin/InternsPage'), 'InternsPage');
const TrainingPage = lazyNamed(() => import('./pages/admin/TrainingPage'), 'TrainingPage');
const TasksAdminPage = lazyNamed(() => import('./pages/admin/TasksAdminPage'), 'TasksAdminPage');
const PerformancePage = lazyNamed(() => import('./pages/admin/PerformancePage'), 'PerformancePage');
const ReportsPage = lazyNamed(() => import('./pages/admin/ReportsPage'), 'ReportsPage');
const DocumentsPage = lazyNamed(() => import('./pages/admin/DocumentsPage'), 'DocumentsPage');
const CertificatesPage = lazyNamed(() => import('./pages/admin/CertificatesPage'), 'CertificatesPage');
const CommunicationsPage = lazyNamed(() => import('./pages/admin/CommunicationsPage'), 'CommunicationsPage');
const SystemSettingsPage = lazyNamed(() => import('./pages/admin/SystemSettingsPage'), 'SystemSettingsPage');
const AdministrationHub = lazyNamed(() => import('./pages/admin/governance/AdministrationHub'), 'AdministrationHub');
const AutomationPage = lazyNamed(() => import('./pages/admin/automation/AutomationPage'), 'AutomationPage');
const SecurityAuditLogsPage = lazyNamed(() => import('./pages/admin/security/SecurityAuditLogsPage'), 'SecurityAuditLogsPage');

// Intern Pages (Code-Split)
const InternDashboard = lazyNamed(() => import('./pages/intern/InternDashboard'), 'InternDashboard');
const InternAttendancePage = lazyNamed(() => import('./pages/intern/InternAttendancePage'), 'InternAttendancePage');
const InternTasksPage = lazyNamed(() => import('./pages/intern/InternTasksPage'), 'InternTasksPage');
const InternPerformancePage = lazyNamed(() => import('./pages/intern/InternPerformancePage'), 'InternPerformancePage');
const InternReportsPage = lazyNamed(() => import('./pages/intern/InternReportsPage'), 'InternReportsPage');
const InternDocumentsPage = lazyNamed(() => import('./pages/intern/InternDocumentsPage'), 'InternDocumentsPage');
const InternCertificatesPage = lazyNamed(() => import('./pages/intern/InternCertificatesPage'), 'InternCertificatesPage');
const AnnouncementsPage = lazyNamed(() => import('./pages/intern/AnnouncementsPage'), 'AnnouncementsPage');

// Common / Shared Pages (Code-Split)
const NotificationInboxPage = lazyNamed(() => import('./pages/common/NotificationInboxPage'), 'NotificationInboxPage');
const UniversalProfilePage = lazyNamed(() => import('./pages/common/UniversalProfilePage'), 'UniversalProfilePage');

// Public Pages (Code-Split)
const CertificateVerificationPage = lazyNamed(() => import('./pages/public/CertificateVerificationPage'), 'CertificateVerificationPage');
const IdCardVerificationPage = lazyNamed(() => import('./pages/public/IdCardVerificationPage'), 'IdCardVerificationPage');

export default function App() {
  const { isAuthenticated, role } = useAuth();

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public Certificate & ID Card Verification (Zero Auth Required) */}
        <Route path="/verify/certificate/:verificationCode" element={<CertificateVerificationPage />} />
        <Route path="/verify/certificate" element={<CertificateVerificationPage />} />
        <Route path="/verify/id/:code" element={<IdCardVerificationPage />} />
        <Route path="/verify/id" element={<IdCardVerificationPage />} />


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
    </Suspense>
  );
}
