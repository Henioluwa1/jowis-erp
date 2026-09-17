import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { CheckSquare, PlusCircle, ExternalLink } from 'lucide-react';

export const TasksAdminPage = () => {
  const [tasks, setTasks] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    trackId: '',
    cohortId: '',
    dueDate: '2026-09-30 23:59:59',
    priority: 'high',
    maxScore: 100
  });

  const fetchData = async () => {
    try {
      const [taskRes, tRes, cRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/training/tracks'),
        api.get('/training/cohorts')
      ]);
      if (taskRes.data.success) setTasks(taskRes.data.data);
      if (tRes.data.success) setTracks(tRes.data.data);
      if (cRes.data.success) setCohorts(cRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/tasks', newTask);
      if (res.data.success) {
        setCreateModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-400" />
            <span>Tasks & Assignments Oversight</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Publish technical deliverables, set deadlines, and monitor completion rates.
          </p>
        </div>
        <button
          onClick={() => {
            setNewTask({
              title: '',
              description: '',
              trackId: tracks[0]?.id || '',
              cohortId: cohorts[0]?.id || '',
              dueDate: '2026-09-30 23:59:59',
              priority: 'high',
              maxScore: 100
            });
            setCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Assign New Task</span>
        </button>
      </div>

      <div className="erp-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Task Title</th>
              <th className="px-5 py-3.5">Track / Cohort</th>
              <th className="px-5 py-3.5">Priority</th>
              <th className="px-5 py-3.5">Deadline</th>
              <th className="px-5 py-3.5">Max Score</th>
              <th className="px-5 py-3.5">Submissions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-slate-800/30">
                <td className="px-5 py-3.5">
                  <div className="font-bold text-white">{t.title}</div>
                  <div className="text-slate-400 line-clamp-1">{t.description}</div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-slate-200">{t.track_name}</span>
                  <span className="text-[10px] text-slate-500 block">{t.cohort_name || 'All Cohorts'}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    t.priority === 'urgent' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                    t.priority === 'high' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {t.priority}
                  </span>
                </td>
                <td className="px-5 py-3.5 font-mono text-slate-300">{t.due_date}</td>
                <td className="px-5 py-3.5 font-mono font-bold text-white">{t.max_score} pts</td>
                <td className="px-5 py-3.5">
                  <span className="px-2.5 py-1 rounded bg-brand-950 text-brand-300 font-mono text-xs border border-brand-800/50">
                    {t.submission_count || 0} Submissions
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Task Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Assign New Task">
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Title *</label>
            <input
              type="text"
              required
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Track *</label>
            <select
              required
              value={newTask.trackId}
              onChange={(e) => setNewTask({ ...newTask, trackId: e.target.value })}
              className="erp-input w-full"
            >
              <option value="">Select track...</option>
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Deadline</label>
              <input
                type="datetime-local"
                required
                value={newTask.dueDate.replace(' ', 'T')}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value.replace('T', ' ') })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="erp-input w-full"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Instructions</label>
            <textarea
              rows={4}
              required
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold">
              Publish Assignment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
