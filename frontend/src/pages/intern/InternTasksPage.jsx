import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  CheckSquare,
  Upload,
  CheckCircle2,
  ExternalLink,
  Clock,
  AlertTriangle,
  Play,
  Send,
  Eye,
  Award,
  AlertCircle,
  FileText,
  Filter,
  Search,
  BookOpen,
  Calendar,
  RotateCcw,
  Paperclip,
  Check
} from 'lucide-react';

export const InternTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Form State
  const [submissionForm, setSubmissionForm] = useState({
    submissionUrl: '',
    submissionText: '',
    attachmentFile: null
  });
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks/me');
      if (res.data.success) {
        setTasks(res.data.data);
        // Extract unique modules
        const modMap = new Map();
        res.data.data.forEach(t => {
          if (t.module_id && t.module_title) {
            modMap.set(t.module_id, { id: t.module_id, title: t.module_title, code: t.module_code });
          }
        });
        setModules(Array.from(modMap.values()));
      }
    } catch (err) {
      console.error('Failed to fetch intern tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Workflow State Transition: Start Working
  const handleStartWorking = async (task) => {
    setStatusUpdating(true);
    setErrorMsg('');
    try {
      const res = await api.patch(`/tasks/me/assignments/${task.assignment_id}/status`, {
        status: 'in_progress'
      });
      if (res.data.success) {
        fetchTasks();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update task status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Open Submission Modal
  const openSubmit = (task) => {
    setSelectedTask(task);
    setSubmissionForm({
      submissionUrl: task.submission_url || '',
      submissionText: task.submission_text || '',
      attachmentFile: null
    });
    setSuccessMsg('');
    setErrorMsg('');
    setSubmitModalOpen(true);
  };

  // Open Details Modal
  const openDetails = (task) => {
    setSelectedTask(task);
    setDetailsModalOpen(true);
  };

  // Open Review / Grade Modal
  const openReviewDetails = (task) => {
    setSelectedTask(task);
    setReviewModalOpen(true);
  };

  // Submit Deliverable Work
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submissionForm.submissionUrl && !submissionForm.submissionText && !submissionForm.attachmentFile) {
      setErrorMsg('Please provide a repository URL, implementation summary notes, or attach a deliverable file.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('assignmentId', selectedTask.assignment_id);
      formData.append('taskId', selectedTask.task_id);
      if (submissionForm.submissionUrl) {
        formData.append('submissionUrl', submissionForm.submissionUrl);
      }
      if (submissionForm.submissionText) {
        formData.append('submissionText', submissionForm.submissionText);
      }
      if (submissionForm.attachmentFile) {
        formData.append('attachment', submissionForm.attachmentFile);
      }

      const res = await api.post('/tasks/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message || 'Deliverable submitted successfully.');
        setTimeout(() => {
          setSubmitModalOpen(false);
          fetchTasks();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit deliverable.');
    } finally {
      setSubmitting(false);
    }
  };

  // Computed Metrics
  const totalAssigned = tasks.length;
  const inProgressCount = tasks.filter(t => t.assignment_status === 'in_progress').length;
  const submittedCount = tasks.filter(t => ['submitted', 'under_review'].includes(t.assignment_status)).length;
  const returnedCount = tasks.filter(t => t.assignment_status === 'returned').length;
  const completedCount = tasks.filter(t => t.assignment_status === 'completed').length;
  const overdueCount = tasks.filter(t => t.isOverdue).length;

  const scoredTasks = tasks.filter(t => t.score !== null && t.score !== undefined);
  const avgScore = scoredTasks.length > 0
    ? (scoredTasks.reduce((acc, curr) => acc + parseFloat(curr.score), 0) / scoredTasks.length).toFixed(1)
    : '—';

  // Filtered Tasks
  const filteredTasks = tasks.filter(t => {
    if (selectedModule !== 'ALL' && String(t.module_id) !== String(selectedModule)) return false;
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'OVERDUE' && !t.isOverdue) return false;
      if (selectedStatus !== 'OVERDUE' && t.assignment_status !== selectedStatus) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchMod = t.module_title?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchMod) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-400" />
            <span>My Technical Deliverables</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative workflow engine for curriculum tasks, technical milestones, submissions, and mentor evaluations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTasks}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh Tasks</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner if any */}
      {errorMsg && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white font-bold">×</button>
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="erp-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Tasks</span>
            <CheckSquare className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-white">{totalAssigned}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Assigned to your track</div>
        </div>

        <div className="erp-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>In Progress</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300">{inProgressCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active development</div>
        </div>

        <div className="erp-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Under Review</span>
            <Upload className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-purple-300">{submittedCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Awaiting mentor grade</div>
        </div>

        <div className="erp-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Revisions Req.</span>
            <RotateCcw className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-xl font-bold text-orange-300">{returnedCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Feedback provided</div>
        </div>

        <div className="erp-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400">{completedCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Successfully passed</div>
        </div>

        <div className="erp-card p-3.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Avg. Score</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-300">{avgScore}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{overdueCount} overdue task(s)</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="erp-card p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Module Filter */}
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="erp-input py-1 px-2.5 text-xs bg-slate-900 border-slate-700"
            >
              <option value="ALL">All Curriculum Modules</option>
              {modules.map(m => (
                <option key={m.id} value={m.id}>{m.code ? `[${m.code}] ` : ''}{m.title}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="erp-input py-1 px-2.5 text-xs bg-slate-900 border-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted">Submitted / Under Review</option>
              <option value="returned">Revision Requested</option>
              <option value="completed">Completed</option>
              <option value="OVERDUE">Overdue Only</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search deliverables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="erp-input w-full pl-8 py-1 text-xs bg-slate-900 border-slate-700"
          />
        </div>
      </div>

      {/* Task List / Deliverables View */}
      {loading ? (
        <div className="erp-card p-12 text-center text-slate-500 text-xs">
          Loading assigned deliverables and workflow status...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="erp-card p-12 text-center">
          <CheckSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 font-medium text-xs">No technical deliverables match the selected criteria.</p>
          <p className="text-slate-500 text-[11px] mt-1">Check back once your mentor assigns new milestones or reset filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const isAssigned = task.assignment_status === 'assigned';
            const isInProgress = task.assignment_status === 'in_progress';
            const isReturned = task.assignment_status === 'returned';
            const isSubmitted = ['submitted', 'under_review'].includes(task.assignment_status);
            const isCompleted = task.assignment_status === 'completed';

            return (
              <div
                key={task.assignment_id}
                className={`erp-card p-4 transition-all duration-200 border-l-4 ${
                  isReturned
                    ? 'border-l-orange-500 bg-orange-950/10'
                    : isCompleted
                    ? 'border-l-emerald-500'
                    : isInProgress
                    ? 'border-l-amber-500'
                    : isSubmitted
                    ? 'border-l-purple-500'
                    : 'border-l-sky-500'
                }`}
              >
                {/* Revision Banner if Returned */}
                {isReturned && (
                  <div className="mb-3.5 p-3 bg-orange-950/40 border border-orange-800/80 rounded-lg text-xs">
                    <div className="flex items-center gap-2 text-orange-300 font-semibold mb-1">
                      <RotateCcw className="w-4 h-4 text-orange-400" />
                      <span>Revision Requested by Mentor (Attempt #{task.attempt_number || 1})</span>
                    </div>
                    <div className="text-orange-200/90 pl-6 text-[11px]">
                      {task.feedback ? (
                        <span>&ldquo;{task.feedback}&rdquo;</span>
                      ) : (
                        <span>Please address your mentor&apos;s review comments and resubmit updated deliverables.</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Task Metadata */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-white hover:text-brand-300 cursor-pointer" onClick={() => openDetails(task)}>
                        {task.title}
                      </span>
                      <Badge status={task.assignment_status} />
                      {task.isOverdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-800">
                          <AlertTriangle className="w-3 h-3" />
                          OVERDUE
                        </span>
                      )}
                      {task.difficulty && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                          {task.difficulty}
                        </span>
                      )}
                      {task.task_type && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                          {task.task_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 max-w-3xl">
                      {task.description || 'No overview provided for this milestone.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                      {task.module_title && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-brand-400" />
                          <span>{task.module_code ? `${task.module_code}: ` : ''}{task.module_title}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Deadline: <strong className="text-slate-300">{task.assignment_due_date ? String(task.assignment_due_date).substring(0, 10) : '—'}</strong></span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>Pass: {task.pass_score} / {task.max_score} pts</span>
                      </span>
                      {task.score !== null && task.score !== undefined && (
                        <span className="flex items-center gap-1 font-semibold text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          <span>Earned Score: {task.score} / {task.max_score}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                    <button
                      onClick={() => openDetails(task)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                      title="View Instructions & Expectations"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Instructions</span>
                    </button>

                    {/* Assigned -> Start Working */}
                    {isAssigned && (
                      <button
                        onClick={() => handleStartWorking(task)}
                        disabled={statusUpdating}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Working</span>
                      </button>
                    )}

                    {/* In Progress -> Submit Work */}
                    {isInProgress && (
                      <button
                        onClick={() => openSubmit(task)}
                        className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Submit Work</span>
                      </button>
                    )}

                    {/* Returned -> Resubmit */}
                    {isReturned && (
                      <button
                        onClick={() => openSubmit(task)}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors animate-pulse"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Resubmit Deliverable</span>
                      </button>
                    )}

                    {/* Submitted / Under Review */}
                    {isSubmitted && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-purple-300 bg-purple-950/60 border border-purple-800/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span>Under Review (Attempt #{task.attempt_number || 1})</span>
                        </span>
                        <button
                          onClick={() => openReviewDetails(task)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700"
                          title="View your submitted work"
                        >
                          View
                        </button>
                      </div>
                    )}

                    {/* Completed */}
                    {isCompleted && (
                      <button
                        onClick={() => openReviewDetails(task)}
                        className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 rounded-lg text-xs font-medium border border-emerald-800/80 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>View Evaluation</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Submit Work Modal */}
      <Modal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        title={selectedTask?.assignment_status === 'returned' ? `Resubmit: ${selectedTask?.title}` : `Submit Deliverable: ${selectedTask?.title}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {successMsg && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Overdue Warning */}
          {selectedTask?.isOverdue && (
            <div className="p-2.5 bg-rose-950/50 border border-rose-800/80 text-rose-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Notice: This submission is past the deadline ({String(selectedTask.assignment_due_date).substring(0, 10)}). Your mentor will receive a late deliverable notice.</span>
            </div>
          )}

          {/* Attempt indicator */}
          <div className="p-2 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between text-slate-400 text-[11px]">
            <span>Workflow Milestone: <strong className="text-slate-200">{selectedTask?.title}</strong></span>
            <span className="font-mono text-brand-400 font-semibold">
              Attempt #{((selectedTask?.attempt_number || 0) + (selectedTask?.assignment_status === 'returned' ? 1 : 1))}
            </span>
          </div>

          {/* Previous mentor feedback if revision requested */}
          {selectedTask?.assignment_status === 'returned' && selectedTask.feedback && (
            <div className="p-2.5 bg-orange-950/30 border border-orange-800/60 rounded-lg text-orange-200 text-[11px]">
              <div className="font-semibold text-orange-300 mb-0.5">Mentor Feedback to Address:</div>
              <div>&ldquo;{selectedTask.feedback}&rdquo;</div>
            </div>
          )}

          {/* Project URL */}
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">
              Project Link / Git Repository URL
            </label>
            <input
              type="url"
              placeholder="https://github.com/org/repo or https://www.figma.com/..."
              value={submissionForm.submissionUrl}
              onChange={(e) => setSubmissionForm({ ...submissionForm, submissionUrl: e.target.value })}
              className="erp-input w-full"
            />
            <p className="text-[10px] text-slate-500 mt-1">Direct URL to your repository, deployment preview, or design board.</p>
          </div>

          {/* Implementation Notes */}
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">
              Implementation Notes / Architecture Summary
            </label>
            <textarea
              rows={4}
              placeholder="Explain how you approached this challenge, key design patterns used, testing steps, and challenges solved..."
              value={submissionForm.submissionText}
              onChange={(e) => setSubmissionForm({ ...submissionForm, submissionText: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          {/* File Attachment Upload */}
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">
              Technical Attachment (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                onChange={(e) => setSubmissionForm({ ...submissionForm, attachmentFile: e.target.files[0] })}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Accepted: PDF, ZIP, TAR, DOCX, Images, JSON (Max 15MB). Executable files (.exe, .sh) are prohibited.</p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setSubmitModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Confirm Submission'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Task Details & Instructions Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedTask?.title || 'Deliverable Instructions'}
      >
        {selectedTask && (
          <div className="space-y-4 text-xs">
            {/* Meta tags bar */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-800">
              <Badge status={selectedTask.assignment_status} />
              {selectedTask.difficulty && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-mono text-[10px]">
                  {selectedTask.difficulty}
                </span>
              )}
              {selectedTask.task_type && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                  {selectedTask.task_type.replace('_', ' ')}
                </span>
              )}
              <span className="text-slate-400 ml-auto font-mono">
                Passing: <strong className="text-emerald-400">{selectedTask.pass_score}</strong> / {selectedTask.max_score} pts
              </span>
            </div>

            {/* Overview */}
            <div>
              <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Milestone Overview</h4>
              <p className="text-slate-300 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                {selectedTask.description || 'No description provided.'}
              </p>
            </div>

            {/* Full Technical Instructions */}
            <div>
              <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Technical Instructions & Specifications</h4>
              <div className="text-slate-300 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed max-h-60 overflow-y-auto">
                {selectedTask.instructions || 'Follow the track curriculum guidelines for this milestone.'}
              </div>
            </div>

            {/* Expected Deliverables */}
            <div>
              <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Expected Deliverables</h4>
              <div className="text-slate-300 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                {selectedTask.expected_deliverable || 'Clean, tested code repository with documentation and implementation summary.'}
              </div>
            </div>

            {/* References */}
            {selectedTask.reference_url && (
              <div>
                <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Reference Resources</h4>
                <a
                  href={selectedTask.reference_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 underline font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Reference Materials / Specifications</span>
                </a>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: View Submission & Mentor Evaluation */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Submission & Evaluation: ${selectedTask?.title}`}
      >
        {selectedTask && (
          <div className="space-y-4 text-xs">
            {/* Score banner */}
            <div className={`p-3.5 rounded-lg border flex items-center justify-between ${
              selectedTask.score !== null && selectedTask.score !== undefined
                ? parseFloat(selectedTask.score) >= parseFloat(selectedTask.pass_score)
                  ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/70 text-rose-300'
                : 'bg-purple-950/40 border-purple-800/70 text-purple-300'
            }`}>
              <div>
                <div className="font-semibold uppercase tracking-wider text-[10px]">Evaluation Status</div>
                <div className="text-base font-bold mt-0.5">
                  {selectedTask.score !== null && selectedTask.score !== undefined
                    ? `${selectedTask.score} / ${selectedTask.max_score} Points`
                    : 'Awaiting Mentor Review'}
                </div>
              </div>
              <Badge status={selectedTask.assignment_status} />
            </div>

            {/* Mentor Feedback */}
            {selectedTask.feedback && (
              <div>
                <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Mentor Feedback</h4>
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-slate-200 leading-relaxed">
                  &ldquo;{selectedTask.feedback}&rdquo;
                </div>
              </div>
            )}

            {/* Submitted Repository URL */}
            {selectedTask.submission_url && (
              <div>
                <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Submitted Repository / Link</h4>
                <a
                  href={selectedTask.submission_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 underline font-mono break-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>{selectedTask.submission_url}</span>
                </a>
              </div>
            )}

            {/* Submitted Notes */}
            {selectedTask.submission_text && (
              <div>
                <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Your Submission Notes</h4>
                <p className="text-slate-300 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  {selectedTask.submission_text}
                </p>
              </div>
            )}

            {/* Uploaded Attachment */}
            {selectedTask.attachment_path && (
              <div>
                <h4 className="text-slate-400 uppercase font-bold text-[10px] tracking-wider mb-1">Uploaded Attachment</h4>
                <a
                  href={selectedTask.attachment_path}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 underline font-medium"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Download Deliverable Attachment</span>
                </a>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
