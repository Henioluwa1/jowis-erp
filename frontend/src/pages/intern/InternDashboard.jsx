import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { MetricCard } from '../../components/common/MetricCard';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  CalendarCheck,
  TrendingUp,
  Award,
  BookOpen,
  Bell,
  Check,
  Loader2
} from 'lucide-react';

export const InternDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState(null);
  const [checkInError, setCheckInError] = useState('');

  const fetchInternDashboard = async () => {
    try {
      const res = await api.get('/dashboard/intern');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load intern dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInternDashboard();
  }, []);

  const handleMarkAttendance = async () => {
    setCheckingIn(true);
    setCheckInMessage(null);
    setCheckInError('');

    try {
      const res = await api.post('/attendance/check-in');
      if (res.data.success) {
        setCheckInMessage(res.data);
        await fetchInternDashboard();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Check-in failed. Please try again.';
      setCheckInError(msg);
      // Refresh to ensure we have current state
      fetchInternDashboard();
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
        Could not load intern profile data.
      </div>
    );
  }

  const { profile, todayAttendance, attendanceStats, performance, trainingProgress, announcements } = data;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="erp-card p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">Internship Portal</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">{profile.internCode}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">Welcome, {profile.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-2">
              <span>Track: <strong className="text-white font-semibold">{profile.track}</strong></span>
              <span>Cohort: <strong className="text-white font-semibold">{profile.cohort}</strong></span>
              <span>Lead Mentor: <strong className="text-white font-semibold">{profile.mentor}</strong></span>
            </div>
          </div>
          <div className="self-start md:self-auto">
            <Badge status={profile.status} text={`Status: ${profile.status}`} />
          </div>
        </div>
      </div>

      {/* TODAY'S ATTENDANCE CHECK-IN WIDGET (CRITICAL UX REQUIREMENT) */}
      <div className="erp-card p-6 border-slate-800 bg-slate-900/90 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400">Daily Attendance Register</span>
            <h3 className="text-lg font-bold text-white mt-0.5">Today's Presence & Time Logging</h3>
            <p className="text-xs text-slate-400">
              Organizational cutoff is 09:00:00 AM (Africa/Lagos timezone).
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            Official Date: <span className="text-white font-bold">{todayAttendance.date}</span>
          </div>
        </div>

        {/* Action feedback alerts */}
        {checkInMessage && (
          <div className={`mt-4 p-4 rounded-lg text-xs flex items-center gap-3 ${
            checkInMessage.data?.status === 'PRESENT'
              ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
              : 'bg-amber-950/70 border border-amber-800 text-amber-300'
          }`}>
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold">{checkInMessage.message}</p>
              <p className="text-[11px] opacity-80">Recorded in official database at {checkInMessage.data?.checkInTime}</p>
            </div>
          </div>
        )}

        {checkInError && (
          <div className="mt-4 p-4 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{checkInError}</span>
          </div>
        )}

        {/* Check-in State Display */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-xl bg-slate-950/70 border border-slate-800/80">
          {todayAttendance.isCheckedIn ? (
            /* Already checked in */
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                  todayAttendance.record?.status === 'PRESENT'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                }`}>
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Attendance Already Recorded:</span>
                    <Badge status={todayAttendance.record?.status} />
                  </div>
                  <div className="text-xl font-bold text-white mt-1">
                    Check-in Time: <span className="font-mono text-brand-300">{todayAttendance.record?.check_in_time}</span>
                  </div>
                  {todayAttendance.record?.late_minutes > 0 ? (
                    <p className="text-xs text-amber-400 font-medium mt-0.5">
                      ⚠️ Logged as LATE (+{todayAttendance.record.late_minutes} minutes after 09:00 AM cutoff)
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-400 font-medium mt-0.5">
                      ✓ Logged as PRESENT (On-time arrival)
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500 font-mono">
                Single daily check-in verified.
              </div>
            </div>
          ) : (
            /* Not yet checked in */
            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance Status</p>
                <p className="text-base font-bold text-slate-200 mt-1">
                  You haven't marked your attendance yet today.
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click the button to record your arrival using authoritative server time.
                </p>
              </div>
              <button
                onClick={handleMarkAttendance}
                disabled={checkingIn}
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {checkingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authorizing Timestamp...</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>MARK ATTENDANCE NOW</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Attendance Rate"
          value={`${attendanceStats.attendanceRate}%`}
          subtext={`${attendanceStats.presentDays + attendanceStats.lateDays} of ${attendanceStats.totalDays} sessions attended`}
          icon={CalendarCheck}
          color="brand"
        />
        <MetricCard
          title="Punctuality Rate"
          value={`${attendanceStats.punctualityRate}%`}
          subtext={`${attendanceStats.presentDays} days arrived before 09:00 AM`}
          icon={CheckCircle}
          color="emerald"
        />
        <MetricCard
          title="Late Days"
          value={attendanceStats.lateDays}
          subtext="Arrived at or after 09:00 AM"
          icon={Clock}
          color="amber"
        />
        <MetricCard
          title="Overall Performance"
          value={performance ? `${performance.overallScore}%` : 'N/A'}
          subtext={performance ? `Evaluation: ${performance.feedback?.slice(0, 35)}...` : 'Pending evaluation'}
          icon={Award}
          color="cyan"
        />
      </div>

      {/* Training Progress & Curriculum Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Curriculum Progress Tracker */}
        <div className="erp-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Curriculum Training Progress</h3>
              <p className="text-xs text-slate-400">Your step-by-step progress through required modules</p>
            </div>
            <span className="text-sm font-bold text-brand-400">{trainingProgress.overallPercentage}% Completed</span>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden mb-6">
            <div
              style={{ width: `${trainingProgress.overallPercentage}%` }}
              className="bg-brand-500 h-full rounded-full transition-all duration-500"
            ></div>
          </div>

          {/* Modules List */}
          <div className="space-y-3">
            {trainingProgress.modules?.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    m.status === 'completed'
                      ? 'bg-emerald-500 text-slate-950'
                      : m.status === 'in_progress'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {m.status === 'completed' ? <Check className="w-3 h-3 stroke-[3]" /> : i + 1}
                  </div>
                  <span className="font-semibold text-slate-200">{m.module_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400">{m.completion_percentage}%</span>
                  <Badge status={m.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Announcements Sidebar */}
        <div className="erp-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Recent Announcements</h3>
          </div>
          <div className="space-y-3">
            {announcements?.length > 0 ? (
              announcements.map((ann) => (
                <div key={ann.id} className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs space-y-1">
                  <p className="font-bold text-slate-200">{ann.title}</p>
                  <p className="text-slate-400 text-[11px] line-clamp-3">{ann.content}</p>
                  <p className="text-[10px] text-slate-500 font-mono pt-1">{ann.created_at}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No current announcements.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
