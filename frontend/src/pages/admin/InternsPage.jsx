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
  FileDown
} from 'lucide-react';

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
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Profile detail modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedInternDetail, setSelectedInternDetail] = useState(null);

  const fetchInterns = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (searchTerm) params.search = searchTerm;
      if (trackFilter) params.trackId = trackFilter;
      if (cohortFilter) params.cohortId = cohortFilter;
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
  }, [trackFilter, cohortFilter, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInterns();
  };

  const openAddModal = () => {
    setModalError('');
    setModalSuccess('');
    setNewIntern({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      trackId: tracks[0]?.id || '',
      cohortId: cohorts[0]?.id || '',
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
        setModalSuccess('Intern registered successfully with initial active status!');
        setTimeout(() => {
          setAddModalOpen(false);
          fetchInterns();
        }, 1200);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create intern.');
    } finally {
      setSubmitting(false);
    }
  };

  const viewInternProfile = async (id) => {
    try {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-400" />
            <span>Intern Lifecycle Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Registry, profile tracking, cohort assignments, and lifecycle status transitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open('/api/reports/interns/csv', '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            <span>Export Roster CSV</span>
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
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or intern code..."
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
              {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="erp-input w-full text-xs"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="suspended">Suspended</option>
              <option value="dropped">Dropped</option>
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
                <th className="px-5 py-3.5">Assigned Mentor</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading interns registry...
                  </td>
                </tr>
              ) : interns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No interns found matching criteria.
                  </td>
                </tr>
              ) : (
                interns.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">
                        {it.first_name} {it.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400">{it.email}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-brand-300 font-semibold">
                      {it.intern_code}
                    </td>
                    <td className="px-5 py-3.5 text-slate-200">
                      {it.track_name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {it.cohort_name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {it.mentor_first ? `${it.mentor_first} ${it.mentor_last}` : 'Unassigned'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={it.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => viewInternProfile(it.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-brand-300 text-[11px] font-medium border border-slate-700 transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Profile</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enroll New Intern Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Enroll New Technology Intern"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateIntern} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{modalError}</span>
            </div>
          )}
          {modalSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{modalSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">First Name *</label>
              <input
                type="text"
                required
                value={newIntern.firstName}
                onChange={(e) => setNewIntern({ ...newIntern, firstName: e.target.value })}
                className="erp-input w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={newIntern.lastName}
                onChange={(e) => setNewIntern({ ...newIntern, lastName: e.target.value })}
                className="erp-input w-full text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={newIntern.email}
                onChange={(e) => setNewIntern({ ...newIntern, email: e.target.value })}
                className="erp-input w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Phone Number</label>
              <input
                type="tel"
                value={newIntern.phone}
                onChange={(e) => setNewIntern({ ...newIntern, phone: e.target.value })}
                className="erp-input w-full text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Program Track *</label>
              <select
                required
                value={newIntern.trackId}
                onChange={(e) => setNewIntern({ ...newIntern, trackId: e.target.value })}
                className="erp-input w-full text-xs"
              >
                <option value="">Select track...</option>
                {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Assigned Cohort *</label>
              <select
                required
                value={newIntern.cohortId}
                onChange={(e) => setNewIntern({ ...newIntern, cohortId: e.target.value })}
                className="erp-input w-full text-xs"
              >
                <option value="">Select cohort...</option>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Assigned Mentor</label>
              <select
                value={newIntern.mentorId}
                onChange={(e) => setNewIntern({ ...newIntern, mentorId: e.target.value })}
                className="erp-input w-full text-xs"
              >
                <option value="">Select mentor...</option>
                {mentors.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Start Date</label>
              <input
                type="date"
                required
                value={newIntern.startDate}
                onChange={(e) => setNewIntern({ ...newIntern, startDate: e.target.value })}
                className="erp-input w-full text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Expected Completion</label>
              <input
                type="date"
                required
                value={newIntern.expectedEndDate}
                onChange={(e) => setNewIntern({ ...newIntern, expectedEndDate: e.target.value })}
                className="erp-input w-full text-xs"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-brand-600/30"
            >
              {submitting ? 'Registering...' : 'Enroll Intern & Generate Code'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Intern Detail Modal */}
      {selectedInternDetail && (
        <Modal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title={`Intern Profile: ${selectedInternDetail.profile.first_name} ${selectedInternDetail.profile.last_name}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6 text-xs">
            {/* Top overview banner */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  {selectedInternDetail.profile.first_name} {selectedInternDetail.profile.last_name}
                </p>
                <p className="font-mono text-brand-400">{selectedInternDetail.profile.intern_code}</p>
                <p className="text-slate-400 mt-1">
                  Track: <strong className="text-slate-200">{selectedInternDetail.profile.track_name}</strong> • Cohort: <strong className="text-slate-200">{selectedInternDetail.profile.cohort_name}</strong>
                </p>
              </div>
              <Badge status={selectedInternDetail.profile.status} />
            </div>

            {/* Attendance & Performance mini metrics */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Attendance Rate</span>
                <span className="text-base font-bold text-emerald-400">
                  {selectedInternDetail.attendanceStats?.total_days > 0
                    ? Math.round(((parseInt(selectedInternDetail.attendanceStats.present_days) + parseInt(selectedInternDetail.attendanceStats.late_days)) / parseInt(selectedInternDetail.attendanceStats.total_days)) * 100)
                    : 100}%
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Days Present</span>
                <span className="text-base font-bold text-white">{selectedInternDetail.attendanceStats?.present_days || 0}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Days Late</span>
                <span className="text-base font-bold text-amber-400">{selectedInternDetail.attendanceStats?.late_days || 0}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Performance</span>
                <span className="text-base font-bold text-cyan-400">
                  {selectedInternDetail.evaluations?.[0]?.overall_score ? `${selectedInternDetail.evaluations[0].overall_score}%` : 'Pending'}
                </span>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-200 uppercase text-[11px]">Contact & Educational Info</h4>
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <p>Email: <strong className="text-white">{selectedInternDetail.profile.email}</strong></p>
                <p>Phone: <strong className="text-white">{selectedInternDetail.profile.phone || 'N/A'}</strong></p>
                <p>Address: <strong className="text-white">{selectedInternDetail.profile.address || 'Lagos, Nigeria'}</strong></p>
                <p>Education: <strong className="text-white">{selectedInternDetail.profile.education || 'N/A'}</strong></p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
