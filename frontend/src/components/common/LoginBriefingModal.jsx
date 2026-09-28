import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Calendar,
  Clock,
  CheckSquare,
  ArrowRight,
  Shield,
  Sparkles,
  X,
  ExternalLink
} from 'lucide-react';

export const LoginBriefingModal = () => {
  const { user, role, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({
    attendanceStatus: null,
    pendingTasksCount: 0,
    isScheduledToday: false,
    todayDayName: ''
  });

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Check if briefing was already dismissed during this browser session
    const hasSeen = sessionStorage.getItem(`jowis_briefing_seen_${user.id}`);
    if (hasSeen) return;

    const fetchBriefingData = async () => {
      try {
        setLoading(true);
        // 1. Fetch recent urgent announcements
        const annRes = await api.get('/communications/announcements?limit=3');
        if (annRes.data?.success) {
          setAnnouncements(annRes.data.data || []);
        }

        // 2. Compute today's day in Lagos
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayDay = days[new Date().getDay()];

        let isScheduled = false;
        if (role === 'intern') {
          const scheduleDays = Array.isArray(user.scheduleDays) ? user.scheduleDays : ['monday', 'tuesday', 'wednesday'];
          isScheduled = scheduleDays.includes(todayDay);
        }

        // 3. Fetch role-specific pending items
        let pendingCount = 0;
        let attStatus = null;

        if (role === 'intern') {
          try {
            const dashRes = await api.get('/dashboard/intern');
            if (dashRes.data?.success) {
              const d = dashRes.data.data;
              attStatus = d.todayAttendance?.status || null;
              pendingCount = (d.activeTasks || []).filter(t => t.status !== 'completed').length;
            }
          } catch (e) {}
        } else {
          try {
            const dashRes = await api.get('/dashboard/admin');
            if (dashRes.data?.success) {
              pendingCount = dashRes.data.data?.pendingApprovals || 0;
            }
          } catch (e) {}
        }

        setStats({
          attendanceStatus: attStatus,
          pendingTasksCount: pendingCount,
          isScheduledToday: isScheduled,
          todayDayName: todayDay
        });

        // Trigger opening
        setIsOpen(true);
      } catch (err) {
        console.error('Failed to load briefing:', err);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to allow portal layout to settle smoothly
    const timer = setTimeout(fetchBriefingData, 800);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.id]);

  const handleDismiss = () => {
    if (user?.id) {
      sessionStorage.setItem(`jowis_briefing_seen_${user.id}`, 'true');
    }
    setIsOpen(false);
  };

  const handleNavigate = (path) => {
    handleDismiss();
    navigate(path);
  };

  if (!isOpen || !user) return null;

  // Determine greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-brand-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl shadow-brand-500/10 text-slate-100 relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Gradient Flare */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-500 via-indigo-500 to-cyan-500" />
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close X */}
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Dismiss Briefing"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/30 flex-shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-400 bg-brand-950/80 px-2.5 py-0.5 rounded-full border border-brand-800/60">
                Daily Operational Briefing
              </span>
              <span className="text-xs text-slate-400">• Lagos Standard Time</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
              {greeting}, {user.firstName}!
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Review your critical daily alerts, institutional notices, and pending items before starting work.
            </p>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* 1. SCHEDULE & ATTENDANCE REMINDER CARD */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                stats.isScheduledToday
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                <Calendar className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Today's Schedule ({stats.todayDayName.toUpperCase()})
                </span>
                <p className="font-semibold text-white mt-0.5">
                  {role === 'intern'
                    ? (stats.isScheduledToday ? 'Official Work Day (Mandatory Attendance)' : 'Self-Study / Off-Duty Day')
                    : 'Institutional Operations Active'}
                </p>
                <p className="text-[10px] text-amber-400 mt-1">
                  Cutoff: 09:00:00 AM (West Africa Time)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                stats.attendanceStatus === 'present'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Attendance Check-in
                </span>
                <p className="font-semibold text-white mt-0.5">
                  {stats.attendanceStatus
                    ? `Status: ${stats.attendanceStatus.toUpperCase()}`
                    : 'Not Marked for Today Yet'}
                </p>
                {role === 'intern' && !stats.attendanceStatus && (
                  <button
                    onClick={() => handleNavigate('/intern/attendance')}
                    className="text-[10px] font-bold text-brand-400 hover:text-brand-300 mt-1 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Check in now</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. URGENT ANNOUNCEMENTS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-brand-400" />
                <span>Priority Institutional Notices</span>
              </span>
              <button
                onClick={() => handleNavigate(role === 'intern' ? '/intern/announcements' : '/admin/communications')}
                className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold cursor-pointer"
              >
                View all notices
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-400 text-center">
                No new unread directives. All clear!
              </div>
            ) : (
              announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-brand-500/40 transition-all flex items-start gap-3"
                >
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex-shrink-0 mt-0.5 ${
                    ann.priority === 'urgent'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  }`}>
                    {ann.priority || 'Notice'}
                  </span>
                  <div className="flex-1 min-w-0 text-xs">
                    <h4 className="font-bold text-white truncate">{ann.title}</h4>
                    <p className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">{ann.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 3. PROFILE & ACTION CHECKLIST */}
          <div className="p-3.5 rounded-2xl bg-brand-950/30 border border-brand-800/40 space-y-2 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-300 block">
              Security & Identity Checklist
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>10-Minute Inactivity Protection Active</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>End-to-End Encrypted Live Chat Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="pt-5 mt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => handleNavigate(role === 'intern' ? '/intern/profile' : '/admin/profile')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <span>View My Profile & Digital ID</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            onClick={handleDismiss}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30 transition-all"
          >
            <span>Acknowledge & Enter Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
