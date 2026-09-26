import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { MetricCard } from '../../components/common/MetricCard';
import {
  CalendarCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Download,
  Printer
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportUtil';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const InternAttendancePage = () => {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, recRes, anaRes] = await Promise.all([
          api.get('/attendance/me/summary'),
          api.get('/attendance/me?limit=50'),
          api.get('/attendance/me/analytics')
        ]);
        if (sumRes.data.success) setSummary(sumRes.data.data);
        if (recRes.data.success) setRecords(recRes.data.data);
        if (anaRes.data.success) setAnalytics(anaRes.data.data);
      } catch (err) {
        console.error('Failed to load intern attendance:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400">
        Loading personal attendance records...
      </div>
    );
  }

  const stats = summary?.stats || {};
  const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#0ea5e9'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-brand-400" />
            <span>My Attendance & Punctuality Analysis</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Detailed breakdown of your session attendance, punctuality rating, and historical records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-all cursor-pointer"
            title="Print / Save PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={async () => {
              try {
                await downloadCSV('/reports/export/attendance', `jowis-my-attendance-${new Date().toISOString().split('T')[0]}.csv`);
              } catch (err) {
                alert(err.message || 'Failed to export attendance CSV');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="erp-card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase">Attendance Rate</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.attendanceRate}%</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{stats.presentDays + stats.lateDays} / {stats.totalDays} days</p>
        </div>
        <div className="erp-card p-4 border-emerald-800/30 bg-emerald-950/20">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase">Punctuality</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.punctualityRate}%</p>
          <p className="text-[10px] text-emerald-400/70 mt-0.5">{stats.presentDays} on-time days</p>
        </div>
        <div className="erp-card p-4 border-amber-800/30 bg-amber-950/20">
          <p className="text-[11px] font-semibold text-amber-400 uppercase">Late Days</p>
          <p className="text-2xl font-bold text-amber-300 mt-1">{stats.lateDays}</p>
          <p className="text-[10px] text-amber-400/70 mt-0.5">Avg: {stats.avgLateMinutes} min late</p>
        </div>
        <div className="erp-card p-4 border-rose-800/30 bg-rose-950/20">
          <p className="text-[11px] font-semibold text-rose-400 uppercase">Absences</p>
          <p className="text-2xl font-bold text-rose-300 mt-1">{stats.absentDays}</p>
          <p className="text-[10px] text-rose-400/70 mt-0.5">{stats.absenceRate}% of sessions</p>
        </div>
        <div className="erp-card p-4 border-sky-800/30 bg-sky-950/20">
          <p className="text-[11px] font-semibold text-sky-400 uppercase">Excused</p>
          <p className="text-2xl font-bold text-sky-300 mt-1">{stats.excusedDays}</p>
          <p className="text-[10px] text-sky-400/70 mt-0.5">Approved medical</p>
        </div>
        <div className="erp-card p-4 border-brand-800/30 bg-brand-950/20">
          <p className="text-[11px] font-semibold text-brand-300 uppercase">Punctuality Trend</p>
          <p className="text-xl font-bold text-brand-400 mt-1">{stats.trend}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Recent 10-day pattern</p>
        </div>
      </div>

      {/* Analytics Charts */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Comparison */}
          <div className="erp-card p-6 lg:col-span-2">
            <h3 className="text-sm font-bold text-white mb-1">Monthly Attendance Breakdown</h3>
            <p className="text-xs text-slate-400 mb-4">Present vs. Late arrivals by month</p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthly}>
                  <XAxis dataKey="month_label" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="present" fill="#10b981" name="Present (<09:00)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill="#f59e0b" name="Late (>=09:00)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Distribution */}
          <div className="erp-card p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Status Distribution</h3>
              <p className="text-xs text-slate-400 mb-2">Overall proportion of statuses</p>
            </div>
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    innerRadius={35}
                    paddingAngle={4}
                  >
                    {analytics.distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-[11px] text-slate-400">
              {analytics.distribution.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                  <span>{d.name}: <strong>{d.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Attendance History Table */}
      <div className="erp-card overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Attendance Session History</h3>
            <p className="text-xs text-slate-400">Complete immutable record of all your check-ins</p>
          </div>
          <span className="text-xs text-slate-500 font-mono">{records.length} Total Sessions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Session Date</th>
                <th className="px-5 py-3">Check-in Time</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Minutes Late</th>
                <th className="px-5 py-3">Source / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-white font-medium">
                    {r.attendance_date}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-300">
                    {r.check_in_time}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge status={r.status} />
                  </td>
                  <td className="px-5 py-3.5 font-mono">
                    {r.late_minutes > 0 ? (
                      <span className="text-amber-400 font-bold">+{r.late_minutes} min</span>
                    ) : (
                      <span className="text-slate-500">0 min</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">
                    {r.marked_by_first ? (
                      <span className="text-sky-400">Admin entry ({r.marked_by_first})</span>
                    ) : (
                      <span>Self check-in</span>
                    )}
                    {r.notes && <span className="text-slate-500"> • {r.notes}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
