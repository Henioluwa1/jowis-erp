import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { GraduationCap, BookOpen, Users, PlusCircle, CheckCircle } from 'lucide-react';

export const TrainingPage = () => {
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Track Modal
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [trackForm, setTrackForm] = useState({ name: '', description: '', durationWeeks: 24, requiredSkills: '' });

  // New Cohort Modal
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [cohortForm, setCohortForm] = useState({
    name: '',
    trackId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-08-31',
    capacity: 30
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tRes, cRes] = await Promise.all([
        api.get('/training/tracks'),
        api.get('/training/cohorts')
      ]);
      if (tRes.data.success) setTracks(tRes.data.data);
      if (cRes.data.success) setCohorts(cRes.data.data);
    } catch (err) {
      console.error('Failed to load training data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTrack = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/training/tracks', trackForm);
      if (res.data.success) {
        setTrackModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCohort = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/training/cohorts', cohortForm);
      if (res.data.success) {
        setCohortModalOpen(false);
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
            <GraduationCap className="w-6 h-6 text-brand-400" />
            <span>Tracks & Cohorts Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure technical curriculum tracks and batch enrollments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTrackForm({ name: '', description: '', durationWeeks: 24, requiredSkills: '' });
              setTrackModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Track</span>
          </button>
          <button
            onClick={() => {
              setCohortForm({
                name: '',
                trackId: tracks[0]?.id || '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: '2026-08-31',
                capacity: 30
              });
              setCohortModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Cohort</span>
          </button>
        </div>
      </div>

      {/* Tracks Grid */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-400" />
          <span>Active Training Tracks ({tracks.length})</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((t) => (
            <div key={t.id} className="erp-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-white">{t.name}</h4>
                <Badge status={t.is_active ? 'ACTIVE' : 'SUSPENDED'} size="sm" />
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Duration: <strong>{t.duration_weeks} Weeks</strong></span>
                <span>Interns: <strong>{t.intern_count} enrolled</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cohorts Table */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-400" />
          <span>Cohort Batches</span>
        </h3>
        <div className="erp-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Cohort Name</th>
                <th className="px-5 py-3.5">Assigned Track</th>
                <th className="px-5 py-3.5">Lead Mentor</th>
                <th className="px-5 py-3.5">Start Date</th>
                <th className="px-5 py-3.5">End Date</th>
                <th className="px-5 py-3.5">Capacity</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {cohorts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3.5 font-bold text-white">{c.name}</td>
                  <td className="px-5 py-3.5 text-slate-300">{c.track_name}</td>
                  <td className="px-5 py-3.5 text-slate-400">
                    {c.mentor_first ? `${c.mentor_first} ${c.mentor_last}` : 'Lead Instructor'}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-400">{c.start_date}</td>
                  <td className="px-5 py-3.5 font-mono text-slate-400">{c.end_date}</td>
                  <td className="px-5 py-3.5 font-mono text-slate-300">
                    {c.current_interns_count} / {c.capacity}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Track Modal */}
      <Modal isOpen={trackModalOpen} onClose={() => setTrackModalOpen(false)} title="Create New Track">
        <form onSubmit={handleCreateTrack} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Track Name *</label>
            <input
              type="text"
              required
              value={trackForm.name}
              onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Duration (Weeks)</label>
            <input
              type="number"
              value={trackForm.durationWeeks}
              onChange={(e) => setTrackForm({ ...trackForm, durationWeeks: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Description</label>
            <textarea
              rows={3}
              value={trackForm.description}
              onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTrackModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold">
              Create Track
            </button>
          </div>
        </form>
      </Modal>

      {/* New Cohort Modal */}
      <Modal isOpen={cohortModalOpen} onClose={() => setCohortModalOpen(false)} title="Create New Cohort">
        <form onSubmit={handleCreateCohort} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Cohort Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Cohort JOWIS-2026-C"
              value={cohortForm.name}
              onChange={(e) => setCohortForm({ ...cohortForm, name: e.target.value })}
              className="erp-input w-full"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Track *</label>
            <select
              required
              value={cohortForm.trackId}
              onChange={(e) => setCohortForm({ ...cohortForm, trackId: e.target.value })}
              className="erp-input w-full"
            >
              <option value="">Select track...</option>
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Start Date</label>
              <input
                type="date"
                required
                value={cohortForm.startDate}
                onChange={(e) => setCohortForm({ ...cohortForm, startDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">End Date</label>
              <input
                type="date"
                required
                value={cohortForm.endDate}
                onChange={(e) => setCohortForm({ ...cohortForm, endDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCohortModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold">
              Create Cohort
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
