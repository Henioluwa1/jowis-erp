import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  Users,
  Search,
  UserPlus,
  Filter,
  CheckCircle,
  AlertCircle,
  Eye,
  FileDown,
  RefreshCw,
  GitCommit,
  History,
  Clock,
  Shield,
  Award
} from 'lucide-react';

const LIFECYCLE_STATUSES = [
  'applied',
  'screening',
  'accepted',
  'onboarding',
  'active',
  'suspended',
  'completed',
  'dropped',
  'alumni'
];

export const InternsPage = () => {
  const [interns, setInterns] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');
  const [mentorFilter, setMentorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newIntern, setNewIntern] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    trackId: '',
    cohortId: '',
    mentorId: '',
    startDate: new Date().toISOString().split('T')[0],
    expectedEndDate: '2026-08-31',
    gender: 'male',
    education: '',
    skills: ''
  });

  // Reassign modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedInternForReassign, setSelectedInternForReassign] = useState(null);
  const [reassignForm, setReassignForm] = useState({
    type: 'cohort', // 'cohort', 'track', 'mentor'
    targetId: '',
    newCohortId: '',
    reason: ''
  });

  // Lifecycle transition modal
  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);
  const [selectedInternForLifecycle, setSelectedInternForLifecycle] = useState(null);
  const [lifecycleForm, setLifecycleForm] = useState({
    newStatus: '',
    reason: ''
  });

  // Profile detail modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedInternDetail, setSelectedInternDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview', 'assignments', 'lifecycle'

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const fetchInterns = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (searchTerm) params.search = searchTerm;
      if (trackFilter) params.trackId = trackFilter;
      if (cohortFilter) params.cohortId = cohortFilter;
      if (mentorFilter) params.mentorId = mentorFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/interns', { params });
      if (res.data.success) {
        setInterns(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load interns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterns();
    api.get('/training/tracks').then(res => setTracks(res.data.data || []));
    api.get('/training/cohorts').then(res => setCohorts(res.data.data || []));
    api.get('/training/mentors').then(res => setMentors(res.data.data || []));
  }, [trackFilter, cohortFilter, mentorFilter, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInterns();
  };

  // ENROLL INTERN
  const openAddModal = () => {
    setModalError('');
    setModalSuccess('');
    const defaultTrackId = tracks[0]?.id || '';
    const matchingCohorts = cohorts.filter(c => c.track_id === defaultTrackId && c.status !== 'archived');
    setNewIntern({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      trackId: defaultTrackId,
      cohortId: matchingCohorts[0]?.id || '',
      mentorId: mentors[0]?.id || '',
      startDate: new Date().toISOString().split('T')[0],
      expectedEndDate: '2026-08-31',
      gender: 'male',
      education: '',
      skills: ''
    });
    setAddModalOpen(true);
  };

  const handleCreateIntern = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/interns', newIntern);
      if (res.data.success) {
        setModalSuccess('Intern enrolled successfully with active lifecycle state!');
        setTimeout(() => {
          setAddModalOpen(false);
          fetchInterns();
        }, 1000);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create intern.');
    } finally {
      setSubmitting(false);
    }
  };

  // REASSIGN WORKFLOW
  const openReassignModal = (it) => {
    setSelectedInternForReassign(it);
    setModalError('');
    setModalSuccess('');
    setReassignForm({
      type: 'cohort',
      targetId: '',
      newCohortId: '',
      reason: ''
    });
    setReassignModalOpen(true);
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post(`/interns/${selectedInternForReassign.id}/reassign`, reassignForm);
      if (res.data.success) {
        setModalSuccess(res.data.message);
        setTimeout(() => {
          setReassignModalOpen(false);
          fetchInterns();
        }, 1000);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Reassignment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // LIFECYCLE TRANSITION
  const openLifecycleModal = (it) => {
    setSelectedInternForLifecycle(it);
    setModalError('');
    setModalSuccess('');
    setLifecycleForm({
      newStatus: '',
      reason: ''
    });
    setLifecycleModalOpen(true);
  };

  const handleLifecycleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post(`/interns/${selectedInternForLifecycle.id}/lifecycle`, lifecycleForm);
      if (res.data.success) {
        setModalSuccess(res.data.message);
        setTimeout(() => {
          setLifecycleModalOpen(false);
          fetchInterns();
        }, 1000);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Status transition failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // PROFILE DETAILS
  const viewInternProfile = async (id) => {
    try {
      setDetailTab('overview');
      const res = await api.get(`/interns/${id}`);
      if (res.data.success) {
        setSelectedInternDetail(res.data.data);
        setProfileModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load intern details:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-400" />
            <span>Intern Lifecycle & Assignment Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive roster, multi-factor cohort/track/mentor assignments, and auditable lifecycle transitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('/api/reports/interns/csv', '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Intern</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="erp-card p-4">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, code, email..."
              className="erp-input w-full pl-9 text-xs"
            />
          </div>
          <div>
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">All Tracks</option>
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
            </select>
          </div>
          <div>
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>)}
            </select>
          </div>
          <div>
            <select
              value={mentorFilter}
              onChange={(e) => setMentorFilter(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">All Mentors</option>
              {mentors.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="erp-input w-full text-xs capitalize"
            >
              <option value="">All 9 Lifecycle Statuses</option>
              {LIFECYCLE_STATUSES.map(st => <option key={st} value={st} className="capitalize">{st}</option>)}
            </select>
          </div>
        </form>
      </div>

      {/* Interns Table */}
      <div className="erp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Intern Name</th>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Track</th>
                <th className="px-5 py-3.5">Cohort</th>
                <th className="px-5 py-3.5">Lead Mentor</th>
                <th className="px-5 py-3.5">Lifecycle Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">Loading intern registry...</td>
                </tr>
              ) : interns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">No interns found matching filter criteria.</td>
                </tr>
              ) : (
                interns.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{it.first_name} {it.last_name}</div>
                      <div className="text-[10px] text-slate-400">{it.email}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-brand-300 font-bold">
                      {it.intern_code}
                    </td>
                    <td className="px-5 py-3.5 text-slate-200">
                      <div>{it.track_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{it.track_code}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      <div>{it.cohort_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{it.cohort_code}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {it.mentor_first ? `${it.mentor_first} ${it.mentor_last}` : 'Unassigned'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={it.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => openReassignModal(it)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                        title="Reassign Track, Cohort, or Mentor"
                      >
                        Reassign
                      </button>
                      <button
                        onClick={() => openLifecycleModal(it)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium border border-slate-700 transition-colors cursor-pointer"
                        title="Transition Lifecycle State"
                      >
                        Status
                      </button>
                      <button
                        onClick={() => viewInternProfile(it.id)}
                        className="px-2 py-1 rounded bg-brand-950/80 hover:bg-brand-900 text-brand-300 text-[11px] font-medium border border-brand-800/60 transition-colors cursor-pointer"
                      >
                        Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ENROLL MODAL */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Enroll New Technology Intern"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateIntern} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}
          {modalSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{modalSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">First Name *</label>
              <input
                type="text"
                required
                value={newIntern.firstName}
                onChange={(e) => setNewIntern({ ...newIntern, firstName: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={newIntern.lastName}
                onChange={(e) => setNewIntern({ ...newIntern, lastName: e.target.value })}
                className="erp-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={newIntern.email}
                onChange={(e) => setNewIntern({ ...newIntern, email: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Phone Number</label>
              <input
                type="tel"
                value={newIntern.phone}
                onChange={(e) => setNewIntern({ ...newIntern, phone: e.target.value })}
                className="erp-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Program Track *</label>
              <select
                required
                value={newIntern.trackId}
                onChange={(e) => {
                  const selTrack = parseInt(e.target.value, 10);
                  const trackCohorts = cohorts.filter(c => c.track_id === selTrack && c.status !== 'archived');
                  setNewIntern({
                    ...newIntern,
                    trackId: selTrack,
                    cohortId: trackCohorts[0]?.id || ''
                  });
                }}
                className="erp-input w-full"
              >
                <option value="">Select track...</option>
                {tracks.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Assigned Cohort *</label>
              <select
                required
                value={newIntern.cohortId}
                onChange={(e) => setNewIntern({ ...newIntern, cohortId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Select cohort...</option>
                {cohorts
                  .filter(c => c.track_id === parseInt(newIntern.trackId, 10) && c.status !== 'archived')
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Lead Mentor</label>
              <select
                value={newIntern.mentorId}
                onChange={(e) => setNewIntern({ ...newIntern, mentorId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Choose mentor...</option>
                {mentors.map(m => (
                  <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={newIntern.startDate}
                onChange={(e) => setNewIntern({ ...newIntern, startDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Expected Completion *</label>
              <input
                type="date"
                required
                value={newIntern.expectedEndDate}
                onChange={(e) => setNewIntern({ ...newIntern, expectedEndDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-brand-600/30"
            >
              {submitting ? 'Registering...' : 'Enroll Intern & Generate Code'}
            </button>
          </div>
        </form>
      </Modal>

      {/* REASSIGNMENT MODAL */}
      {selectedInternForReassign && (
        <Modal
          isOpen={reassignModalOpen}
          onClose={() => setReassignModalOpen(false)}
          title={`Reassign: ${selectedInternForReassign.first_name} ${selectedInternForReassign.last_name} (${selectedInternForReassign.intern_code})`}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
            {modalError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}
            {modalSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-1">
              <p className="text-slate-400">Current Track: <strong className="text-white">{selectedInternForReassign.track_name}</strong></p>
              <p className="text-slate-400">Current Cohort: <strong className="text-white">{selectedInternForReassign.cohort_name}</strong></p>
              <p className="text-slate-400">Current Mentor: <strong className="text-white">{selectedInternForReassign.mentor_first ? `${selectedInternForReassign.mentor_first} ${selectedInternForReassign.mentor_last}` : 'Unassigned'}</strong></p>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Reassignment Type *</label>
              <select
                value={reassignForm.type}
                onChange={(e) => setReassignForm({ ...reassignForm, type: e.target.value, targetId: '', newCohortId: '' })}
                className="erp-input w-full"
              >
                <option value="cohort">Cohort (within current track)</option>
                <option value="track">Track & Cohort Transfer</option>
                <option value="mentor">Lead Mentor Reassignment</option>
              </select>
            </div>

            {reassignForm.type === 'cohort' && (
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Target Cohort *</label>
                <select
                  required
                  value={reassignForm.targetId}
                  onChange={(e) => setReassignForm({ ...reassignForm, targetId: e.target.value })}
                  className="erp-input w-full"
                >
                  <option value="">Select new cohort...</option>
                  {cohorts
                    .filter(c => c.track_id === selectedInternForReassign.track_id && c.id !== selectedInternForReassign.cohort_id && c.status !== 'archived')
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
                    ))}
                </select>
              </div>
            )}

            {reassignForm.type === 'track' && (
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Target Track *</label>
                  <select
                    required
                    value={reassignForm.targetId}
                    onChange={(e) => {
                      const newTId = parseInt(e.target.value, 10);
                      const matchingC = cohorts.filter(c => c.track_id === newTId && c.status !== 'archived');
                      setReassignForm({
                        ...reassignForm,
                        targetId: newTId,
                        newCohortId: matchingC[0]?.id || ''
                      });
                    }}
                    className="erp-input w-full"
                  >
                    <option value="">Select target track...</option>
                    {tracks.filter(t => t.id !== selectedInternForReassign.track_id && t.is_active).map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Target Cohort (in new track) *</label>
                  <select
                    required
                    value={reassignForm.newCohortId}
                    onChange={(e) => setReassignForm({ ...reassignForm, newCohortId: e.target.value })}
                    className="erp-input w-full"
                  >
                    <option value="">Select cohort...</option>
                    {cohorts
                      .filter(c => c.track_id === parseInt(reassignForm.targetId, 10) && c.status !== 'archived')
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {reassignForm.type === 'mentor' && (
              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Target Mentor *</label>
                <select
                  required
                  value={reassignForm.targetId}
                  onChange={(e) => setReassignForm({ ...reassignForm, targetId: e.target.value })}
                  className="erp-input w-full"
                >
                  <option value="">Select mentor...</option>
                  {mentors
                    .filter(m => m.id !== selectedInternForReassign.mentor_id)
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                Audit Reason <span className="text-rose-400">*Required</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Formal administrative reason for this reassignment..."
                value={reassignForm.reason}
                onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                className="erp-input w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-amber-600/30"
              >
                {submitting ? 'Reassigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* LIFECYCLE TRANSITION MODAL */}
      {selectedInternForLifecycle && (
        <Modal
          isOpen={lifecycleModalOpen}
          onClose={() => setLifecycleModalOpen(false)}
          title={`Lifecycle Transition: ${selectedInternForLifecycle.first_name} ${selectedInternForLifecycle.last_name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleLifecycleSubmit} className="space-y-4 text-xs">
            {modalError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}
            {modalSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Current Lifecycle State:</span>
              <Badge status={selectedInternForLifecycle.status} />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Target Lifecycle Status *</label>
              <select
                required
                value={lifecycleForm.newStatus}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, newStatus: e.target.value })}
                className="erp-input w-full capitalize"
              >
                <option value="">Select target status...</option>
                {LIFECYCLE_STATUSES
                  .filter(st => st !== selectedInternForLifecycle.status)
                  .map(st => (
                    <option key={st} value={st} className="capitalize">{st}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">
                Audit Reason <span className="text-rose-400">*Required</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Reason for lifecycle state transition..."
                value={lifecycleForm.reason}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, reason: e.target.value })}
                className="erp-input w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setLifecycleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg font-semibold shadow-md shadow-sky-600/30"
              >
                {submitting ? 'Transitioning...' : 'Confirm Status Change'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* FULL PROFILE DETAIL MODAL WITH AUDIT TIMELINES */}
      {selectedInternDetail && (
        <Modal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title={`Intern Record: ${selectedInternDetail.profile.first_name} ${selectedInternDetail.profile.last_name}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs">
            {/* Subtabs */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
              <button
                onClick={() => setDetailTab('overview')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  detailTab === 'overview' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Overview & KPIs
              </button>
              <button
                onClick={() => setDetailTab('assignments')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  detailTab === 'assignments' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Assignment History ({selectedInternDetail.assignmentHistory?.length || 0})</span>
              </button>
              <button
                onClick={() => setDetailTab('lifecycle')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  detailTab === 'lifecycle' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>Lifecycle History ({selectedInternDetail.lifecycleHistory?.length || 0})</span>
              </button>
            </div>

            {detailTab === 'overview' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {selectedInternDetail.profile.first_name} {selectedInternDetail.profile.last_name}
                    </h3>
                    <p className="font-mono text-brand-300 font-bold">{selectedInternDetail.profile.intern_code}</p>
                    <p className="text-slate-400 mt-1">
                      Track: <strong className="text-slate-200">{selectedInternDetail.profile.track_name}</strong> • Cohort: <strong className="text-slate-200">{selectedInternDetail.profile.cohort_name}</strong>
                    </p>
                    <p className="text-slate-400">
                      Lead Mentor: <strong className="text-slate-200">{selectedInternDetail.profile.mentor_first ? `${selectedInternDetail.profile.mentor_first} ${selectedInternDetail.profile.mentor_last}` : 'Unassigned'}</strong>
                    </p>
                  </div>
                  <Badge status={selectedInternDetail.profile.status} />
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Total Attendance</span>
                    <span className="text-lg font-bold text-emerald-400">{selectedInternDetail.attendanceStats?.present_days || 0}d</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Late Sessions</span>
                    <span className="text-lg font-bold text-amber-400">{selectedInternDetail.attendanceStats?.late_days || 0}d</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Absences</span>
                    <span className="text-lg font-bold text-rose-400">{selectedInternDetail.attendanceStats?.absent_days || 0}d</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block uppercase">Performance</span>
                    <span className="text-lg font-bold text-cyan-400">
                      {selectedInternDetail.evaluations?.[0]?.overall_score ? `${selectedInternDetail.evaluations[0].overall_score}%` : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Contact & Education */}
                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-200 uppercase text-[11px]">Personal & Academic Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <p>Email: <strong className="text-white">{selectedInternDetail.profile.email}</strong></p>
                    <p>Phone: <strong className="text-white">{selectedInternDetail.profile.phone || 'N/A'}</strong></p>
                    <p>Education: <strong className="text-white">{selectedInternDetail.profile.education || 'N/A'}</strong></p>
                    <p>Skills: <strong className="text-white">{selectedInternDetail.profile.skills || 'N/A'}</strong></p>
                    <p>Start Date: <strong className="text-white font-mono">{selectedInternDetail.profile.start_date}</strong></p>
                    <p>Expected End: <strong className="text-white font-mono">{selectedInternDetail.profile.expected_end_date}</strong></p>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'assignments' && (
              <div className="space-y-3">
                <h4 className="font-bold text-white">Relational Assignment History</h4>
                {selectedInternDetail.assignmentHistory?.length === 0 ? (
                  <p className="text-slate-500 py-4 text-center">No reassignments recorded for this intern.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInternDetail.assignmentHistory.map((ah) => (
                      <div key={ah.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-brand-300 font-bold uppercase">
                            {ah.assignment_type}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">{ah.created_at}</span>
                        </div>
                        <p className="text-slate-300 font-medium">
                          <span className="line-through text-slate-500">{ah.previous_name || 'None'}</span> → <strong className="text-emerald-300">{ah.new_name}</strong>
                        </p>
                        <p className="text-slate-400 text-[11px]">Reason: <em>"{ah.reason}"</em></p>
                        <p className="text-[10px] text-slate-500">Authorized by: {ah.changer_first} {ah.changer_last}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'lifecycle' && (
              <div className="space-y-3">
                <h4 className="font-bold text-white">Lifecycle Transition Audit Trail</h4>
                {selectedInternDetail.lifecycleHistory?.length === 0 ? (
                  <p className="text-slate-500 py-4 text-center">No lifecycle events recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInternDetail.lifecycleHistory.map((lh) => (
                      <div key={lh.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="line-through text-slate-500 capitalize">{lh.previous_status || 'Initial'}</span>
                            <span className="text-slate-400">→</span>
                            <Badge status={lh.new_status} size="sm" />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">{lh.created_at}</span>
                        </div>
                        <p className="text-slate-300 text-[11px]">Reason: <em>"{lh.reason}"</em></p>
                        <p className="text-[10px] text-slate-500">Authorized by: {lh.changer_first} {lh.changer_last}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
