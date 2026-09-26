import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  CheckSquare,
  PlusCircle,
  ExternalLink,
  Search,
  Filter,
  Users,
  Award,
  Clock,
  AlertCircle,
  CheckCircle2,
  FileText,
  Layers,
  ArrowRight,
  TrendingUp,
  Download,
  RotateCcw,
  Edit2,
  Trash2,
  Power,
  Eye,
  X
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportUtil';

const isSafeUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim());

export const TasksAdminPage = () => {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview', 'tasks', 'assignments', 'reviews'
  const [loading, setLoading] = useState(true);

  // Core Data
  const [metrics, setMetrics] = useState(null);
  const [trackBreakdown, setTrackBreakdown] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [modules, setModules] = useState([]);
  const [interns, setInterns] = useState([]);

  // Filters
  const [taskSearch, setTaskSearch] = useState('');
  const [taskTrackFilter, setTaskTrackFilter] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignStatusFilter, setAssignStatusFilter] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('');

  // Modals
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    instructions: '',
    expectedDeliverable: '',
    trackId: '',
    cohortId: '',
    moduleId: '',
    taskType: 'assignment',
    difficulty: 'intermediate',
    dueDate: '2026-10-15T23:59',
    dueDays: 7,
    estimatedHours: 8,
    maxScore: 100,
    passScore: 60,
    priority: 'medium',
    status: 'published'
  });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    taskId: '',
    targetType: 'cohort', // 'cohort' or 'intern'
    cohortId: '',
    internId: '',
    dueDate: '2026-10-15T23:59',
    notes: ''
  });

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedSubForReview, setSelectedSubForReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    score: 85,
    feedback: '',
    outcome: 'completed' // 'completed' or 'returned'
  });

  const [taskDetailModal, setTaskDetailModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);

  // Status feedback
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOverviewAndMetadata = async () => {
    try {
      setLoading(true);
      const [opsRes, tRes, cRes, mRes, iRes] = await Promise.all([
        api.get('/tasks/operations-dashboard'),
        api.get('/training/tracks'),
        api.get('/training/cohorts'),
        api.get('/training/modules'),
        api.get('/interns?status=active&limit=100')
      ]);

      if (opsRes.data.success) {
        setMetrics(opsRes.data.data.metrics);
        setTrackBreakdown(opsRes.data.data.trackBreakdown);
      }
      if (tRes.data.success) setTracks(tRes.data.data);
      if (cRes.data.success) setCohorts(cRes.data.data);
      if (mRes.data.success) setModules(mRes.data.data);
      if (iRes.data.success) setInterns(iRes.data.data.interns || iRes.data.data);
    } catch (err) {
      console.error('Failed to load operations data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTabContent = async () => {
    try {
      if (activeSubTab === 'tasks') {
        const res = await api.get('/tasks', {
          params: { search: taskSearch, trackId: taskTrackFilter, status: taskStatusFilter }
        });
        if (res.data.success) setTasks(res.data.data);
      } else if (activeSubTab === 'assignments') {
        const res = await api.get('/tasks/assignments', {
          params: { search: assignSearch, status: assignStatusFilter }
        });
        if (res.data.success) setAssignments(res.data.data);
      } else if (activeSubTab === 'reviews' || activeSubTab === 'overview') {
        const res = await api.get('/tasks/submissions', {
          params: { status: subStatusFilter }
        });
        if (res.data.success) setSubmissions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load tab data:', err);
    }
  };

  useEffect(() => {
    fetchOverviewAndMetadata();
  }, []);

  useEffect(() => {
    fetchTabContent();
  }, [activeSubTab, taskSearch, taskTrackFilter, taskStatusFilter, assignSearch, assignStatusFilter, subStatusFilter]);

  // Open Create Task
  const openCreateTask = () => {
    setEditingTask(null);
    const defaultTrack = tracks[0]?.id || '';
    const trackMods = modules.filter(m => m.track_id === defaultTrack);
    setTaskForm({
      title: '',
      description: '',
      instructions: '',
      expectedDeliverable: '',
      trackId: defaultTrack,
      cohortId: '',
      moduleId: trackMods[0]?.id || '',
      taskType: 'assignment',
      difficulty: 'intermediate',
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16),
      dueDays: 7,
      estimatedHours: 8,
      maxScore: 100,
      passScore: 60,
      priority: 'medium',
      status: 'published'
    });
    setFormError('');
    setFormSuccess('');
    setCreateTaskModalOpen(true);
  };

  // Open Edit Task
  const openEditTask = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      instructions: task.instructions || '',
      expectedDeliverable: task.expected_deliverable || '',
      trackId: task.track_id,
      cohortId: task.cohort_id || '',
      moduleId: task.module_id || '',
      taskType: task.task_type || 'assignment',
      difficulty: task.difficulty || 'intermediate',
      dueDate: task.due_date ? task.due_date.replace(' ', 'T').slice(0, 16) : '',
      dueDays: task.due_days || 7,
      estimatedHours: task.estimated_hours || 8,
      maxScore: task.max_score,
      passScore: task.pass_score || 60,
      priority: task.priority,
      status: task.status
    });
    setFormError('');
    setFormSuccess('');
    setCreateTaskModalOpen(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      const payload = {
        ...taskForm,
        dueDate: taskForm.dueDate.replace('T', ' ') + ':00'
      };
      if (editingTask) {
        const res = await api.put(`/tasks/${editingTask.id}`, payload);
        if (res.data.success) {
          setFormSuccess('Task updated successfully.');
          setTimeout(() => { setCreateTaskModalOpen(false); fetchTabContent(); fetchOverviewAndMetadata(); }, 800);
        }
      } else {
        const res = await api.post('/tasks', payload);
        if (res.data.success) {
          setFormSuccess('Technical task created successfully.');
          setTimeout(() => { setCreateTaskModalOpen(false); fetchTabContent(); fetchOverviewAndMetadata(); }, 800);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'published' ? 'archived' : 'published';
    try {
      const res = await api.patch(`/tasks/${task.id}/status`, { status: nextStatus });
      if (res.data.success) fetchTabContent();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle task status.');
    }
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Are you sure you want to delete task '${task.title}'?`)) return;
    try {
      const res = await api.delete(`/tasks/${task.id}`);
      if (res.data.success) fetchTabContent();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete task.');
    }
  };

  // Open Assign Modal
  const openAssignModal = (task = null) => {
    const selectedT = task || tasks[0];
    const taskTrack = selectedT?.track_id;
    const eligibleCohorts = cohorts.filter(c => !taskTrack || c.track_id === taskTrack);
    const eligibleInterns = interns.filter(i => !taskTrack || i.track_id === taskTrack);

    setAssignForm({
      taskId: selectedT?.id || '',
      targetType: 'cohort',
      cohortId: eligibleCohorts[0]?.id || '',
      internId: eligibleInterns[0]?.id || '',
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16),
      notes: ''
    });
    setFormError('');
    setFormSuccess('');
    setAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      const payload = {
        taskId: assignForm.taskId,
        dueDate: assignForm.dueDate.replace('T', ' ') + ':00',
        notes: assignForm.notes
      };
      if (assignForm.targetType === 'intern') {
        payload.internId = assignForm.internId;
      } else {
        payload.cohortId = assignForm.cohortId;
      }

      const res = await api.post('/tasks/assignments', payload);
      if (res.data.success) {
        setFormSuccess(res.data.message || 'Task assigned successfully.');
        setTimeout(() => {
          setAssignModalOpen(false);
          fetchTabContent();
          fetchOverviewAndMetadata();
        }, 1000);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to assign task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAssignment = async (assignmentId) => {
    const reason = window.prompt('Enter reason for cancelling this assignment:');
    if (!reason) return;
    try {
      const res = await api.patch(`/tasks/assignments/${assignmentId}/cancel`, { reason });
      if (res.data.success) fetchTabContent();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel assignment.');
    }
  };

  // Review Actions
  const openReviewModal = (sub) => {
    setSelectedSubForReview(sub);
    setReviewForm({
      score: sub.score !== null && sub.score !== undefined ? sub.score : Math.round((sub.max_score || 100) * 0.85),
      feedback: sub.feedback || '',
      outcome: 'completed'
    });
    setFormError('');
    setFormSuccess('');
    setReviewModalOpen(true);
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/submissions/${selectedSubForReview.id}/review`, reviewForm);
      if (res.data.success) {
        setFormSuccess(res.data.message || 'Review submitted successfully.');
        setTimeout(() => {
          setReviewModalOpen(false);
          fetchTabContent();
          fetchOverviewAndMetadata();
        }, 800);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-400" />
            <span>Training Execution & Task Operations</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Publish milestones, assign deliverables to cohorts/interns, review student submissions, and monitor training velocity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await downloadCSV('/reports/export/tasks', `jowis-tasks-report-${new Date().toISOString().split('T')[0]}.csv`, {
                  trackId: taskTrackFilter || undefined,
                  status: taskStatusFilter || undefined,
                  search: taskSearch.trim() || undefined
                });
              } catch (err) {
                alert(err.message || 'Failed to export tasks CSV');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-brand-400" />
            <span>Export Tasks</span>
          </button>
          <button
            onClick={() => openAssignModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Users className="w-4 h-4 text-brand-400" />
            <span>Assign Deliverable</span>
          </button>
          <button
            onClick={openCreateTask}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Task</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Operations Dashboard</span>
        </button>
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'tasks'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Tasks Catalog</span>
        </button>
        <button
          onClick={() => setActiveSubTab('assignments')}
          className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'assignments'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Task Assignments</span>
        </button>
        <button
          onClick={() => setActiveSubTab('reviews')}
          className={`pb-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'reviews'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Mentor Review Desk ({metrics?.pendingReviews || 0} Pending)</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. OPERATIONS DASHBOARD (GATE 10) */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="erp-card p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Modules</span>
              <p className="text-xl font-bold text-white mt-1 font-mono">{metrics?.activeModules || 0}</p>
            </div>
            <div className="erp-card p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Tasks</span>
              <p className="text-xl font-bold text-brand-300 mt-1 font-mono">{metrics?.activeTasks || 0}</p>
            </div>
            <div className="erp-card p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assignments</span>
              <p className="text-xl font-bold text-slate-200 mt-1 font-mono">{metrics?.totalAssignments || 0}</p>
            </div>
            <div className="erp-card p-3.5 bg-brand-950/20 border-brand-800/40">
              <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">Awaiting Review</span>
              <p className="text-xl font-bold text-brand-300 mt-1 font-mono">{metrics?.pendingReviews || 0}</p>
            </div>
            <div className="erp-card p-3.5">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Completed</span>
              <p className="text-xl font-bold text-emerald-300 mt-1 font-mono">{metrics?.completedAssignments || 0}</p>
            </div>
            <div className="erp-card p-3.5">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Overdue Tasks</span>
              <p className="text-xl font-bold text-rose-400 mt-1 font-mono">{metrics?.overdueAssignments || 0}</p>
            </div>
            <div className="erp-card p-3.5">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Avg Task Score</span>
              <p className="text-xl font-bold text-amber-300 mt-1 font-mono">{metrics?.averageScore || 0} pts</p>
            </div>
          </div>

          {/* Review Desk Queue + Track Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Submissions Awaiting Mentor Review */}
            <div className="lg:col-span-2 erp-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-brand-400" />
                  <span>Submissions Awaiting Mentor Review</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">{submissions.filter(s => s.status === 'submitted').length} queued</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Intern</th>
                      <th className="px-3.5 py-2.5">Task Deliverable</th>
                      <th className="px-3.5 py-2.5">Attempt</th>
                      <th className="px-3.5 py-2.5">Submitted</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {submissions.filter(s => s.status === 'submitted').length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500 opacity-60" />
                          No submissions currently waiting for review. All deliverables graded!
                        </td>
                      </tr>
                    ) : (
                      submissions.filter(s => s.status === 'submitted').slice(0, 5).map((s) => (
                        <tr key={s.id} className="hover:bg-slate-800/30">
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-white">{s.first_name} {s.last_name}</div>
                            <span className="text-[10px] font-mono text-brand-400">{s.intern_code}</span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-slate-200">{s.task_title}</div>
                            <span className="text-[10px] text-slate-400">{s.cohort_name || 'Individual'}</span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                              Attempt #{s.attempt_number}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-400">{s.submitted_at?.slice(0, 16)}</td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              onClick={() => openReviewModal(s)}
                              className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded font-semibold text-[11px] cursor-pointer"
                            >
                              Grade Deliverable
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Track Breakdown Card */}
            <div className="erp-card p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Layers className="w-4 h-4 text-brand-400" />
                <span>Track Progress Summary</span>
              </h3>

              <div className="space-y-3">
                {trackBreakdown.map((tb) => (
                  <div key={tb.id} className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 text-xs">{tb.name}</span>
                      <span className="text-[10px] font-mono text-brand-400 bg-brand-950 px-1.5 py-0.5 rounded border border-brand-800/50">
                        {tb.code}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>{tb.module_count} modules • {tb.task_count} tasks</span>
                      <span>{tb.enrolled_interns} interns</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-300 font-mono pt-0.5">
                      <span className="text-emerald-400 font-bold">{tb.completed_tasks} completed</span>
                      <span className="text-slate-500">
                        {tb.enrolled_interns > 0 ? Math.round((tb.completed_tasks / (tb.enrolled_interns * Math.max(tb.task_count, 1))) * 100) : 0}% velocity
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. TASK CATALOG (GATE 3) */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="erp-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Search Tasks</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by title or description..."
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    className="erp-input w-full pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Filter Track</label>
                <select
                  value={taskTrackFilter}
                  onChange={(e) => setTaskTrackFilter(e.target.value)}
                  className="erp-input w-full"
                >
                  <option value="">All Tracks</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Filter Status</label>
                <select
                  value={taskStatusFilter}
                  onChange={(e) => setTaskStatusFilter(e.target.value)}
                  className="erp-input w-full"
                >
                  <option value="">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Task Title</th>
                    <th className="px-5 py-3.5">Module / Track</th>
                    <th className="px-5 py-3.5">Type / Difficulty</th>
                    <th className="px-5 py-3.5">Deadline</th>
                    <th className="px-5 py-3.5">Score / Pass</th>
                    <th className="px-5 py-3.5">Assigned / Submissions</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">No technical tasks found.</td>
                    </tr>
                  ) : (
                    tasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white text-sm">{t.title}</div>
                          <div className="text-slate-400 line-clamp-1 max-w-xs">{t.description}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-slate-200 font-semibold">{t.module_code || 'General'}</span>
                          <span className="text-[10px] text-slate-400 block">{t.track_name}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="uppercase text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                            {t.task_type}
                          </span>
                          <span className="capitalize text-[10px] text-slate-400 block mt-1">{t.difficulty}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-300">{t.due_date?.slice(0, 16)}</td>
                        <td className="px-5 py-3.5 font-mono">
                          <span className="font-bold text-white">{t.max_score} pts</span>
                          <span className="text-[10px] text-slate-400 block">Pass: {t.pass_score} pts</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          <span className="text-slate-200 font-bold">{t.assignment_count || 0} assigned</span>
                          <span className="text-[10px] text-brand-400 block">{t.submission_count || 0} submissions</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge status={t.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openAssignModal(t)}
                              title="Assign Task"
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold text-[11px] cursor-pointer"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => openEditTask(t)}
                              title="Edit Task"
                              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleTaskStatus(t)}
                              title={t.status === 'published' ? 'Archive Task' : 'Publish Task'}
                              className={`p-1.5 rounded-md hover:bg-slate-800 cursor-pointer ${
                                t.status === 'published' ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(t)}
                              title="Delete Task"
                              className="p-1.5 rounded-md hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. TASK ASSIGNMENTS ENGINE (GATE 4) */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'assignments' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="erp-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Search Intern or Task</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search intern name, code, task..."
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    className="erp-input w-full pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Filter Status</label>
                <select
                  value={assignStatusFilter}
                  onChange={(e) => setAssignStatusFilter(e.target.value)}
                  className="erp-input w-full"
                >
                  <option value="">All Statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="returned">Returned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => openAssignModal()}
                  className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-brand-600/30"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Assign New Task</span>
                </button>
              </div>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Target Intern</th>
                    <th className="px-5 py-3.5">Assigned Task</th>
                    <th className="px-5 py-3.5">Track / Cohort</th>
                    <th className="px-5 py-3.5">Deadline</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Submission & Score</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">No task assignments found.</td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/30">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white">{a.first_name} {a.last_name}</div>
                          <span className="text-[10px] font-mono text-brand-400">{a.intern_code}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-200">{a.task_title}</div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">{a.task_type} • {a.max_score} pts</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-slate-300">{a.track_name}</div>
                          <span className="text-[10px] text-slate-500">{a.cohort_name || 'Individual'}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-300">{a.due_date?.slice(0, 16)}</td>
                        <td className="px-5 py-3.5">
                          <Badge status={a.status} />
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          {a.score !== null && a.score !== undefined ? (
                            <span className="text-emerald-400 font-bold">{a.score} / {a.max_score} pts</span>
                          ) : a.status === 'submitted' ? (
                            <span className="text-brand-300 text-[11px]">Submitted (Attempt #{a.attempt_number || 1})</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {a.status !== 'cancelled' && a.status !== 'completed' && (
                            <button
                              onClick={() => handleCancelAssignment(a.id)}
                              className="px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded text-[11px] font-medium transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. MENTOR REVIEW DESK (GATE 7) */}
      {/* ------------------------------------------------------------- */}
      {activeSubTab === 'reviews' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="erp-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Filter Submission Status</label>
                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value)}
                  className="erp-input w-full"
                >
                  <option value="">All Submissions</option>
                  <option value="submitted">Awaiting Review (Submitted)</option>
                  <option value="graded">Approved & Graded</option>
                  <option value="returned">Returned for Revision</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submissions Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Intern Name</th>
                    <th className="px-5 py-3.5">Deliverable</th>
                    <th className="px-5 py-3.5">Submitted Links & Text</th>
                    <th className="px-5 py-3.5">Attempt</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Grade</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">No submissions found.</td>
                    </tr>
                  ) : (
                    submissions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white">{s.first_name} {s.last_name}</div>
                          <span className="text-[10px] font-mono text-brand-400">{s.intern_code}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-200">{s.task_title}</div>
                          <span className="text-[10px] text-slate-400">{s.track_name} • Max: {s.max_score} pts</span>
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          {s.submission_url && isSafeUrl(s.submission_url) && (
                            <a
                              href={s.submission_url.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-400 hover:underline flex items-center gap-1 text-[11px] font-mono truncate mb-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="truncate">{s.submission_url}</span>
                            </a>
                          )}
                          {s.attachment_path && (
                            <a
                              href={s.attachment_path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline flex items-center gap-1 text-[11px] font-mono mb-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>Attached Deliverable</span>
                            </a>
                          )}
                          {s.submission_text && (
                            <p className="text-slate-400 text-[11px] line-clamp-1 italic">"{s.submission_text}"</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-300">#{s.attempt_number}</td>
                        <td className="px-5 py-3.5">
                          <Badge status={s.status} />
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          {s.score !== null && s.score !== undefined ? (
                            <span className="text-emerald-400 font-bold">{s.score} / {s.max_score}</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => openReviewModal(s)}
                            className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded font-semibold text-[11px] cursor-pointer"
                          >
                            {s.status === 'graded' ? 'Regrade' : 'Review & Grade'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: CREATE / EDIT TASK */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={createTaskModalOpen}
        onClose={() => setCreateTaskModalOpen(false)}
        title={editingTask ? `Edit Task: ${editingTask.title}` : 'Publish Technical Task'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Task Deliverable Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Distributed Event Streaming Pipeline with Kafka"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Program Track *</label>
              <select
                required
                value={taskForm.trackId}
                onChange={(e) => {
                  const trackId = e.target.value;
                  const trackMods = modules.filter(m => m.track_id === parseInt(trackId, 10));
                  setTaskForm({ ...taskForm, trackId, moduleId: trackMods[0]?.id || '', cohortId: '' });
                }}
                className="erp-input w-full"
              >
                <option value="">Select track...</option>
                {tracks.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Curriculum Module</label>
              <select
                value={taskForm.moduleId}
                onChange={(e) => setTaskForm({ ...taskForm, moduleId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">General Track Task</option>
                {modules.filter(m => !taskForm.trackId || m.track_id === parseInt(taskForm.trackId, 10)).map(m => (
                  <option key={m.id} value={m.id}>{m.module_code} - {m.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Target Cohort (Optional)</label>
              <select
                value={taskForm.cohortId}
                onChange={(e) => setTaskForm({ ...taskForm, cohortId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">All Cohorts in Track</option>
                {cohorts.filter(c => !taskForm.trackId || c.track_id === parseInt(taskForm.trackId, 10)).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Task Type *</label>
              <select
                value={taskForm.taskType}
                onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })}
                className="erp-input w-full uppercase font-mono"
              >
                <option value="assignment">Assignment</option>
                <option value="project">Project</option>
                <option value="quiz">Quiz</option>
                <option value="practical">Practical</option>
                <option value="research">Research</option>
                <option value="coding">Coding</option>
                <option value="design">Design</option>
                <option value="presentation">Presentation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Difficulty *</label>
              <select
                value={taskForm.difficulty}
                onChange={(e) => setTaskForm({ ...taskForm, difficulty: e.target.value })}
                className="erp-input w-full"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Priority</label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="erp-input w-full"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Max Score</label>
              <input
                type="number"
                min="1"
                required
                value={taskForm.maxScore}
                onChange={(e) => setTaskForm({ ...taskForm, maxScore: e.target.value })}
                className="erp-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Pass Score</label>
              <input
                type="number"
                min="1"
                required
                value={taskForm.passScore}
                onChange={(e) => setTaskForm({ ...taskForm, passScore: e.target.value })}
                className="erp-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Est. Hours</label>
              <input
                type="number"
                min="1"
                value={taskForm.estimatedHours}
                onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                className="erp-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Default Deadline</label>
              <input
                type="datetime-local"
                required
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="erp-input w-full font-mono text-[11px]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Summary Description *</label>
            <textarea
              rows={2}
              required
              placeholder="High-level overview of the task deliverable..."
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Detailed Execution Instructions</label>
            <textarea
              rows={4}
              placeholder="Step-by-step instructions, constraints, required toolchains, and submission formats..."
              value={taskForm.instructions}
              onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })}
              className="erp-input w-full font-mono text-[11px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateTaskModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30 cursor-pointer"
            >
              {submitting ? 'Saving...' : editingTask ? 'Update Task' : 'Publish Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: ASSIGN TASK ENGINE */}
      {/* ------------------------------------------------------------- */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Technical Deliverable"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {formSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Select Task Deliverable *</label>
            <select
              required
              value={assignForm.taskId}
              onChange={(e) => setAssignForm({ ...assignForm, taskId: e.target.value })}
              className="erp-input w-full"
            >
              <option value="">Select a task...</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.track_name} • {t.max_score} pts)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Assignment Target Mode *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, targetType: 'cohort' })}
                className={`p-3 rounded-lg border text-left font-semibold cursor-pointer ${
                  assignForm.targetType === 'cohort'
                    ? 'border-brand-500 bg-brand-950/40 text-brand-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <Users className="w-4 h-4 mb-1" />
                <span>Entire Cohort Batch</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignForm({ ...assignForm, targetType: 'intern' })}
                className={`p-3 rounded-lg border text-left font-semibold cursor-pointer ${
                  assignForm.targetType === 'intern'
                    ? 'border-brand-500 bg-brand-950/40 text-brand-300'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <Award className="w-4 h-4 mb-1" />
                <span>Individual Intern</span>
              </button>
            </div>
          </div>

          {assignForm.targetType === 'cohort' ? (
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Target Cohort *</label>
              <select
                required
                value={assignForm.cohortId}
                onChange={(e) => setAssignForm({ ...assignForm, cohortId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Select cohort batch...</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.cohort_code}) • Track: {c.track_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Target Intern Profile *</label>
              <select
                required
                value={assignForm.internId}
                onChange={(e) => setAssignForm({ ...assignForm, internId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Select active intern...</option>
                {interns.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.first_name} {i.last_name} ({i.intern_code}) • {i.track_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Authoritative Due Date *</label>
            <input
              type="datetime-local"
              required
              value={assignForm.dueDate}
              onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })}
              className="erp-input w-full font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Assignment Notes / Milestones</label>
            <textarea
              rows={2}
              placeholder="Optional notes or milestone instructions for this batch..."
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30 cursor-pointer"
            >
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: MENTOR REVIEW DESK */}
      {/* ------------------------------------------------------------- */}
      {selectedSubForReview && (
        <Modal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title={`Grade Deliverable: ${selectedSubForReview.task_title}`}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveReview} className="space-y-4 text-xs">
            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Intern Deliverable Summary */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-white text-sm">
                    {selectedSubForReview.first_name} {selectedSubForReview.last_name}
                  </span>
                  <span className="text-[10px] font-mono text-brand-400 block">{selectedSubForReview.intern_code}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase">
                    Attempt #{selectedSubForReview.attempt_number}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{selectedSubForReview.submitted_at?.slice(0, 16)}</span>
                </div>
              </div>

              {selectedSubForReview.submission_url && isSafeUrl(selectedSubForReview.submission_url) && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Repository / Live Prototype:</span>
                  <a
                    href={selectedSubForReview.submission_url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-400 hover:underline flex items-center gap-1 font-mono text-[11px] mt-0.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{selectedSubForReview.submission_url}</span>
                  </a>
                </div>
              )}

              {selectedSubForReview.attachment_path && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Attached File:</span>
                  <a
                    href={selectedSubForReview.attachment_path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-mono text-[11px] mt-0.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Submitted File</span>
                  </a>
                </div>
              )}

              {selectedSubForReview.submission_text && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Intern Submission Notes:</span>
                  <p className="text-slate-300 p-2.5 bg-slate-900 rounded border border-slate-800/80 mt-1 whitespace-pre-wrap">
                    {selectedSubForReview.submission_text}
                  </p>
                </div>
              )}
            </div>

            {/* Assessment Decision */}
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Mentor Assessment Outcome *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewForm({ ...reviewForm, outcome: 'completed' })}
                  className={`p-3 rounded-lg border text-left font-semibold cursor-pointer ${
                    reviewForm.outcome === 'completed'
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <Check className="w-4 h-4 mb-1 text-emerald-400" />
                  <span>Approve & Complete Deliverable</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewForm({ ...reviewForm, outcome: 'returned' })}
                  className={`p-3 rounded-lg border text-left font-semibold cursor-pointer ${
                    reviewForm.outcome === 'returned'
                      ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 mb-1 text-amber-400" />
                  <span>Return for Revision</span>
                </button>
              </div>
            </div>

            {/* Score Input (Only if completed) */}
            {reviewForm.outcome === 'completed' && (
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">
                  Final Score (0 to {selectedSubForReview.max_score} pts) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={selectedSubForReview.max_score}
                    required
                    value={reviewForm.score}
                    onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })}
                    className="erp-input w-full font-mono text-base font-bold text-emerald-400"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-500 font-mono">/ {selectedSubForReview.max_score} pts</span>
                </div>
              </div>
            )}

            {/* Feedback textarea */}
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                {reviewForm.outcome === 'returned' ? 'Mandatory Revision Instructions *' : 'Constructive Feedback'}
              </label>
              <textarea
                rows={4}
                required={reviewForm.outcome === 'returned'}
                placeholder={
                  reviewForm.outcome === 'returned'
                    ? 'Explain specifically what requirements or test cases are missing before resubmission...'
                    : 'Praise good architectural decisions and note points for improvement...'
                }
                value={reviewForm.feedback}
                onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                className="erp-input w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30 cursor-pointer"
              >
                {submitting ? 'Submitting Review...' : reviewForm.outcome === 'completed' ? 'Finalize Grade & Approve' : 'Return Deliverable'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
