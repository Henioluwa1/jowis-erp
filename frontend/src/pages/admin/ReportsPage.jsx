import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  FileSpreadsheet,
  Download,
  Clock,
  Users,
  Award,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Briefcase,
  Search,
  Filter,
  RefreshCw,
  Printer,
  ChevronRight,
  Calendar,
  BarChart2,
  Sliders,
  Info,
  ChevronLeft,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell
} from 'recharts';

export const ReportsPage = () => {
  const { role } = useAuth();
  const isMentor = role === 'mentor';
  const isAdmin = role === 'super_admin' || role === 'admin';

  // Sub-Navigation Tabs
  // 'executive' | 'attendance' | 'tasks' | 'performance' | 'cohorts' | 'mentors' | 'export' | 'methodology'
  const [activeTab, setActiveTab] = useState('executive');

  // Filter State
  const [rangePreset, setRangePreset] = useState('30D');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trackId, setTrackId] = useState('ALL');
  const [cohortId, setCohortId] = useState('ALL');

  // Dropdown options
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);

  // Data State for Tabs
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [execData, setExecData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [perfData, setPerfData] = useState(null);
  const [cohortsData, setCohortsData] = useState([]);
  const [tracksData, setTracksData] = useState([]);
  const [mentorData, setMentorData] = useState([]);

  // Drill-Down Modal State
  const [drillModalOpen, setDrillModalOpen] = useState(false);
  const [drillMetric, setDrillMetric] = useState('');
  const [drillTitle, setDrillTitle] = useState('');
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillData, setDrillData] = useState({ records: [], totalCount: 0, page: 1, limit: 25 });

  // Initial Filter Options Loading
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [trRes, chRes] = await Promise.all([
          api.get('/training/tracks'),
          api.get('/training/cohorts')
        ]);
        if (trRes.data?.success) setTracks(trRes.data.data || []);
        if (chRes.data?.success) setCohorts(chRes.data.data || []);
      } catch (err) {
        console.error('Failed to load track/cohort filter options:', err);
      }
    };
    fetchFilterOptions();
  }, []);

  // Update date boundaries based on preset
  useEffect(() => {
    const now = new Date();
    if (rangePreset === '7D') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (rangePreset === '30D') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (rangePreset === '90D') {
      const past = new Date(now);
      past.setDate(past.getDate() - 90);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (rangePreset === 'ALL') {
      setStartDate('');
      setEndDate('');
    }
  }, [rangePreset]);

  // Query Params Builder
  const getFilterParams = () => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (trackId !== 'ALL') params.trackId = trackId;
    if (cohortId !== 'ALL') params.cohortId = cohortId;
    return params;
  };

  // Main Data Fetcher
  const loadTabContent = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = getFilterParams();

      if (activeTab === 'executive') {
        const res = await api.get('/reports/executive', { params });
        if (res.data?.success) setExecData(res.data.data);
      } else if (activeTab === 'attendance') {
        const res = await api.get('/reports/attendance', { params });
        if (res.data?.success) setAttendanceData(res.data.data);
      } else if (activeTab === 'tasks') {
        const res = await api.get('/reports/tasks', { params });
        if (res.data?.success) setTaskData(res.data.data);
      } else if (activeTab === 'performance') {
        const res = await api.get('/reports/performance', { params });
        if (res.data?.success) setPerfData(res.data.data);
      } else if (activeTab === 'cohorts') {
        const [cRes, tRes] = await Promise.all([
          api.get('/reports/cohorts', { params }),
          api.get('/reports/tracks', { params })
        ]);
        if (cRes.data?.success) setCohortsData(cRes.data.data || []);
        if (tRes.data?.success) setTracksData(tRes.data.data || []);
      } else if (activeTab === 'mentors') {
        const res = await api.get('/reports/mentors', { params });
        if (res.data?.success) setMentorData(res.data.data || []);
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'export' && activeTab !== 'methodology') {
      loadTabContent();
    }
  }, [activeTab, rangePreset, startDate, endDate, trackId, cohortId]);

  // Export CSV Trigger
  const handleExport = async (type) => {
    try {
      setErrorMsg('');
      setSuccessMsg(`Preparing ${type.toUpperCase()} CSV export...`);
      const params = getFilterParams();
      const res = await api.get(`/reports/export/${type}`, {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMsg(`Successfully generated and exported ${type.toUpperCase()} report. Action recorded in audit logs.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Export error:', err);
      setErrorMsg('Failed to generate CSV export file.');
    }
  };

  // Open Drill-Down Lineage Modal
  const openDrillDown = async (metric, title, page = 1) => {
    setDrillMetric(metric);
    setDrillTitle(title);
    setDrillModalOpen(true);
    setDrillLoading(true);
    try {
      const res = await api.get('/reports/drill-down', {
        params: { metric, page, limit: 20 }
      });
      if (res.data?.success) {
        setDrillData(res.data.data);
      }
    } catch (err) {
      console.error('Drill down error:', err);
    } finally {
      setDrillLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-brand-400" />
            <span>Reports, Analytics & Management Intelligence</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise analytics engine derived directly from normalized relational tables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-all cursor-pointer"
            title="Print Current Report View"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={() => handleExport(activeTab === 'attendance' ? 'attendance' : activeTab === 'tasks' ? 'tasks' : activeTab === 'performance' ? 'performance' : 'interns')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-brand-600/30 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white">&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* 2. Global Multi-Criteria Filter Bar */}
      <div className="erp-card p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-brand-400" />
            <span>Global Multi-Criteria Filter Engine</span>
          </div>
          <button
            onClick={loadTabContent}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Analytics</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Preset Ranges */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Time Horizon</label>
            <div className="flex rounded-md shadow-sm border border-slate-700 overflow-hidden bg-slate-900">
              {['7D', '30D', '90D', 'ALL', 'custom'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRangePreset(preset)}
                  className={`flex-1 py-1 text-[11px] font-semibold uppercase transition-colors ${
                    rangePreset === preset
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setRangePreset('custom'); }}
              className="w-full erp-input text-xs py-1"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setRangePreset('custom'); }}
              className="w-full erp-input text-xs py-1"
            />
          </div>

          {/* Track Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Training Track</label>
            <select
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="w-full erp-input text-xs py-1.5"
            >
              <option value="ALL">All Tracks (Global)</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Cohort Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Cohort Group</label>
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="w-full erp-input text-xs py-1.5"
            >
              <option value="ALL">All Cohorts</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 overflow-x-auto space-x-1 scrollbar-none">
        {[
          { id: 'executive', label: 'Executive Overview', icon: LayoutGrid },
          { id: 'attendance', label: 'Attendance Analytics', icon: Clock },
          { id: 'tasks', label: 'Tasks & Curriculum', icon: CheckCircle2 },
          { id: 'performance', label: 'Performance Intelligence', icon: Award },
          { id: 'cohorts', label: 'Cohorts & Tracks', icon: Layers },
          { id: 'mentors', label: 'Mentor Workload', icon: Briefcase },
          { id: 'export', label: 'Data Export & Audit', icon: Download },
          { id: 'methodology', label: 'Methodology & Definitions', icon: Info }
        ].map((tab) => {
          const Icon = tab.icon || FileSpreadsheet;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-brand-500 text-brand-400 bg-brand-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading Indicator */}
      {loading && activeTab !== 'export' && activeTab !== 'methodology' ? (
        <div className="erp-card p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-xs font-medium">Computing relational analytics across operational tables...</p>
        </div>
      ) : (
        <>
          {/* ============================================================= */}
          {/* TAB 1: EXECUTIVE DASHBOARD                                    */}
          {/* ============================================================= */}
          {activeTab === 'executive' && execData && (
            <div className="space-y-6">
              {/* 5 KPI Metric Groups */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Interns KPI Card */}
                <div className="erp-card p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider">Intern Operations</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{execData.interns.total}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Total Intern Profiles</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div
                      onClick={() => openDrillDown('active_interns', 'Active Intern Lineage')}
                      className="cursor-pointer hover:bg-slate-800/60 p-1 rounded transition-colors"
                    >
                      <span className="text-slate-400">Active: </span>
                      <span className="font-bold text-emerald-400">{execData.interns.active}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Completed: </span>
                      <span className="font-bold text-blue-400">{execData.interns.completed}</span>
                    </div>
                  </div>
                </div>

                {/* Training Tasks KPI Card */}
                <div className="erp-card p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider">Training Execution</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{execData.training.completionRate}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Task Completion Rate</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Assigned: </span>
                      <span className="font-bold text-slate-200">{execData.training.totalAssignedTasks}</span>
                    </div>
                    <div
                      onClick={() => openDrillDown('overdue_tasks', 'Overdue Task Lineage')}
                      className="cursor-pointer hover:bg-slate-800/60 p-1 rounded transition-colors"
                    >
                      <span className="text-slate-400">Overdue: </span>
                      <span className="font-bold text-rose-400">{execData.training.overdueTasks}</span>
                    </div>
                  </div>
                </div>

                {/* Authoritative Attendance KPI Card */}
                <div className="erp-card p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider">Authoritative Attendance</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{execData.attendance.attendanceRate}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Overall Attendance Rate</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Punctual: </span>
                      <span className="font-bold text-emerald-400">{execData.attendance.punctualityRate}</span>
                    </div>
                    <div
                      onClick={() => openDrillDown('late_attendance', 'Late Attendance Lineage')}
                      className="cursor-pointer hover:bg-slate-800/60 p-1 rounded transition-colors"
                    >
                      <span className="text-slate-400">Avg Late: </span>
                      <span className="font-bold text-amber-400">{execData.attendance.avgLateMinutes}m</span>
                    </div>
                  </div>
                </div>

                {/* Performance KPI Card */}
                <div className="erp-card p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider">Performance Engine</span>
                    <Award className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">
                      {execData.performance.averageScore !== null ? `${execData.performance.averageScore}%` : 'N/A'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Avg Finalized Score</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Finalized: </span>
                      <span className="font-bold text-emerald-400">{execData.performance.finalized}</span>
                    </div>
                    <div
                      onClick={() => openDrillDown('pending_evaluations', 'Pending Evaluation Lineage')}
                      className="cursor-pointer hover:bg-slate-800/60 p-1 rounded transition-colors"
                    >
                      <span className="text-slate-400">Pending: </span>
                      <span className="font-bold text-amber-400">{execData.performance.pending}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section: Track & Cohort Distributions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Interns by Track */}
                <div className="erp-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-400" />
                      <span>Active Intern Distribution by Track</span>
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={execData.distribution.byTrack} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#f8fafc' }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Active Interns" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Active Interns by Cohort */}
                <div className="erp-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                      <span>Active Intern Distribution by Cohort</span>
                    </h3>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={execData.distribution.byCohort} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="code" stroke="#64748b" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                          itemStyle={{ color: '#f8fafc' }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Active Interns" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: ATTENDANCE ANALYTICS                                   */}
          {/* ============================================================= */}
          {activeTab === 'attendance' && attendanceData && (
            <div className="space-y-6">
              {/* KPIs Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Authoritative Rate</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{attendanceData.attendanceRate}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">(Present + Late) / Expected</div>
                </div>
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Punctuality Rate</div>
                  <div className="text-2xl font-black text-blue-400 mt-1">{attendanceData.punctualityRate}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Present On-Time / Expected</div>
                </div>
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Average Late Penalty</div>
                  <div className="text-2xl font-black text-amber-400 mt-1">{attendanceData.avgLateMinutes} min</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Across all late logs</div>
                </div>
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Total Attendance Logs</div>
                  <div className="text-2xl font-black text-white mt-1">{attendanceData.summary.totalRecords}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Recorded in period</div>
                </div>
              </div>

              {/* Daily Trend Chart */}
              <div className="erp-card p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-400" />
                  <span>Daily Attendance Status Volume Trend</span>
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendanceData.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                      <Area type="monotone" dataKey="present" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.4} name="Present" />
                      <Area type="monotone" dataKey="late" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} name="Late" />
                      <Area type="monotone" dataKey="absent" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} name="Absent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Cohort Attendance Table */}
              <div className="erp-card overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Cohort Attendance Breakdown</h3>
                  <button
                    onClick={() => handleExport('attendance')}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Attendance CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Cohort Code</th>
                        <th className="py-3 px-4">Cohort Name</th>
                        <th className="py-3 px-4 text-center">Attendance Rate</th>
                        <th className="py-3 px-4 text-center">Present Days</th>
                        <th className="py-3 px-4 text-center">Late Days</th>
                        <th className="py-3 px-4 text-center">Absent Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {attendanceData.cohortBreakdown.map((c) => (
                        <tr key={c.cohortId} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-brand-300">{c.cohortCode}</td>
                          <td className="py-3 px-4 font-medium text-white">{c.cohortName}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">{c.rate}</td>
                          <td className="py-3 px-4 text-center text-slate-300">{c.present}</td>
                          <td className="py-3 px-4 text-center text-amber-400">{c.late}</td>
                          <td className="py-3 px-4 text-center text-rose-400">{c.absent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 3: TASKS & CURRICULUM ANALYTICS                           */}
          {/* ============================================================= */}
          {activeTab === 'tasks' && taskData && (
            <div className="space-y-6">
              {/* Task Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Total Assigned Tasks</div>
                  <div className="text-2xl font-black text-white mt-1">{taskData.summary.total_assigned}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Active curriculum assignments</div>
                </div>
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Completion Rate</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{taskData.summary.completion_rate}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{taskData.summary.completed_tasks} completed tasks</div>
                </div>
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Submission Rate</div>
                  <div className="text-2xl font-black text-blue-400 mt-1">{taskData.summary.submission_rate}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Submitted + Completed</div>
                </div>
                <div
                  onClick={() => openDrillDown('overdue_tasks', 'Overdue Task Lineage')}
                  className="erp-card p-4 cursor-pointer hover:border-rose-500/40 transition-colors"
                >
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Overdue Backlog</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-2xl font-black text-rose-400 mt-1">{taskData.summary.overdue_tasks}</div>
                  <div className="text-[11px] text-rose-400/80 mt-0.5">Click to inspect lineage</div>
                </div>
              </div>

              {/* Module Performance Table */}
              <div className="erp-card overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Module-by-Module Progression & Mastery</h3>
                  <button
                    onClick={() => handleExport('tasks')}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Tasks CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Module Code</th>
                        <th className="py-3 px-4">Module Title</th>
                        <th className="py-3 px-4">Track</th>
                        <th className="py-3 px-4 text-center">Assignments</th>
                        <th className="py-3 px-4 text-center">Completed</th>
                        <th className="py-3 px-4 text-center">Completion %</th>
                        <th className="py-3 px-4 text-center">Average Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {taskData.modulePerformance.map((m) => (
                        <tr key={m.moduleId} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-brand-300">{m.moduleCode}</td>
                          <td className="py-3 px-4 font-medium text-white">{m.moduleTitle}</td>
                          <td className="py-3 px-4 text-slate-400">{m.trackName}</td>
                          <td className="py-3 px-4 text-center text-slate-300">{m.totalAssignments}</td>
                          <td className="py-3 px-4 text-center text-emerald-400 font-bold">{m.completedCount}</td>
                          <td className="py-3 px-4 text-center font-bold text-brand-400">{m.completionRate}</td>
                          <td className="py-3 px-4 text-center font-bold text-purple-300">
                            {m.avgScore !== null ? `${m.avgScore}%` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 4: PERFORMANCE INTELLIGENCE                               */}
          {/* ============================================================= */}
          {activeTab === 'performance' && perfData && (
            <div className="space-y-6">
              {/* Performance Score Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Average Finalized Score</div>
                  <div className="text-2xl font-black text-purple-400 mt-1">
                    {perfData.summary.averageScore !== null ? `${perfData.summary.averageScore}%` : 'N/A'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Authoritative criteria average</div>
                </div>
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Finalized Evaluations</div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{perfData.summary.finalized}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Locked & authoritative</div>
                </div>
                <div
                  onClick={() => openDrillDown('pending_evaluations', 'Pending Evaluation Lineage')}
                  className="erp-card p-4 cursor-pointer hover:border-amber-500/40 transition-colors"
                >
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Pending Evaluations</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-400 mt-1">{perfData.summary.pending}</div>
                  <div className="text-[11px] text-amber-400/80 mt-0.5">Click to inspect lineage</div>
                </div>
                <div className="erp-card p-4">
                  <div className="text-xs text-slate-400">Score Range</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {perfData.summary.minScore !== null ? `${perfData.summary.minScore}% – ${perfData.summary.maxScore}%` : 'N/A'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Min to Max score spread</div>
                </div>
              </div>

              {/* Rating Bands Distribution Bar Chart */}
              <div className="erp-card p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-brand-400" />
                  <span>Evaluation Outcome Distribution Across Rating Bands</span>
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perfData.ratingBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="ratingBand" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} name="Evaluations Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Criterion-by-Criterion Performance */}
              <div className="erp-card overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Criterion-by-Criterion Score Breakdown</h3>
                  <button
                    onClick={() => handleExport('performance')}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Performance CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Evaluation Criterion</th>
                        <th className="py-3 px-4 text-center">Weight</th>
                        <th className="py-3 px-4 text-center">Max Score</th>
                        <th className="py-3 px-4 text-center">Average Score</th>
                        <th className="py-3 px-4 text-center">Weighted Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {perfData.criteriaPerformance.map((c) => (
                        <tr key={c.criterionId} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                              {c.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-white">{c.name}</td>
                          <td className="py-3 px-4 text-center text-slate-300">{c.weight}%</td>
                          <td className="py-3 px-4 text-center text-slate-400">{c.maxScore}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">
                            {c.avgScore !== null ? `${c.avgScore}` : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-purple-400">
                            {c.avgWeightedScore !== null ? `${c.avgWeightedScore}` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 5: COHORTS & TRACKS                                       */}
          {/* ============================================================= */}
          {activeTab === 'cohorts' && (
            <div className="space-y-6">
              {/* Cohort Matrix Table */}
              <div className="erp-card overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-brand-400" />
                    <span>Cohort Progression & Operational Matrix</span>
                  </h3>
                  <button
                    onClick={() => handleExport('cohorts')}
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Cohorts CSV</span>
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Cohort Code</th>
                        <th className="py-3 px-4">Cohort Name</th>
                        <th className="py-3 px-4">Track</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Active Interns</th>
                        <th className="py-3 px-4 text-center">Attendance %</th>
                        <th className="py-3 px-4 text-center">Task Completion %</th>
                        <th className="py-3 px-4 text-center">Avg Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {cohortsData.map((c) => (
                        <tr key={c.cohort_id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-brand-300">{c.cohort_code}</td>
                          <td className="py-3 px-4 font-medium text-white">{c.cohort_name}</td>
                          <td className="py-3 px-4 text-slate-400">{c.track_name}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-white">{c.active_interns}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">{c.attendance_rate}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-400">{c.task_completion_rate}</td>
                          <td className="py-3 px-4 text-center font-bold text-purple-400">
                            {c.avg_performance_score !== null ? `${c.avg_performance_score}%` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Track Utilization Table */}
              <div className="erp-card overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Track Utilization & Comparative Performance</span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Track Name</th>
                        <th className="py-3 px-4 text-center">Total Interns</th>
                        <th className="py-3 px-4 text-center">Active Interns</th>
                        <th className="py-3 px-4 text-center">Completed</th>
                        <th className="py-3 px-4 text-center">Attendance %</th>
                        <th className="py-3 px-4 text-center">Task Completion %</th>
                        <th className="py-3 px-4 text-center">Avg Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {tracksData.map((t) => (
                        <tr key={t.track_id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-white">{t.track_name}</td>
                          <td className="py-3 px-4 text-center text-slate-300">{t.total_interns}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">{t.active_interns}</td>
                          <td className="py-3 px-4 text-center text-blue-400">{t.completed_interns}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">{t.attendance_rate}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-400">{t.task_completion_rate}</td>
                          <td className="py-3 px-4 text-center font-bold text-purple-400">
                            {t.avg_performance_score !== null ? `${t.avg_performance_score}%` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 6: MENTOR WORKLOAD                                        */}
          {/* ============================================================= */}
          {activeTab === 'mentors' && (
            <div className="space-y-6">
              <div className="erp-card overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-brand-400" />
                      <span>Mentor Operational Workload & Review Cadence</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Scoped by role: Administrators view all mentors; Mentors view their personal assigned workload.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Mentor Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4 text-center">Supervised Interns</th>
                        <th className="py-3 px-4 text-center">Lead Cohorts</th>
                        <th className="py-3 px-4 text-center">Pending Task Reviews</th>
                        <th className="py-3 px-4 text-center">Reviewed Tasks</th>
                        <th className="py-3 px-4 text-center">Pending Evaluations</th>
                        <th className="py-3 px-4 text-center">Finalized Evaluations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {mentorData.map((m) => (
                        <tr key={m.mentor_id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-white">{m.first_name} {m.last_name}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{m.email}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-400">{m.supervised_interns}</td>
                          <td className="py-3 px-4 text-center text-slate-300">{m.lead_cohorts}</td>
                          <td className="py-3 px-4 text-center font-bold text-amber-400">{m.pending_task_reviews}</td>
                          <td className="py-3 px-4 text-center text-emerald-400">{m.total_reviewed_tasks}</td>
                          <td className="py-3 px-4 text-center font-bold text-purple-400">{m.pending_evaluations}</td>
                          <td className="py-3 px-4 text-center text-slate-300">{m.finalized_evaluations}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 7: DATA EXPORT & AUDIT HUB                                */}
          {/* ============================================================= */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="erp-card p-5 bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-brand-500/20">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Standard RFC-4180 CSV Data Exporter</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      Export authoritative operational data formatted strictly according to RFC-4180 with standard UTF-8 CRLF line endings.
                      Every export execution is immutably recorded in the system audit log with requesting user identity, timestamp, and query parameters.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    type: 'attendance',
                    title: 'Authoritative Attendance Register',
                    description: 'Daily check-in logs, calculated punctuality, late penalty minutes, and status history.',
                    icon: Clock,
                    color: 'emerald'
                  },
                  {
                    type: 'interns',
                    title: 'Intern Roster & Lifecycle',
                    description: 'Complete directory with cohort, track, placement, start dates, and lifecycle statuses.',
                    icon: Users,
                    color: 'blue'
                  },
                  {
                    type: 'tasks',
                    title: 'Task Execution & Submissions',
                    description: 'Curriculum task assignments, due dates, submission scores, difficulty, and review statuses.',
                    icon: CheckCircle2,
                    color: 'indigo'
                  },
                  {
                    type: 'performance',
                    title: 'Performance Evaluations',
                    description: 'Finalized evaluation records, weighted criterion scores, rating bands, and reviewer notes.',
                    icon: Award,
                    color: 'purple'
                  },
                  {
                    type: 'cohorts',
                    title: 'Cohort Progression Matrix',
                    description: 'Aggregated cohort metrics including attendance rates, task completion, and active headcount.',
                    icon: Layers,
                    color: 'amber'
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.type} className="erp-card p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-brand-400">
                            <Icon className="w-5 h-5" />
                          </div>
                          <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        </div>
                        <p className="text-xs text-slate-400">{item.description}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-slate-500">RFC-4180 CSV</span>
                        <button
                          onClick={() => handleExport(item.type)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-brand-600/30 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 8: METHODOLOGY & DEFINITIONS                              */}
          {/* ============================================================= */}
          {activeTab === 'methodology' && (
            <div className="space-y-6">
              <div className="erp-card p-6 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Info className="w-5 h-5 text-brand-400" />
                    <span>Analytics Methodology, Mathematical Formulas & Operational Definitions</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Jowis Studio ERP computes management intelligence strictly from transactional tables. No synthetic, predictive, or AI-generated extrapolations are introduced.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300">
                  <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">1. Authoritative Attendance Formula (Phase 1)</div>
                    <p className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                      Attendance Rate = ((Present + Late) / (Present + Late + Absent)) * 100
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Days marked as <span className="text-blue-300 font-semibold">excused</span> are strictly excluded from the expected days denominator to maintain operational equity.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-blue-400 uppercase tracking-wider text-[11px]">2. Punctuality Rate Formula</div>
                    <p className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                      Punctuality Rate = (Present On-Time / (Present + Late + Absent)) * 100
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Late check-ins (after the authoritative 09:00:00 AM cutoff) are tracked separately with individual minute penalties.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-purple-400 uppercase tracking-wider text-[11px]">3. Performance Score Derivation (Phase 4)</div>
                    <p className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                      Overall Score = ∑ ((Criterion Score / Max Score) * Weight)
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Strict domain separation: Performance scoring is derived exclusively from active evaluation criteria. Attendance and task metrics serve solely as contextual evidence.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">4. Task Velocity & Completion</div>
                    <p className="font-mono text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                      Completion Rate = (Completed Tasks / Total Assigned Tasks) * 100
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      A task is classified as Overdue when <span className="font-mono text-rose-300">due_date &lt; NOW()</span> and status remains <span className="font-mono text-slate-300">assigned</span>, <span className="font-mono text-slate-300">in_progress</span>, or <span className="font-mono text-slate-300">returned</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 4. Drill-Down Traceability Modal (Gate 12) */}
      <Modal
        isOpen={drillModalOpen}
        onClose={() => setDrillModalOpen(false)}
        title={drillTitle || 'Lineage Traceability'}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Traceable records ({drillData.totalCount} total)</span>
            <span className="font-mono text-[11px] text-brand-400">Metric: {drillMetric}</span>
          </div>

          {drillLoading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 text-brand-500 animate-spin mx-auto mb-2" />
              <span>Fetching underlying database rows...</span>
            </div>
          ) : drillData.records.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No underlying records found for this metric under current filters.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-semibold sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Intern</th>
                    <th className="py-2.5 px-3">Track / Cohort</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {drillData.records.map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white">{r.first_name || r.intern_first} {r.last_name || r.intern_last}</div>
                        <div className="font-mono text-[10px] text-brand-300">{r.intern_code}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        <div>{r.track_name}</div>
                        <div className="text-slate-500">{r.cohort_name}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {drillMetric === 'overdue_tasks' && (
                          <div>
                            <div className="font-medium text-slate-200">{r.task_title}</div>
                            <div className="text-rose-400 text-[10px]">Due: {new Date(r.due_date).toLocaleDateString()}</div>
                          </div>
                        )}
                        {drillMetric === 'late_attendance' && (
                          <div>
                            <div className="font-medium text-amber-400">{r.late_minutes} minutes late</div>
                            <div className="text-slate-500 text-[10px]">{r.attendance_date} ({r.check_in_time})</div>
                          </div>
                        )}
                        {drillMetric === 'pending_evaluations' && (
                          <div>
                            <div className="font-medium text-slate-200">Reviewer: {r.reviewer_first} {r.reviewer_last}</div>
                            <div className="text-slate-500 text-[10px]">Period: {r.evaluation_period}</div>
                          </div>
                        )}
                        {drillMetric === 'active_interns' && (
                          <div className="text-slate-400 text-[11px]">
                            {r.email} • Started {r.start_date}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => setDrillModalOpen(false)}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Simple LayoutGrid icon helper
const LayoutGrid = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);
