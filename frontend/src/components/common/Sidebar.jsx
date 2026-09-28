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
  Shield,
  ShieldAlert,
  Cpu,
  QrCode,
  FolderKanban,
  X
} from 'lucide-react';

export const Sidebar = ({ mobileOpen, onCloseMobile }) => {
  const { role } = useAuth();
  const isAdminOrMentor = role === 'super_admin' || role === 'admin' || role === 'mentor';
  const isSuperOrAdmin = role === 'super_admin' || role === 'admin';
  const isSuperAdmin = role === 'super_admin';

  // Dynamic portal sidebar theme (UI/UX Pro Max)
  const sidebarThemeClass =
    role === 'super_admin'
      ? 'bg-[#06080f] border-r border-amber-500/20 shadow-xl'
      : role === 'mentor'
      ? 'bg-[#0f0b24] border-r border-purple-500/20 shadow-xl'
      : role === 'intern'
      ? 'bg-[#07151e] border-r border-cyan-500/20 shadow-xl'
      : 'bg-[#090d16] border-r border-blue-500/20 shadow-xl';

  const brandGradientClass =
    role === 'super_admin'
      ? 'from-amber-500 via-amber-600 to-indigo-600 shadow-amber-500/30'
      : role === 'mentor'
      ? 'from-purple-600 via-indigo-600 to-pink-500 shadow-purple-600/30'
      : role === 'intern'
      ? 'from-cyan-500 via-blue-600 to-teal-400 shadow-cyan-500/30'
      : 'from-brand-600 via-blue-600 to-indigo-500 shadow-brand-500/30';

  const activeNavLinkClass =
    role === 'super_admin'
      ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/30 font-bold'
      : role === 'mentor'
      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 font-semibold'
      : role === 'intern'
      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-600/30 font-semibold'
      : 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30 font-semibold';

  // Sectioned Navigation for Admin & Mentors
  const adminNavSections = [
    {
      title: 'WORKSPACE',
      items: [
        { label: 'Executive Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Profile & Digital ID', path: '/admin/profile', icon: User }
      ]
    },
    {
      title: 'ACADEMIC & CURRICULUM',
      items: [
        { label: 'Intern Management', path: '/admin/interns', icon: Users },
        { label: 'Tracks & Cohorts', path: '/admin/training', icon: GraduationCap },
        { label: 'Tasks & Assignments', path: '/admin/tasks', icon: CheckSquare },
        { label: 'Performance Analytics', path: '/admin/performance', icon: BarChart3 }
      ]
    },
    {
      title: 'OPERATIONS & COMPLIANCE',
      items: [
        { label: 'Authoritative Attendance', path: '/admin/attendance', icon: Clock },
        { label: 'Documents & Verification', path: '/admin/documents', icon: FileCheck },
        { label: 'Certificates & Credentials', path: '/admin/certificates', icon: Award },
        { label: 'Reports & Intelligence', path: '/admin/reports', icon: FileSpreadsheet }
      ]
    },
    {
      title: 'COMMUNICATIONS',
      items: [
        { label: 'Communications & Notices', path: '/admin/communications', icon: Megaphone },
        { label: 'Notification Center', path: '/admin/notifications', icon: Bell }
      ]
    },
    ...(isSuperOrAdmin ? [
      {
        title: 'GOVERNANCE & SYSTEM',
        items: [
          { label: 'ERP Automation', path: '/admin/automation', icon: Cpu },
          { label: 'Admin Governance', path: '/admin/governance', icon: Shield },
          { label: 'System Settings', path: '/admin/settings', icon: Settings },
          ...(isSuperAdmin ? [{ label: 'Security & Debugger', path: '/admin/security', icon: ShieldAlert }] : [])
        ]
      }
    ] : [])
  ];

  // Sectioned Navigation for Interns
  const internNavSections = [
    {
      title: 'MY WORKSPACE',
      items: [
        { label: 'Intern Dashboard', path: '/intern/dashboard', icon: LayoutDashboard },
        { label: 'Profile & Digital ID', path: '/intern/profile', icon: User }
      ]
    },
    {
      title: 'ACADEMICS & TASKS',
      items: [
        { label: 'My Tasks & Submissions', path: '/intern/tasks', icon: CheckSquare },
        { label: 'Performance Reviews', path: '/intern/performance', icon: Award },
        { label: 'Career Scorecard', path: '/intern/reports', icon: FileSpreadsheet }
      ]
    },
    {
      title: 'ATTENDANCE & CREDENTIALS',
      items: [
        { label: 'My Attendance Schedule', path: '/intern/attendance', icon: CalendarCheck },
        { label: 'Institutional Documents', path: '/intern/documents', icon: FileText },
        { label: 'My Certificates', path: '/intern/certificates', icon: Award }
      ]
    },
    {
      title: 'COMMUNICATIONS',
      items: [
        { label: 'Announcements', path: '/intern/announcements', icon: Megaphone },
        { label: 'Notification Center', path: '/intern/notifications', icon: Bell }
      ]
    }
  ];

  const sections = isAdminOrMentor ? adminNavSections : internNavSections;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`w-64 border-r flex flex-col flex-shrink-0 min-h-screen transition-transform duration-300 z-50 fixed inset-y-0 left-0 md:static ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      } ${sidebarThemeClass}`}>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${brandGradientClass} flex items-center justify-center font-black text-white shadow-lg`}>
              J
            </div>
            <div>
              <h1 className="text-base font-extrabold text-white tracking-wide">JOWIS STUDIO</h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Enterprise ERP</p>
            </div>
          </div>

          {/* Mobile Close X button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Badge */}
        <div className="px-5 py-2.5 border-b border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Portal Mode</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-950 text-brand-300 border border-brand-800/50 uppercase">
              {role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Sectioned Navigation Links */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="space-y-1">
              {/* Section Header */}
              <div className="px-3 pt-1 pb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 font-mono">
                  {section.title}
                </span>
              </div>

              {/* Section Items */}
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? activeNavLinkClass
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`
                    }
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
          Jowis Studio ERP v1.0.0<br/>
          <span className="text-slate-400 font-mono">Africa/Lagos (UTC+1)</span>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
