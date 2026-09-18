import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  GraduationCap,
  BookOpen,
  Users,
  PlusCircle,
  Search,
  Filter,
  Edit2,
  Power,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  Clock,
  Trash2
} from 'lucide-react';

export const TrainingPage = () => {
  const [activeTab, setActiveTab] = useState('tracks'); // 'tracks', 'cohorts', or 'modules'
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [trackSearch, setTrackSearch] = useState('');
  const [trackStatusFilter, setTrackStatusFilter] = useState('');
  const [cohortSearch, setCohortSearch] = useState('');
  const [cohortTrackFilter, setCohortTrackFilter] = useState('');
  const [cohortStatusFilter, setCohortStatusFilter] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleTrackFilter, setModuleTrackFilter] = useState('');
  const [moduleStatusFilter, setModuleStatusFilter] = useState('');

  // Track Modals
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [trackForm, setTrackForm] = useState({
    name: '',
    code: '',
    description: '',
    durationWeeks: 24,
    curriculumSummary: '',
    requiredSkills: ''
  });
  const [trackDetailModal, setTrackDetailModal] = useState(false);
  const [selectedTrackDetail, setSelectedTrackDetail] = useState(null);

  // Cohort Modals
  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState(null);
  const [cohortForm, setCohortForm] = useState({
    name: '',
    cohortCode: '',
    trackId: '',
    leadMentorId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '2026-08-31',
    capacity: 30,
    status: 'active',
    description: ''
  });
  const [cohortDetailModal, setCohortDetailModal] = useState(false);
  const [selectedCohortDetail, setSelectedCohortDetail] = useState(null);

  // Module Modals (Gate 2)
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleForm, setModuleForm] = useState({
    trackId: '',
    title: '',
    moduleCode: '',
    sequenceOrder: 1,
    estimatedHours: 10,
    status: 'active',
    description: ''
  });
  const [moduleDetailModal, setModuleDetailModal] = useState(false);
  const [selectedModuleDetail, setSelectedModuleDetail] = useState(null);

  // Status & Feedback
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tRes, cRes, mRes, modRes] = await Promise.all([
        api.get('/training/tracks', {
          params: { search: trackSearch, status: trackStatusFilter }
        }),
        api.get('/training/cohorts', {
          params: { search: cohortSearch, trackId: cohortTrackFilter, status: cohortStatusFilter }
        }),
        api.get('/training/mentors'),
        api.get('/training/modules', {
          params: { search: moduleSearch, trackId: moduleTrackFilter, status: moduleStatusFilter }
        })
      ]);
      if (tRes.data.success) setTracks(tRes.data.data);
      if (cRes.data.success) setCohorts(cRes.data.data);
      if (mRes.data.success) setMentors(mRes.data.data);
      if (modRes.data.success) setModules(modRes.data.data);
    } catch (err) {
      console.error('Failed to load training data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [trackSearch, trackStatusFilter, cohortSearch, cohortTrackFilter, cohortStatusFilter, moduleSearch, moduleTrackFilter, moduleStatusFilter]);

  // Track Actions
  const openCreateTrack = () => {
    setEditingTrack(null);
    setTrackForm({
      name: '',
      code: '',
      description: '',
      durationWeeks: 24,
      curriculumSummary: '',
      requiredSkills: ''
    });
    setFormError('');
    setFormSuccess('');
    setTrackModalOpen(true);
  };

  const openEditTrack = (t) => {
    setEditingTrack(t);
    setTrackForm({
      name: t.name,
      code: t.code,
      description: t.description || '',
      durationWeeks: t.duration_weeks,
      curriculumSummary: t.curriculum_summary || '',
      requiredSkills: t.required_skills || ''
    });
    setFormError('');
    setFormSuccess('');
    setTrackModalOpen(true);
  };

  const handleSaveTrack = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      if (editingTrack) {
        const res = await api.put(`/training/tracks/${editingTrack.id}`, trackForm);
        if (res.data.success) {
          setFormSuccess('Track updated successfully.');
          setTimeout(() => {
            setTrackModalOpen(false);
            fetchData();
          }, 900);
        }
      } else {
        const res = await api.post('/training/tracks', trackForm);
        if (res.data.success) {
          setFormSuccess('Track created successfully.');
          setTimeout(() => {
            setTrackModalOpen(false);
            fetchData();
          }, 900);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save track.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTrackStatus = async (trackId) => {
    try {
      const res = await api.patch(`/training/tracks/${trackId}/status`);
      if (res.data.success) {
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle status.');
    }
  };

  const openTrackDetail = async (trackId) => {
    try {
      const res = await api.get(`/training/tracks/${trackId}`);
      if (res.data.success) {
        setSelectedTrackDetail(res.data.data);
        setTrackDetailModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Cohort Actions
  const openCreateCohort = () => {
    setEditingCohort(null);
    setCohortForm({
      name: '',
      cohortCode: '',
      trackId: tracks[0]?.id || '',
      leadMentorId: mentors[0]?.id || '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '2026-08-31',
      capacity: 30,
      status: 'active',
      description: ''
    });
    setFormError('');
    setFormSuccess('');
    setCohortModalOpen(true);
  };

  const openEditCohort = (c) => {
    setEditingCohort(c);
    setCohortForm({
      name: c.name,
      cohortCode: c.cohort_code,
      trackId: c.track_id,
      leadMentorId: c.lead_mentor_id || '',
      startDate: c.start_date,
      endDate: c.end_date,
      capacity: c.capacity,
      status: c.status,
      description: c.description || ''
    });
    setFormError('');
    setFormSuccess('');
    setCohortModalOpen(true);
  };

  const handleSaveCohort = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      if (editingCohort) {
        const res = await api.put(`/training/cohorts/${editingCohort.id}`, cohortForm);
        if (res.data.success) {
          setFormSuccess('Cohort updated successfully.');
          setTimeout(() => {
            setCohortModalOpen(false);
            fetchData();
          }, 900);
        }
      } else {
        const res = await api.post('/training/cohorts', cohortForm);
        if (res.data.success) {
          setFormSuccess('Cohort created successfully.');
          setTimeout(() => {
            setCohortModalOpen(false);
            fetchData();
          }, 900);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save cohort.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCohortDetail = async (cohortId) => {
    try {
      const res = await api.get(`/training/cohorts/${cohortId}`);
      if (res.data.success) {
        setSelectedCohortDetail(res.data.data);
        setCohortDetailModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Module Actions (Gate 2)
  const openCreateModule = () => {
    setEditingModule(null);
    setModuleForm({
      trackId: tracks[0]?.id || '',
      title: '',
      moduleCode: '',
      sequenceOrder: (modules.length || 0) + 1,
      estimatedHours: 20,
      status: 'active',
      description: ''
    });
    setFormError('');
    setFormSuccess('');
    setModuleModalOpen(true);
  };

  const openEditModule = (mod) => {
    setEditingModule(mod);
    setModuleForm({
      trackId: mod.track_id,
      title: mod.title,
      moduleCode: mod.module_code,
      sequenceOrder: mod.sequence_order,
      estimatedHours: mod.estimated_hours,
      status: mod.status,
      description: mod.description || ''
    });
    setFormError('');
    setFormSuccess('');
    setModuleModalOpen(true);
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);
    try {
      if (editingModule) {
        const res = await api.put(`/training/modules/${editingModule.id}`, moduleForm);
        if (res.data.success) {
          setFormSuccess('Module updated successfully.');
          setTimeout(() => { setModuleModalOpen(false); fetchData(); }, 800);
        }
      } else {
        const res = await api.post('/training/modules', moduleForm);
        if (res.data.success) {
          setFormSuccess('Module created successfully.');
          setTimeout(() => { setModuleModalOpen(false); fetchData(); }, 800);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save module.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleModule = async (mod) => {
    const nextStatus = mod.status === 'active' ? 'archived' : 'active';
    try {
      const res = await api.patch(`/training/modules/${mod.id}/status`, { status: nextStatus });
      if (res.data.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle module status.');
    }
  };

  const handleDeleteModule = async (mod) => {
    if (!window.confirm(`Are you sure you want to delete module '${mod.title}'?`)) return;
    try {
      const res = await api.delete(`/training/modules/${mod.id}`);
      if (res.data.success) fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete module.');
    }
  };

  const openModuleDetail = async (moduleId) => {
    try {
      const res = await api.get(`/training/modules/${moduleId}`);
      if (res.data.success) {
        setSelectedModuleDetail(res.data.data);
        setModuleDetailModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-brand-400" />
            <span>Tracks, Cohorts & Curriculum Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure enterprise training tracks, cohort batches, curriculum modules, and mentor supervision.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'tracks' ? (
            <button
              onClick={openCreateTrack}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Track</span>
            </button>
          ) : activeTab === 'cohorts' ? (
            <button
              onClick={openCreateCohort}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Cohort</span>
            </button>
          ) : (
            <button
              onClick={openCreateModule}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Module</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('tracks')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'tracks'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Program Tracks ({tracks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('cohorts')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'cohorts'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Cohort Batches ({cohorts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'modules'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Curriculum Modules ({modules.length})</span>
        </button>
      </div>

      {/* TRACKS TAB */}
      {activeTab === 'tracks' && (
        <div className="space-y-4">
          {/* Tracks Filter */}
          <div className="erp-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={trackSearch}
                  onChange={(e) => setTrackSearch(e.target.value)}
                  placeholder="Search by track name, code, or description..."
                  className="erp-input w-full pl-9 text-xs"
                />
              </div>
              <div>
                <select
                  value={trackStatusFilter}
                  onChange={(e) => setTrackStatusFilter(e.target.value)}
                  className="erp-input w-full text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Deactivated Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tracks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-3 text-center py-12 text-slate-500">Loading training tracks...</div>
            ) : tracks.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-slate-500">No tracks found.</div>
            ) : (
              tracks.map((t) => (
                <div
                  key={t.id}
                  className={`erp-card p-5 space-y-4 transition-all flex flex-col justify-between ${
                    t.is_active ? 'border-slate-800 bg-slate-900/80' : 'border-slate-800/50 bg-slate-950/60 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-950 text-brand-300 border border-brand-800/60 font-bold uppercase">
                          {t.code}
                        </span>
                        <h4 className="text-base font-bold text-white mt-1.5">{t.name}</h4>
                      </div>
                      <Badge status={t.is_active ? 'ACTIVE' : 'SUSPENDED'} text={t.is_active ? 'Active' : 'Inactive'} size="sm" />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {t.description || 'No program description provided.'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-800/80">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Duration</span>
                        <span className="font-bold text-white">{t.duration_weeks}w</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Cohorts</span>
                        <span className="font-bold text-brand-300">{t.cohort_count}</span>
                      </div>
                      <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase">Interns</span>
                        <span className="font-bold text-emerald-300">{t.intern_count}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => openTrackDetail(t.id)}
                        className="flex-1 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Cohorts & Interns</span>
                      </button>
                      <button
                        onClick={() => openEditTrack(t)}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        title="Edit Track"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleTrackStatus(t.id)}
                        className={`p-1.5 rounded border transition-colors cursor-pointer ${
                          t.is_active
                            ? 'bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border-slate-700'
                            : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-400 hover:text-emerald-400 border-slate-700'
                        }`}
                        title={t.is_active ? 'Deactivate Track' : 'Activate Track'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* COHORTS TAB */}
      {activeTab === 'cohorts' && (
        <div className="space-y-4">
          {/* Cohorts Filter */}
          <div className="erp-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={cohortSearch}
                  onChange={(e) => setCohortSearch(e.target.value)}
                  placeholder="Search cohort name or code..."
                  className="erp-input w-full pl-9 text-xs"
                />
              </div>
              <div>
                <select
                  value={cohortTrackFilter}
                  onChange={(e) => setCohortTrackFilter(e.target.value)}
                  className="erp-input w-full text-xs"
                >
                  <option value="">All Tracks</option>
                  {tracks.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                </select>
              </div>
              <div>
                <select
                  value={cohortStatusFilter}
                  onChange={(e) => setCohortStatusFilter(e.target.value)}
                  className="erp-input w-full text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cohorts Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Cohort Code</th>
                    <th className="px-5 py-3.5">Cohort Name</th>
                    <th className="px-5 py-3.5">Track</th>
                    <th className="px-5 py-3.5">Lead Mentor</th>
                    <th className="px-5 py-3.5">Timeline</th>
                    <th className="px-5 py-3.5">Enrolled / Cap</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">Loading cohort batches...</td>
                    </tr>
                  ) : cohorts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">No cohorts found.</td>
                    </tr>
                  ) : (
                    cohorts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-brand-300">
                          {c.cohort_code}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-white">
                          {c.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-300">
                          <div>{c.track_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{c.track_code}</div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {c.mentor_first ? `${c.mentor_first} ${c.mentor_last}` : 'Unassigned'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-300">
                          <div>{c.start_date}</div>
                          <div className="text-[10px] text-slate-500">to {c.end_date}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          <span className="font-bold text-white">{c.current_interns_count}</span>
                          <span className="text-slate-500"> / {c.capacity}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge status={c.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => openCohortDetail(c.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-brand-300 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                          >
                            Members
                          </button>
                          <button
                            onClick={() => openEditCohort(c)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                          >
                            Edit
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

      {/* MODULES TAB (GATE 2) */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {/* Modules Filter */}
          <div className="erp-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Search Modules</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search title, code, description..."
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    className="erp-input w-full pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Filter Track</label>
                <select
                  value={moduleTrackFilter}
                  onChange={(e) => setModuleTrackFilter(e.target.value)}
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
                  value={moduleStatusFilter}
                  onChange={(e) => setModuleStatusFilter(e.target.value)}
                  className="erp-input w-full"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Modules Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-5 py-3.5">Seq #</th>
                    <th className="px-5 py-3.5">Module Title & Description</th>
                    <th className="px-5 py-3.5">Belongs To Track</th>
                    <th className="px-5 py-3.5">Est. Hours</th>
                    <th className="px-5 py-3.5">Tasks</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">Loading curriculum modules...</td>
                    </tr>
                  ) : modules.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-500">No training modules found matching criteria.</td>
                    </tr>
                  ) : (
                    modules.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-brand-300">
                          {m.module_code}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-300 font-bold">
                          #{m.sequence_order}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-white text-sm">{m.title}</div>
                          <div className="text-slate-400 line-clamp-1 max-w-md mt-0.5">{m.description || 'Core curriculum training unit.'}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {m.track_code}
                          </span>
                          <span className="text-slate-400 text-[11px] block mt-0.5">{m.track_name}</span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-300">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>{m.estimated_hours} hrs</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2 py-0.5 rounded bg-brand-950/80 text-brand-300 font-mono text-[11px] border border-brand-800/60 font-semibold">
                            {m.published_task_count || 0} / {m.task_count || 0} Tasks
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge status={m.status} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openModuleDetail(m.id)}
                              title="View Module Details & Tasks"
                              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModule(m)}
                              title="Edit Module"
                              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleModule(m)}
                              title={m.status === 'active' ? 'Archive Module' : 'Activate Module'}
                              className={`p-1.5 rounded-md hover:bg-slate-800 transition-all cursor-pointer ${
                                m.status === 'active' ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteModule(m)}
                              title="Delete Module"
                              className="p-1.5 rounded-md hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
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

      {/* TRACK MODAL (CREATE / EDIT) */}
      <Modal
        isOpen={trackModalOpen}
        onClose={() => setTrackModalOpen(false)}
        title={editingTrack ? `Edit Track: ${editingTrack.name}` : 'Create New Training Track'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveTrack} className="space-y-4 text-xs">
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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-300 uppercase mb-1">Track Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Full-Stack Software Development"
                value={trackForm.name}
                onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Code *</label>
              <input
                type="text"
                required
                placeholder="TRK-FSD"
                value={trackForm.code}
                onChange={(e) => setTrackForm({ ...trackForm, code: e.target.value.toUpperCase() })}
                className="erp-input w-full font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Duration (Weeks) *</label>
            <input
              type="number"
              min="1"
              required
              value={trackForm.durationWeeks}
              onChange={(e) => setTrackForm({ ...trackForm, durationWeeks: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Program overview and objectives..."
              value={trackForm.description}
              onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Curriculum Summary / Modules</label>
            <textarea
              rows={2}
              placeholder="Key skills, technologies, and milestones..."
              value={trackForm.curriculumSummary}
              onChange={(e) => setTrackForm({ ...trackForm, curriculumSummary: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setTrackModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30"
            >
              {submitting ? 'Saving...' : editingTrack ? 'Save Changes' : 'Create Track'}
            </button>
          </div>
        </form>
      </Modal>

      {/* COHORT MODAL (CREATE / EDIT) */}
      <Modal
        isOpen={cohortModalOpen}
        onClose={() => setCohortModalOpen(false)}
        title={editingCohort ? `Edit Cohort: ${editingCohort.name}` : 'Create New Cohort Batch'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveCohort} className="space-y-4 text-xs">
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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
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
              <label className="block font-semibold text-slate-300 uppercase mb-1">Code *</label>
              <input
                type="text"
                required
                placeholder="COH-2026-C"
                value={cohortForm.cohortCode}
                onChange={(e) => setCohortForm({ ...cohortForm, cohortCode: e.target.value.toUpperCase() })}
                className="erp-input w-full font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Assigned Track *</label>
              <select
                required
                value={cohortForm.trackId}
                onChange={(e) => setCohortForm({ ...cohortForm, trackId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Select track...</option>
                {tracks.filter(t => t.is_active || t.id === cohortForm.trackId).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Lead Mentor</label>
              <select
                value={cohortForm.leadMentorId}
                onChange={(e) => setCohortForm({ ...cohortForm, leadMentorId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Choose mentor...</option>
                {mentors.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={cohortForm.startDate}
                onChange={(e) => setCohortForm({ ...cohortForm, startDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">End Date *</label>
              <input
                type="date"
                required
                value={cohortForm.endDate}
                onChange={(e) => setCohortForm({ ...cohortForm, endDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Capacity *</label>
              <input
                type="number"
                min="1"
                required
                value={cohortForm.capacity}
                onChange={(e) => setCohortForm({ ...cohortForm, capacity: e.target.value })}
                className="erp-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Cohort Status *</label>
            <select
              value={cohortForm.status}
              onChange={(e) => setCohortForm({ ...cohortForm, status: e.target.value })}
              className="erp-input w-full"
            >
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived (Closed)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCohortModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30"
            >
              {submitting ? 'Saving...' : editingCohort ? 'Save Changes' : 'Create Cohort'}
            </button>
          </div>
        </form>
      </Modal>

      {/* TRACK DETAIL MODAL */}
      {selectedTrackDetail && (
        <Modal
          isOpen={trackDetailModal}
          onClose={() => setTrackDetailModal(false)}
          title={`Track: ${selectedTrackDetail.track.name} (${selectedTrackDetail.track.code})`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white">{selectedTrackDetail.track.name}</p>
                <p className="text-slate-400 mt-0.5 font-mono">Code: {selectedTrackDetail.track.code} • Duration: {selectedTrackDetail.track.duration_weeks} weeks</p>
              </div>
              <Badge status={selectedTrackDetail.track.is_active ? 'ACTIVE' : 'SUSPENDED'} />
            </div>

            <div>
              <h4 className="font-bold text-white mb-2">Associated Cohorts ({selectedTrackDetail.cohorts.length})</h4>
              <div className="space-y-2">
                {selectedTrackDetail.cohorts.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-200">{c.name}</span>
                      <span className="text-slate-500 font-mono text-[10px] ml-2">({c.cohort_code})</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Mentor: {c.mentor_first ? `${c.mentor_first} ${c.mentor_last}` : 'None'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400">{c.enrolled_interns} enrolled</span>
                      <Badge status={c.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* COHORT DETAIL / MEMBER ROSTER MODAL */}
      {selectedCohortDetail && (
        <Modal
          isOpen={cohortDetailModal}
          onClose={() => setCohortDetailModal(false)}
          title={`Cohort Roster: ${selectedCohortDetail.cohort.name} (${selectedCohortDetail.cohort.cohort_code})`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white">{selectedCohortDetail.cohort.name}</p>
                <p className="text-slate-400 mt-0.5">
                  Track: <strong className="text-slate-200">{selectedCohortDetail.cohort.track_name}</strong> • Lead Mentor: <strong className="text-slate-200">{selectedCohortDetail.cohort.mentor_first ? `${selectedCohortDetail.cohort.mentor_first} ${selectedCohortDetail.cohort.mentor_last}` : 'Unassigned'}</strong>
                </p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  Dates: {selectedCohortDetail.cohort.start_date} to {selectedCohortDetail.cohort.end_date}
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-brand-300 font-mono">
                  {selectedCohortDetail.stats.enrolledCount} / {selectedCohortDetail.stats.capacity}
                </span>
                <span className="text-[10px] text-slate-400 block">Capacity ({selectedCohortDetail.stats.utilizationPercentage}%)</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-2">Enrolled Intern Members ({selectedCohortDetail.members.length})</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Intern Name</th>
                      <th className="px-4 py-2.5">Code</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Assigned Mentor</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {selectedCohortDetail.members.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-500">No interns enrolled in this cohort yet.</td></tr>
                    ) : (
                      selectedCohortDetail.members.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 font-bold text-white">{m.first_name} {m.last_name}</td>
                          <td className="px-4 py-2.5 font-mono text-brand-300">{m.intern_code}</td>
                          <td className="px-4 py-2.5 text-slate-300">{m.email}</td>
                          <td className="px-4 py-2.5 text-slate-400">
                            {m.intern_mentor_first ? `${m.intern_mentor_first} ${m.intern_mentor_last}` : 'Cohort Lead'}
                          </td>
                          <td className="px-4 py-2.5"><Badge status={m.status} size="sm" /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODULE MODAL (CREATE / EDIT) */}
      <Modal
        isOpen={moduleModalOpen}
        onClose={() => setModuleModalOpen(false)}
        title={editingModule ? `Edit Module: ${editingModule.title}` : 'Create New Curriculum Module'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveModule} className="space-y-4 text-xs">
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

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-300 uppercase mb-1">Assigned Track *</label>
              <select
                required
                value={moduleForm.trackId}
                onChange={(e) => setModuleForm({ ...moduleForm, trackId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Select track...</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Module Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. MOD-FSD-07"
                value={moduleForm.moduleCode}
                onChange={(e) => setModuleForm({ ...moduleForm, moduleCode: e.target.value.toUpperCase() })}
                className="erp-input w-full font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Module Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Cloud Native Microservices Architecture"
              value={moduleForm.title}
              onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Seq. Order *</label>
              <input
                type="number"
                min="1"
                required
                value={moduleForm.sequenceOrder}
                onChange={(e) => setModuleForm({ ...moduleForm, sequenceOrder: e.target.value })}
                className="erp-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Est. Hours *</label>
              <input
                type="number"
                min="1"
                required
                value={moduleForm.estimatedHours}
                onChange={(e) => setModuleForm({ ...moduleForm, estimatedHours: e.target.value })}
                className="erp-input w-full font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Status *</label>
              <select
                value={moduleForm.status}
                onChange={(e) => setModuleForm({ ...moduleForm, status: e.target.value })}
                className="erp-input w-full"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase mb-1">Curriculum Description</label>
            <textarea
              rows={3}
              placeholder="Summary of technical concepts, frameworks, and milestones covered..."
              value={moduleForm.description}
              onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModuleModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30"
            >
              {submitting ? 'Saving...' : editingModule ? 'Save Changes' : 'Create Module'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODULE DETAIL / TASKS MODAL */}
      {selectedModuleDetail && (
        <Modal
          isOpen={moduleDetailModal}
          onClose={() => setModuleDetailModal(false)}
          title={`Module: ${selectedModuleDetail.title} (${selectedModuleDetail.module_code})`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white">{selectedModuleDetail.title}</p>
                <p className="text-slate-400 mt-0.5">
                  Track: <strong className="text-slate-200">{selectedModuleDetail.track_name} ({selectedModuleDetail.track_code})</strong> • Est: <strong className="text-slate-200">{selectedModuleDetail.estimated_hours} hrs</strong> • Seq: #{selectedModuleDetail.sequence_order}
                </p>
                <p className="text-slate-400 mt-1">{selectedModuleDetail.description || 'No detailed syllabus text provided.'}</p>
              </div>
              <Badge status={selectedModuleDetail.status} />
            </div>

            <div>
              <h4 className="font-bold text-white mb-2">Associated Technical Tasks ({selectedModuleDetail.tasks?.length || 0})</h4>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Task Title</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Difficulty</th>
                      <th className="px-4 py-2.5">Points</th>
                      <th className="px-4 py-2.5">Deadline</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {!selectedModuleDetail.tasks || selectedModuleDetail.tasks.length === 0 ? (
                      <tr><td colSpan={6} className="py-6 text-center text-slate-500">No tasks currently assigned to this module.</td></tr>
                    ) : (
                      selectedModuleDetail.tasks.map((tk) => (
                        <tr key={tk.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 font-bold text-white">{tk.title}</td>
                          <td className="px-4 py-2.5 uppercase font-mono text-[10px] text-slate-300">{tk.task_type}</td>
                          <td className="px-4 py-2.5">
                            <span className="capitalize text-slate-300">{tk.difficulty}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-brand-300">{tk.pass_score} / {tk.max_score} pts</td>
                          <td className="px-4 py-2.5 font-mono text-slate-400">{tk.due_date}</td>
                          <td className="px-4 py-2.5"><Badge status={tk.status} size="sm" /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
