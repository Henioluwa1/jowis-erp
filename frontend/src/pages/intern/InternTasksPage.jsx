import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { CheckSquare, Upload, CheckCircle2, ExternalLink } from 'lucide-react';

export const InternTasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [submissionForm, setSubmissionForm] = useState({ submissionUrl: '', submissionText: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks/me');
      if (res.data.success) setTasks(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const openSubmit = (task) => {
    setSelectedTask(task);
    setSubmissionForm({
      submissionUrl: task.submission_url || '',
      submissionText: task.submission_text || ''
    });
    setSuccessMsg('');
    setSubmitModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/${selectedTask.id}/submit`, submissionForm);
      if (res.data.success) {
        setSuccessMsg('Deliverable submitted successfully to your mentor.');
        setTimeout(() => {
          setSubmitModalOpen(false);
          fetchTasks();
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-brand-400" />
          <span>My Tasks & Assignments</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Technical milestones, submissions, deadlines, and mentor feedback.
        </p>
      </div>

      <div className="erp-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Deliverable Title</th>
              <th className="px-5 py-3.5">Deadline</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Score</th>
              <th className="px-5 py-3.5">Mentor Feedback</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-slate-800/30">
                <td className="px-5 py-3.5">
                  <div className="font-bold text-white">{t.title}</div>
                  <div className="text-slate-400 line-clamp-1">{t.description}</div>
                </td>
                <td className="px-5 py-3.5 font-mono text-slate-300">{t.due_date}</td>
                <td className="px-5 py-3.5">
                  <Badge status={t.submission_status || 'ASSIGNED'} />
                </td>
                <td className="px-5 py-3.5 font-mono font-bold">
                  {t.score !== null && t.score !== undefined ? (
                    <span className="text-emerald-400">{t.score} / {t.max_score}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate">
                  {t.feedback ? `"${t.feedback}"` : 'Awaiting mentor review'}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => openSubmit(t)}
                    className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded font-medium text-[11px]"
                  >
                    {t.submission_status ? 'Update Submission' : 'Submit Work'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={submitModalOpen} onClose={() => setSubmitModalOpen(false)} title={`Submit: ${selectedTask?.title}`}>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {successMsg && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Project Link / Repo URL *</label>
            <input
              type="url"
              required
              placeholder="https://github.com/... or https://figma.com/..."
              value={submissionForm.submissionUrl}
              onChange={(e) => setSubmissionForm({ ...submissionForm, submissionUrl: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Submission Notes / Summary</label>
            <textarea
              rows={4}
              placeholder="Provide context, key architectural decisions, or test results..."
              value={submissionForm.submissionText}
              onChange={(e) => setSubmissionForm({ ...submissionForm, submissionText: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setSubmitModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-brand-600 text-white font-semibold rounded-lg">
              {submitting ? 'Submitting...' : 'Confirm Submission'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
