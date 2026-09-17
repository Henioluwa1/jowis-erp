import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { MetricCard } from '../../components/common/MetricCard';
import { Badge } from '../../components/common/Badge';
import {
  Users,
  Clock,
  Award,
  BookOpen,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const res = await api.get('/dashboard/admin');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
      setError('Could not connect to backend API server.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 45000); // Live refresh every 45s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-sm">Loading Live ERP Operational Data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 flex items-center gap-3">
        <AlertCircle className="w-6 h-6" />
        <div>
          <p className="font-semibold">Dashboard Connection Error</p>
          <p className="text-xs">{error || 'Unknown error occurred.'}</p>
        </div>
      </div>
    );
  }

  const { interns, training, attendanceToday, performance, charts, recentActivities } = data;
  const PIE_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Top Banner with Operational Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Operational Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time administrative monitoring across all active tracks and cohorts.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={isRefreshing}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Interns"
          value={interns.active}
          subtext={`${interns.total} total enrolled across all cohorts`}
          icon={Users}
          color="brand"
        />
        <MetricCard
          title="Today's Attendance Rate"
          value={`${attendanceToday.rate}%`}
          subtext={`${attendanceToday.present} present, ${attendanceToday.late} late today`}
          icon={Clock}
          color="emerald"
        />
        <MetricCard
          title="Average Performance"
          value={`${performance.averageScore}%`}
          subtext="Evaluated across multi-factor skill competencies"
          icon={Award}
          color="cyan"
        />
        <MetricCard
          title="Active Programs"
          value={training.totalTracks}
          subtext={`${training.activeCohorts} active cohorts • ${training.activeMentors} mentors`}
          icon={BookOpen}
          color="amber"
        />
      </div>

      {/* Today's Authoritative Attendance Monitor */}
      <div className="erp-card p-6 border-slate-800 bg-slate-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Today's Attendance Status (Cutoff: 09:00 AM Lagos)</span>
              <span className="text-xs font-normal text-slate-400">Date: {attendanceToday.date}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Authoritative server check-in records for today</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge status="PRESENT" text={`${attendanceToday.present} Present`} />
            <Badge status="LATE" text={`${attendanceToday.late} Late`} />
            <Badge status="ABSENT" text={`${attendanceToday.absent} Absent`} />
            <Badge status="UPCOMING" text={`${attendanceToday.notMarked} Not Yet Marked`} />
          </div>
        </div>

        {/* Visual Attendance Progress Bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span>Daily Attendance Compliance</span>
            <span className="text-white font-bold">{attendanceToday.rate}% Recorded</span>
          </div>
          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${(attendanceToday.present / (interns.active || 1)) * 100}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title="Present"
            ></div>
            <div
              style={{ width: `${(attendanceToday.late / (interns.active || 1)) * 100}%` }}
              className="bg-amber-500 h-full transition-all duration-500"
              title="Late"
            ></div>
            <div
              style={{ width: `${(attendanceToday.absent / (interns.active || 1)) * 100}%` }}
              className="bg-rose-500 h-full transition-all duration-500"
              title="Absent"
            ></div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <div className="erp-card p-6 lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-1">Attendance Trend (Historical Register)</h3>
          <p className="text-xs text-slate-400 mb-4">Daily comparison of Present vs. Late arrivals</p>
          <div className="h-64 w-full">
            {charts?.attendanceTrend?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="present" fill="#10b981" name="Present (<09:00)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill="#f59e0b" name="Late (>=09:00)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                No attendance trend data available.
              </div>
            )}
          </div>
        </div>

        {/* Track Distribution Pie Chart */}
        <div className="erp-card p-6">
          <h3 className="text-sm font-bold text-white mb-1">Intern Distribution by Track</h3>
          <p className="text-xs text-slate-400 mb-4">Enrollment distribution across specialties</p>
          <div className="h-64 w-full flex items-center justify-center">
            {charts?.trackDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.trackDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {charts.trackDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-xs">No track data found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent System & Audit Activity */}
      <div className="erp-card p-6">
        <h3 className="text-sm font-bold text-white mb-1">Recent ERP Operational Activity</h3>
        <p className="text-xs text-slate-400 mb-4">System and administrative event audit log</p>
        <div className="divide-y divide-slate-800 text-xs">
          {recentActivities?.length > 0 ? (
            recentActivities.map((act, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-brand-300">{act.action}</span>
                  <span className="text-slate-400">on {act.entity_type}</span>
                  {act.first_name && (
                    <span className="text-slate-500">• by {act.first_name} {act.last_name}</span>
                  )}
                </div>
                <span className="text-slate-500 font-mono">{act.created_at}</span>
              </div>
            ))
          ) : (
            <p className="text-slate-500 py-3">No recent activities logged.</p>
          )}
        </div>
      </div>
    </div>
  );
};
