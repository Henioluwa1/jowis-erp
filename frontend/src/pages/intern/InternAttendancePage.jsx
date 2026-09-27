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
  Printer,
  Calendar,
  Lock,
  CalendarOff,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban
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
import { ScheduleSetupModal } from '../../components/common/ScheduleSetupModal';
import { PermissionRequestModal } from '../../components/common/PermissionRequestModal';

export const InternAttendancePage = () => {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'permissions'
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [schedule, setSchedule] = useState({ scheduleDays: [], locked: false });
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchData = async () => {
    try {
      const [sumRes, recRes, anaRes, schRes, permRes] = await Promise.all([
        api.get('/attendance/me/summary'),
        api.get('/attendance/me?limit=50'),
        api.get('/attendance/me/analytics'),
        api.get('/attendance/schedule').catch(() => ({ data: { data: { scheduleDays: [], locked: false } } })),
        api.get('/permissions').catch(() => ({ data: { data: [] } }))
      ]);

      if (sumRes.data?.success) setSummary(sumRes.data.data);
      if (recRes.data?.success) setRecords(recRes.data.data);
      if (anaRes.data?.success) setAnalytics(anaRes.data.data);
      if (schRes.data?.success) setSchedule(schRes.data.data);
      if (permRes.data?.success) setPermissions(permRes.data.data || []);
    } catch (err) {
      console.error('Failed to load intern attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCancelPermission = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this pending permission request?')) {
      return;
    }
    try {
      setCancellingId(id);
      const res = await api.post(`/permissions/${id}/cancel`, {
        reason: 'Cancelled by intern'
      });
      if (res.data?.success) {
        await fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel permission request.');
    } finally {
      setCancellingId(null);
    }
  };

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
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-brand-400" />
            <span>My Attendance & Punctuality Portal</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative 3-day schedule management, presence logs, and absence permission requests.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPermissionModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Request Permission</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-all cursor-pointer"
            title="Print / Save PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
          <button
            onClick={async () => {
              try {
                if (activeTab === 'permissions') {
                  await downloadCSV('/reports/export/permissions', `jowis-my-permissions-${new Date().toISOString().split('T')[0]}.csv`);
                } else {
                  await downloadCSV('/reports/export/attendance', `jowis-my-attendance-${new Date().toISOString().split('T')[0]}.csv`);
                }
              } catch (err) {
                alert(err.message || 'Failed to export CSV');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{activeTab === 'permissions' ? 'Export Permissions CSV' : 'Export Attendance CSV'}</span>
          </button>
        </div>
      </div>

      {/* Schedule Configuration Banner */}
      {!schedule?.locked ? (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-300">Attendance Schedule Not Configured</p>
              <p className="text-xs text-amber-400/80">
                You must configure your permanent 3-day attendance schedule (Monday is compulsory + exactly 2 additional days).
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition-colors shrink-0 cursor-pointer"
          >
            Configure 3-Day Schedule
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
              <Lock className="w-3 h-3" />
              <span>Locked 3-Day Schedule</span>
            </div>
            <div className="flex items-center gap-1.5">
              {schedule.scheduleDays?.map(d => (
                <span
                  key={d}
                  className="px-2.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/40 uppercase font-mono font-bold text-[11px]"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            * Monday is compulsory. Non-scheduled weekdays are excluded from your attendance rate denominator.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'attendance'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4" />
            <span>Attendance & Punctuality Records</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'permissions'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4" />
            <span>Permission & Absence Requests</span>
            {permissions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {permissions.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {activeTab === 'attendance' && (
        <div className="space-y-6">
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
              <p className="text-[10px] text-sky-400/70 mt-0.5">Approved medical/leave</p>
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
                  {records.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-5 py-8 text-center text-slate-500">
                        No attendance records logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="erp-card overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CalendarOff className="w-4 h-4 text-amber-400" />
                  <span>Submitted Permission & Absence Requests</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track the two-stage approval workflow (Mentor review followed by Admin final determination).
                </p>
              </div>
              <button
                onClick={() => setShowPermissionModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow transition-colors self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Permission Request</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Request Code</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Dates</th>
                    <th className="px-5 py-3">Affected Work Days</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Mentor Review</th>
                    <th className="px-5 py-3">Admin Final Decision</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {permissions.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-white font-medium">
                        {p.request_code}
                      </td>
                      <td className="px-5 py-3.5 capitalize text-slate-300">
                        {p.request_type?.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-300 whitespace-nowrap">
                        {p.start_date} <span className="text-slate-500">to</span> {p.end_date}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {p.affected_days_count} {p.affected_days_count === 1 ? 'Day' : 'Days'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 max-w-xs">
                        <p className="font-semibold text-white truncate">{p.reason}</p>
                        {p.message && <p className="text-[11px] text-slate-400 truncate">{p.message}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <Badge status={p.mentor_review || 'PENDING'} />
                          {p.mentor_name && (
                            <p className="text-[10px] text-slate-400">By {p.mentor_name}</p>
                          )}
                          {p.mentor_notes && (
                            <p className="text-[10px] text-slate-500 italic truncate max-w-[150px]">"{p.mentor_notes}"</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <Badge status={p.status} />
                          {p.reviewer_name && (
                            <p className="text-[10px] text-slate-400">By {p.reviewer_name}</p>
                          )}
                          {p.admin_notes && (
                            <p className="text-[10px] text-slate-500 italic truncate max-w-[150px]">"{p.admin_notes}"</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={p.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {p.status === 'PENDING' ? (
                          <button
                            onClick={() => handleCancelPermission(p.id)}
                            disabled={cancellingId === p.id}
                            className="px-2.5 py-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-900/50 rounded-lg transition-colors cursor-pointer"
                          >
                            {cancellingId === p.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {permissions.length === 0 && (
                    <tr>
                      <td colSpan="9" className="px-5 py-10 text-center text-slate-500">
                        No permission requests submitted yet. Use "Request Permission" to request absence.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Setup Modal */}
      <ScheduleSetupModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onScheduleSaved={() => fetchData()}
      />

      {/* Permission Request Modal */}
      <PermissionRequestModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        scheduleDays={schedule.scheduleDays}
        onSuccess={() => {
          fetchData();
          setActiveTab('permissions');
        }}
      />
    </div>
  );
};

export default InternAttendancePage;
