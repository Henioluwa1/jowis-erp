import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Award, PlusCircle, CheckCircle, BarChart3 } from 'lucide-react';

export const PerformancePage = () => {
  const [data, setData] = useState(null);
  const [interns, setInterns] = useState([]);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalForm, setEvalForm] = useState({
    internId: '',
    evaluationPeriod: '2026-Month-09',
    technicalSkills: 4,
    taskCompletion: 4,
    problemSolving: 4,
    communication: 4,
    teamwork: 4,
    professionalism: 4,
    learningProgress: 4,
    attendanceRating: 4,
    summaryFeedback: ''
  });

  const fetchData = async () => {
    try {
      const [pRes, iRes] = await Promise.all([
        api.get('/performance/overview'),
        api.get('/interns?limit=100')
      ]);
      if (pRes.data.success) setData(pRes.data.data);
      if (iRes.data.success) setInterns(iRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateEval = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/performance/evaluation', evalForm);
      if (res.data.success) {
        setEvalModalOpen(false);
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
            <Award className="w-6 h-6 text-brand-400" />
            <span>Multi-Factor Performance Evaluations</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Standardized evaluations across technical, problem solving, communication, and attendance competencies.
          </p>
        </div>
        <button
          onClick={() => {
            setEvalForm({
              internId: interns[0]?.id || '',
              evaluationPeriod: '2026-Month-09',
              technicalSkills: 4,
              taskCompletion: 4,
              problemSolving: 4,
              communication: 4,
              teamwork: 4,
              professionalism: 4,
              learningProgress: 4,
              attendanceRating: 4,
              summaryFeedback: ''
            });
            setEvalModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Record New Evaluation</span>
        </button>
      </div>

      {data?.stats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="erp-card p-4">
            <span className="text-xs text-slate-400 uppercase">Average Score</span>
            <p className="text-2xl font-bold text-white mt-1">{data.stats.average}%</p>
          </div>
          <div className="erp-card p-4">
            <span className="text-xs text-emerald-400 uppercase">Top Score</span>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{data.stats.max}%</p>
          </div>
          <div className="erp-card p-4">
            <span className="text-xs text-amber-400 uppercase">Lowest Score</span>
            <p className="text-2xl font-bold text-amber-300 mt-1">{data.stats.min}%</p>
          </div>
          <div className="erp-card p-4">
            <span className="text-xs text-slate-400 uppercase">Total Completed</span>
            <p className="text-2xl font-bold text-slate-300 mt-1">{data.stats.total}</p>
          </div>
        </div>
      )}

      {/* Evaluations Table */}
      <div className="erp-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Intern</th>
              <th className="px-5 py-3.5">Track / Cohort</th>
              <th className="px-5 py-3.5">Evaluation Period</th>
              <th className="px-5 py-3.5">Overall Score</th>
              <th className="px-5 py-3.5">Evaluator</th>
              <th className="px-5 py-3.5">Feedback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {data?.evaluations?.map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-800/30">
                <td className="px-5 py-3.5">
                  <div className="font-bold text-white">{ev.intern_first} {ev.intern_last}</div>
                  <div className="font-mono text-slate-500 text-[10px]">{ev.intern_code}</div>
                </td>
                <td className="px-5 py-3.5 text-slate-300">
                  {ev.track_name} • <span className="text-slate-500">{ev.cohort_name}</span>
                </td>
                <td className="px-5 py-3.5 font-mono text-slate-400">{ev.evaluation_period}</td>
                <td className="px-5 py-3.5">
                  <span className="px-2.5 py-1 rounded bg-indigo-950/80 text-indigo-300 font-mono font-bold text-xs border border-indigo-800/40">
                    {ev.overall_score}%
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-300">
                  {ev.evaluator_first} {ev.evaluator_last}
                </td>
                <td className="px-5 py-3.5 text-slate-400 max-w-sm line-clamp-2">
                  "{ev.summary_feedback}"
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Record Evaluation Modal */}
      <Modal isOpen={evalModalOpen} onClose={() => setEvalModalOpen(false)} title="Record Intern Performance Review">
        <form onSubmit={handleCreateEval} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Select Intern *</label>
            <select
              required
              value={evalForm.internId}
              onChange={(e) => setEvalForm({ ...evalForm, internId: e.target.value })}
              className="erp-input w-full"
            >
              {interns.map(i => (
                <option key={i.id} value={i.id}>{i.first_name} {i.last_name} ({i.intern_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Evaluation Period</label>
            <input
              type="text"
              required
              value={evalForm.evaluationPeriod}
              onChange={(e) => setEvalForm({ ...evalForm, evaluationPeriod: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Technical Skills (1-5)</label>
              <input
                type="number" min="1" max="5"
                value={evalForm.technicalSkills}
                onChange={(e) => setEvalForm({ ...evalForm, technicalSkills: parseInt(e.target.value) })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Task Completion (1-5)</label>
              <input
                type="number" min="1" max="5"
                value={evalForm.taskCompletion}
                onChange={(e) => setEvalForm({ ...evalForm, taskCompletion: parseInt(e.target.value) })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Problem Solving (1-5)</label>
              <input
                type="number" min="1" max="5"
                value={evalForm.problemSolving}
                onChange={(e) => setEvalForm({ ...evalForm, problemSolving: parseInt(e.target.value) })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Communication (1-5)</label>
              <input
                type="number" min="1" max="5"
                value={evalForm.communication}
                onChange={(e) => setEvalForm({ ...evalForm, communication: parseInt(e.target.value) })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Teamwork (1-5)</label>
              <input
                type="number" min="1" max="5"
                value={evalForm.teamwork}
                onChange={(e) => setEvalForm({ ...evalForm, teamwork: parseInt(e.target.value) })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Professionalism (1-5)</label>
              <input
                type="number" min="1" max="5"
                value={evalForm.professionalism}
                onChange={(e) => setEvalForm({ ...evalForm, professionalism: parseInt(e.target.value) })}
                className="erp-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Qualitative Feedback</label>
            <textarea
              rows={3}
              required
              placeholder="Mentor summary observations and growth points..."
              value={evalForm.summaryFeedback}
              onChange={(e) => setEvalForm({ ...evalForm, summaryFeedback: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEvalModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold">
              Save Evaluation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
