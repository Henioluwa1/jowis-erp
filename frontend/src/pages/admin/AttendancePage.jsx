import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  Clock,
  Filter,
  Search,
  PlusCircle,
  History,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  CalendarCheck,
  Trash2,
  Lock
} from 'lucide-react';

export const AttendancePage = () => {
  const [overview, setOverview] = useState(null);
  const [records, setRecords] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [interns, setInterns] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('register'); // 'register', 'audit', 'holidays'

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });

  // Correction / Manual modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    internId: '',
    attendanceDate: new Date().toISOString().split('T')[0],
    checkInTime: '08:45:00',
    status: 'PRESENT',
    reason: '',
    notes: ''
  });

  // Holiday modal
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    holidayDate: '',
    name: '',
    description: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchOverview = async () => {
    try {
      const res = await api.get('/attendance/admin/overview');
      if (res.data.success) setOverview(res.data.data);
    } catch (err) {
      console.error('Failed to load overview:', err);
    }
  };

  const fetchRegister = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (searchTerm) params.search = searchTerm;
      if (selectedTrack) params.trackId = selectedTrack;
      if (selectedCohort) params.cohortId = selectedCohort;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedDate) params.date = selectedDate;

      const res = await api.get('/attendance/admin/register', { params });
      if (res.data.success) {
        setRecords(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load attendance register:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/attendance/admin/audit-logs');
      if (res.data.success) setAuditLogs(res.data.data);
    } catch (err) {
      console.error('Failed to load attendance audit logs:', err);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await api.get('/attendance/holidays');
      if (res.data.success) setHolidays(res.data.data);
    } catch (err) {
      console.error('Failed to load company holidays:', err);
    }
  };

  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/attendance/holidays', holidayForm);
      if (res.data.success) {
        setHolidayModalOpen(false);
        setHolidayForm({ holidayDate: '', name: '', description: '' });
        fetchHolidays();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save holiday');
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to remove this holiday date?')) return;
    try {
      const res = await api.delete(`/attendance/holidays/${id}`);
      if (res.data.success) fetchHolidays();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseDay = async () => {
    if (!window.confirm('Execute official attendance closure for today? Unmarked active interns will be recorded as ABSENT.')) return;
    try {
      const res = await api.post('/attendance/admin/close-day', {});
      if (res.data.success) {
        alert(res.data.message);
        fetchOverview();
        fetchRegister();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close attendance.');
    }
  };

  useEffect(() => {
    fetchOverview();
    // Fetch dropdown options
    api.get('/training/tracks').then(res => setTracks(res.data.data || []));
    api.get('/training/cohorts').then(res => setCohorts(res.data.data || []));
    api.get('/interns?limit=100').then(res => setInterns(res.data.data || []));
  }, []);

  useEffect(() => {
    if (activeTab === 'register') {
      fetchRegister();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    } else if (activeTab === 'holidays') {
      fetchHolidays();
    }
  }, [pagination.page, selectedTrack, selectedCohort, selectedStatus, selectedDate, activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination(p => ({ ...p, page: 1 }));
    fetchRegister();
  };

  const openManualModal = (existing = null) => {
    setActionError('');
    setActionSuccess('');
    if (existing) {
      setEditForm({
        internId: existing.intern_id,
        attendanceDate: existing.attendance_date,
        checkInTime: existing.check_in_time,
        status: existing.status,
        reason: '',
        notes: existing.notes || ''
      });
    } else {
      setEditForm({
        internId: interns[0]?.id || '',
        attendanceDate: new Date().toISOString().split('T')[0],
        checkInTime: '08:45:00',
        status: 'PRESENT',
        reason: '',
        notes: ''
      });
    }
    setModalOpen(true);
  };

  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!editForm.reason.trim()) {
      setActionError('Audit rule requirement: You must provide a formal reason for this manual change.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/attendance/admin/manual', editForm);
      if (res.data.success) {
        setActionSuccess(res.data.message);
        setTimeout(() => {
          setModalOpen(false);
          fetchOverview();
          fetchRegister();
          fetchAuditLogs();
        }, 1200);
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to save attendance record.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCSV = () => {
    window.open(`/api/reports/attendance/csv`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-400" />
            <span>Authoritative Attendance Module</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official operational register. Cutoff is 09:00:00 AM Lagos server time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleCloseDay}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            title="Mark unmarked active interns as absent at closing time"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Close Day Attendance</span>
          </button>
          <button
            onClick={() => openManualModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Manual Entry / Override</span>
          </button>
        </div>
      </div>

      {/* Live Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="erp-card p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Active Interns</p>
            <p className="text-2xl font-bold text-white mt-1">{overview.totalActiveInterns}</p>
          </div>
          <div className="erp-card p-4 border-emerald-800/30 bg-emerald-950/20">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase">Present Today</p>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{overview.presentCount}</p>
          </div>
          <div className="erp-card p-4 border-amber-800/30 bg-amber-950/20">
            <p className="text-[11px] font-semibold text-amber-400 uppercase">Late Today</p>
            <p className="text-2xl font-bold text-amber-300 mt-1">{overview.lateCount}</p>
          </div>
          <div className="erp-card p-4 border-rose-800/30 bg-rose-950/20">
            <p className="text-[11px] font-semibold text-rose-400 uppercase">Absent Today</p>
            <p className="text-2xl font-bold text-rose-300 mt-1">{overview.absentCount}</p>
          </div>
          <div className="erp-card p-4 border-slate-800 bg-slate-900/60">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Not Yet Marked</p>
            <p className="text-2xl font-bold text-slate-300 mt-1">{overview.notMarkedCount}</p>
          </div>
          <div className="erp-card p-4 border-brand-800/30 bg-brand-950/20">
            <p className="text-[11px] font-semibold text-brand-300 uppercase">Today's Rate</p>
            <p className="text-2xl font-bold text-brand-400 mt-1">{overview.attendanceRate}%</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('register')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'register'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Daily Register & History
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
            activeTab === 'audit'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Manual Modification Audit Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
            activeTab === 'holidays'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Company Holidays & Working Days</span>
        </button>
      </div>

      {activeTab === 'register' ? (
        <>
          {/* Filters Bar */}
          <div className="erp-card p-4">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search intern name or code..."
                  className="erp-input w-full pl-9 text-xs"
                />
              </div>

              {/* Track filter */}
              <div>
                <select
                  value={selectedTrack}
                  onChange={(e) => setSelectedTrack(e.target.value)}
                  className="erp-input w-full text-xs"
                >
                  <option value="">All Tracks</option>
                  {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Cohort filter */}
              <div>
                <select
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="erp-input w-full text-xs"
                >
                  <option value="">All Cohorts</option>
                  {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Status filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="erp-input w-full text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="EXCUSED">EXCUSED</option>
                </select>
              </div>

              {/* Date filter */}
              <div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="erp-input w-full text-xs"
                />
              </div>
            </form>
          </div>

          {/* Attendance Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Intern</th>
                    <th className="px-5 py-3.5">Track / Cohort</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Arrival Time</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Late (Mins)</th>
                    <th className="px-5 py-3.5">Source / Notes</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        Loading authoritative attendance register...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">
                        No attendance records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-white">
                            {r.first_name} {r.last_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{r.intern_code}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-slate-300">{r.track_name}</div>
                          <div className="text-[10px] text-slate-500">{r.cohort_name}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-300 font-mono">
                          {r.attendance_date}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-medium text-slate-200">
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
                        <td className="px-5 py-3.5 max-w-xs truncate text-slate-400">
                          {r.marked_by_first ? (
                            <span className="text-sky-400">Manual by {r.marked_by_first}</span>
                          ) : (
                            <span>Self check-in</span>
                          )}
                          {r.notes && <span className="text-slate-500"> • {r.notes}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => openManualModal(r)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-brand-300 text-[11px] font-medium border border-slate-700 transition-colors"
                          >
                            Correct / Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing page {pagination.page} of {pagination.pages} ({pagination.total} total records)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'audit' ? (
        /* Audit Logs Tab */
        <div className="erp-card p-6">
          <h3 className="text-base font-bold text-white mb-2">Administrative Attendance Audit Trail</h3>
          <p className="text-xs text-slate-400 mb-6">
            Every manual override or status correction creates an immutable audit record with administrator attribution and reason.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Intern Affected</th>
                  <th className="px-4 py-3">Status Change</th>
                  <th className="px-4 py-3">Time Change</th>
                  <th className="px-4 py-3">Mandatory Reason</th>
                  <th className="px-4 py-3">Administrator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No manual attendance corrections recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-slate-400">{log.created_at}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white">{log.intern_first} {log.intern_last}</span>
                        <span className="text-[10px] text-slate-500 block font-mono">{log.intern_code}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="line-through text-slate-500">{log.old_status}</span>
                          <span className="text-slate-400">→</span>
                          <Badge status={log.new_status} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {log.old_time} → {log.new_time}
                      </td>
                      <td className="px-4 py-3 text-amber-300/90 font-medium">
                        "{log.reason}"
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {log.admin_first} {log.admin_last}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Company Holidays & Non-Working Days Tab */
        <div className="erp-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-brand-400" />
                <span>Configured Company Holidays</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official non-working dates that are mathematically excluded from Expected Attendance days.
              </p>
            </div>
            <button
              onClick={() => {
                setHolidayForm({ holidayDate: '', name: '', description: '' });
                setHolidayModalOpen(true);
              }}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Holiday Date</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Holiday Date</th>
                  <th className="px-4 py-3">Holiday Name</th>
                  <th className="px-4 py-3">Description / Context</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No custom company holidays defined yet.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-bold text-brand-300">{h.holiday_date}</td>
                      <td className="px-4 py-3 text-white font-semibold">{h.name}</td>
                      <td className="px-4 py-3 text-slate-400">{h.description || 'Public non-working holiday'}</td>
                      <td className="px-4 py-3">
                        <Badge status="EXCUSED" text="Non-Working" size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-700"
                          title="Delete holiday"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Working Days Guidance Box */}
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <Clock className="w-4 h-4 text-brand-400" />
              <span>Authoritative Expected Attendance Days Calculation Policy</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              In accordance with organization ERP guidelines, <strong>Saturdays, Sundays, and recorded Company Holidays are strictly non-working days</strong>. The attendance calculation engine derives expected attendance days as:
            </p>
            <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-brand-300">
              Expected Attendance = (Working Days: Mon–Fri) − (Approved Company Holidays) − (Dates prior to intern start date)
            </div>
            <p className="text-slate-500 text-[11px]">
              Non-working days and company holidays are never counted as absences or penalized in punctuality ratings.
            </p>
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      <Modal
        isOpen={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        title="Add Official Company Holiday"
      >
        <form onSubmit={handleCreateHoliday} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Holiday Date *</label>
            <input
              type="date"
              required
              value={holidayForm.holidayDate}
              onChange={(e) => setHolidayForm({ ...holidayForm, holidayDate: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Holiday Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. National Day, Mid-Term Center Recess..."
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Description / Notes</label>
            <input
              type="text"
              placeholder="Optional additional notes..."
              value={holidayForm.description}
              onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setHolidayModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30"
            >
              Save Company Holiday
            </button>
          </div>
        </form>
      </Modal>

      {/* Manual Mark / Correction Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Manual Attendance Record / Correction"
      >
        <form onSubmit={handleSaveCorrection} className="space-y-4">
          {actionError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Select Intern</label>
            <select
              value={editForm.internId}
              onChange={(e) => setEditForm({ ...editForm, internId: e.target.value })}
              className="erp-input w-full text-xs"
              required
            >
              <option value="">Choose intern...</option>
              {interns.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.first_name} {it.last_name} ({it.intern_code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Attendance Date</label>
              <input
                type="date"
                value={editForm.attendanceDate}
                onChange={(e) => setEditForm({ ...editForm, attendanceDate: e.target.value })}
                className="erp-input w-full text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Check-in Time</label>
              <input
                type="time"
                step="1"
                value={editForm.checkInTime}
                onChange={(e) => setEditForm({ ...editForm, checkInTime: e.target.value })}
                className="erp-input w-full text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Authoritative Status</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              className="erp-input w-full text-xs"
              required
            >
              <option value="PRESENT">PRESENT (On-time before 09:00 AM)</option>
              <option value="LATE">LATE (After 09:00 AM)</option>
              <option value="ABSENT">ABSENT</option>
              <option value="EXCUSED">EXCUSED (Medical / Approved)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Audit Reason <span className="text-rose-400">*Required</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Approved medical absence, transport delay verification..."
              value={editForm.reason}
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
              className="erp-input w-full text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Optional Notes</label>
            <input
              type="text"
              placeholder="Additional internal notes..."
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="erp-input w-full text-xs"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30"
            >
              {submitting ? 'Saving...' : 'Save & Record Audit Log'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
