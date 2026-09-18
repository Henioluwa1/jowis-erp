import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Clock,
  BookOpen,
  CheckSquare,
  BarChart3,
  FileSpreadsheet,
  Settings,
  Bell,
  GraduationCap,
  CalendarCheck,
  Award,
  User,
  FileCheck,
  FileText,
  Megaphone,
  Shield
} from 'lucide-react';

export const Sidebar = () => {
  const { role } = useAuth();
  const isAdminOrMentor = role === 'super_admin' || role === 'admin' || role === 'mentor';
  const isSuperOrAdmin = role === 'super_admin' || role === 'admin';

  const adminNavItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Intern Management', path: '/admin/interns', icon: Users },
    { label: 'Tracks & Cohorts', path: '/admin/training', icon: GraduationCap },
    { label: 'Authoritative Attendance', path: '/admin/attendance', icon: Clock },
    { label: 'Tasks & Assignments', path: '/admin/tasks', icon: CheckSquare },
    { label: 'Performance Analytics', path: '/admin/performance', icon: BarChart3 },
    { label: 'Reports & Intelligence', path: '/admin/reports', icon: FileSpreadsheet },
    { label: 'Documents & Verification', path: '/admin/documents', icon: FileCheck },
    { label: 'Certificates & Credentials', path: '/admin/certificates', icon: Award },
    { label: 'Communications & Notices', path: '/admin/communications', icon: Megaphone },
    { label: 'Notification Center', path: '/admin/notifications', icon: Bell },
    ...(isSuperOrAdmin ? [
      { label: 'Administration & Governance', path: '/admin/governance', icon: Shield },
      { label: 'System Settings', path: '/admin/settings', icon: Settings }
    ] : [])
  ];

  const internNavItems = [
    { label: 'Intern Dashboard', path: '/intern/dashboard', icon: LayoutDashboard },
    { label: 'My Track & Placement', path: '/intern/profile', icon: User },
    { label: 'My Attendance', path: '/intern/attendance', icon: CalendarCheck },
    { label: 'My Tasks & Submissions', path: '/intern/tasks', icon: CheckSquare },
    { label: 'My Performance', path: '/intern/performance', icon: Award },
    { label: 'Career Scorecard', path: '/intern/reports', icon: FileSpreadsheet },
    { label: 'Institutional Documents', path: '/intern/documents', icon: FileText },
    { label: 'My Certificates', path: '/intern/certificates', icon: Award },
    { label: 'Announcements', path: '/intern/announcements', icon: Megaphone },
    { label: 'Notification Center', path: '/intern/notifications', icon: Bell }
  ];

  const navItems = isAdminOrMentor ? adminNavItems : internNavItems;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
          J
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide">JOWIS STUDIO</h1>
          <p className="text-[10px] font-medium uppercase tracking-wider text-brand-400">Enterprise ERP</p>
        </div>
      </div>

      {/* Role Badge */}
      <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Portal Mode</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-brand-950 text-brand-300 border border-brand-800/50 uppercase">
            {role?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
        Jowis Studio ERP v1.0.0<br/>
        <span className="text-slate-400">Timezone: Africa/Lagos (UTC+1)</span>
      </div>
    </aside>
  );
};
