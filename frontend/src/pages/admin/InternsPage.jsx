import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { downloadCSV } from '../../utils/exportUtil';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { CredentialDisplayModal } from '../../components/common/CredentialDisplayModal';
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
  Award,
  Lock,
  Unlock,
  Key,
  ShieldAlert,
  ShieldCheck,
  CheckSquare,
  FileText,
  Copy,
  Check,
  ExternalLink,
  FileCheck,
  Calendar,
  Building2,
  Mail,
  Phone,
  Sparkles,
  Trash2,
  Archive,
  Download,
  Ban,
  CreditCard,
  Printer,
  Palette
} from 'lucide-react';
import { InstitutionalIDCard, DEFAULT_ID_CARD_CONFIGS } from '../../components/common/InstitutionalIDCard';
import { AdminIDCardStudioModal } from '../../components/common/AdminIDCardStudioModal';

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
  const [credentialData, setCredentialData] = useState(null);

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
    expectedEndDate: '',
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
  const [detailTab, setDetailTab] = useState('records'); // 'records', 'security', 'id_card'

  // ID Card modal & studio states
  const [selectedInternForIdCard, setSelectedInternForIdCard] = useState(null);
  const [idCardModalOpen, setIdCardModalOpen] = useState(false);
  const [studioModalOpen, setStudioModalOpen] = useState(false);
  const [idCardConfigs, setIdCardConfigs] = useState(DEFAULT_ID_CARD_CONFIGS);

  // Access & Security Management states
  const [resetPasswordCustom, setResetPasswordCustom] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetResult, setPasswordResetResult] = useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [managingAccess, setManagingAccess] = useState(false);
  const [accessActionSuccess, setAccessActionSuccess] = useState('');
  const [accessActionError, setAccessActionError] = useState('');

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
    api.get('/system/id-card-config').then(res => {
      if (res.data?.success && res.data?.data) {
        setIdCardConfigs(prev => ({
          intern: { ...prev.intern, ...(res.data.data.intern || {}) },
          mentor: { ...prev.mentor, ...(res.data.data.mentor || {}) },
          admin: { ...prev.admin, ...(res.data.data.admin || {}) },
          super_admin: { ...prev.super_admin, ...(res.data.data.super_admin || {}) }
        }));
      }
    }).catch(e => console.error(e));
  }, [trackFilter, cohortFilter, mentorFilter, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInterns();
  };

  // Helper to compute a standard 6-month expected completion date
  const calculateDefaultEndDate = (startDateStr) => {
    if (!startDateStr) return '';
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  };

  // ENROLL INTERN
  const openAddModal = () => {
    setModalError('');
    setModalSuccess('');
    const activeTracks = tracks.filter(t => t.is_active);
    const defaultTrackId = activeTracks[0]?.id || tracks[0]?.id || '';
    const matchingCohorts = cohorts.filter(c => Number(c.track_id) === Number(defaultTrackId) && c.status !== 'archived');
    const todayStr = new Date().toISOString().split('T')[0];

    setNewIntern({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      trackId: defaultTrackId,
      cohortId: matchingCohorts[0]?.id || '',
      mentorId: mentors[0]?.id || '',
      startDate: todayStr,
      expectedEndDate: calculateDefaultEndDate(todayStr),
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
        setAddModalOpen(false);
        const tempPass = res.data.data?.temporaryPassword;
        if (tempPass) {
          setCredentialData({
            fullName: `${newIntern.firstName} ${newIntern.lastName}`,
            role: 'Intern',
            identifier: res.data.data?.email || newIntern.email,
            internCode: res.data.data?.internCode || '',
            temporaryPassword: tempPass
          });
        }
        fetchInterns();
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

  // PROFILE DETAILS & ACCESS MANAGEMENT
  const viewInternProfile = async (id) => {
    try {
      setDetailTab('records');
      setAccessActionSuccess('');
      setAccessActionError('');
      setPasswordResetResult(null);
      setRestrictionReason('');
      setReopenReason('');
      setResetPasswordCustom('');
      const res = await api.get(`/interns/${id}`);
      if (res.data.success) {
        setSelectedInternDetail(res.data.data);
        setProfileModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load intern details:', err);
    }
  };

  // PASSWORD RESET HANDLER
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedInternDetail?.profile?.id) return;
    setResettingPassword(true);
    setAccessActionError('');
    setAccessActionSuccess('');
    try {
      const res = await api.post(`/interns/${selectedInternDetail.profile.id}/reset-password`, {
        customPassword: resetPasswordCustom.trim() || undefined,
        mustChangePassword
      });
      if (res.data.success) {
        setPasswordResetResult(res.data.data);
        setAccessActionSuccess(res.data.message);
        setResetPasswordCustom('');
        // Refresh details
        const refreshed = await api.get(`/interns/${selectedInternDetail.profile.id}`);
        if (refreshed.data.success) {
          setSelectedInternDetail(refreshed.data.data);
        }
      }
    } catch (err) {
      setAccessActionError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  // RESTRICT ACCESS HANDLER
  const handleRestrictAccess = async () => {
    if (!selectedInternDetail?.profile?.id) return;
    if (!restrictionReason.trim()) {
      setAccessActionError('Please enter a formal administrative reason for restricting access.');
      return;
    }
    setManagingAccess(true);
    setAccessActionError('');
    setAccessActionSuccess('');
    try {
      const res = await api.post(`/interns/${selectedInternDetail.profile.id}/restrict-access`, {
        reason: restrictionReason.trim()
      });
      if (res.data.success) {
        setAccessActionSuccess(res.data.message);
        setRestrictionReason('');
        // Refresh detail modal & roster
        const refreshed = await api.get(`/interns/${selectedInternDetail.profile.id}`);
        if (refreshed.data.success) {
          setSelectedInternDetail(refreshed.data.data);
        }
        fetchInterns();
      }
    } catch (err) {
      setAccessActionError(err.response?.data?.message || 'Failed to restrict access.');
    } finally {
      setManagingAccess(false);
    }
  };

  // REOPEN ACCESS HANDLER
  const handleReopenAccess = async () => {
    if (!selectedInternDetail?.profile?.id) return;
    setManagingAccess(true);
    setAccessActionError('');
    setAccessActionSuccess('');
    try {
      const res = await api.post(`/interns/${selectedInternDetail.profile.id}/reopen-access`, {
        reason: reopenReason.trim() || undefined
      });
      if (res.data.success) {
        setAccessActionSuccess(res.data.message);
        setReopenReason('');
        // Refresh detail modal & roster
        const refreshed = await api.get(`/interns/${selectedInternDetail.profile.id}`);
        if (refreshed.data.success) {
          setSelectedInternDetail(refreshed.data.data);
        }
        fetchInterns();
      }
    } catch (err) {
      setAccessActionError(err.response?.data?.message || 'Failed to reopen access.');
    } finally {
      setManagingAccess(false);
    }
  };

  // ARCHIVE / SOFT-DELETE HANDLER
  const handleArchiveIntern = async (internId, internName) => {
    const confirmArchival = window.confirm(
      `Are you sure you want to archive/remove ${internName}'s profile from active rotation?\n\nINSTITUTIONAL GUARANTEE:\nAll certificates, evaluations, tasks, and attendance records will remain permanently preserved and accessible in the system for administrative audits.`
    );
    if (!confirmArchival) return;

    try {
      const res = await api.delete(`/interns/${internId}`, {
        data: { reason: 'Archived via administrative action in intern management' }
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchInterns();
        if (selectedInternDetail?.profile?.id === internId) {
          setProfileModalOpen(false);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive intern record.');
    }
  };

  const handleCopyPassword = () => {
    if (passwordResetResult?.temporaryPassword) {
      navigator.clipboard.writeText(passwordResetResult.temporaryPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleDownloadCertificate = async (cert) => {
    if (cert.status === 'revoked') {
      alert('This certificate has been revoked by institutional authority and cannot be downloaded.');
      return;
    }
    try {
      const res = await api.get(`/certificates/${cert.id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${cert.certificate_number || 'certificate'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert(err.response?.data?.message || 'Failed to download certificate PDF.');
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
            onClick={async () => {
              try {
                await downloadCSV('/reports/export/interns', `jowis-interns-roster-${new Date().toISOString().split('T')[0]}.csv`, {
                  trackId: trackFilter || undefined,
                  cohortId: cohortFilter || undefined,
                  mentorId: mentorFilter || undefined,
                  status: statusFilter || undefined,
                  search: searchTerm.trim() || undefined
                });
              } catch (err) {
                alert(err.message || 'Failed to export interns CSV');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setStudioModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-semibold rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
            title="Open ID Card Studio to edit designs universally or print badges"
          >
            <Palette className="w-4 h-4" />
            <span>ID Card Studio</span>
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
                      <div className="flex flex-col gap-1 items-start">
                        <Badge status={it.status} />
                        {Number(it.user_active) === 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60" title="Portal login access restricted">
                            <Lock className="w-2.5 h-2.5" /> Restricted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
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
                        type="button"
                        onClick={() => {
                          setSelectedInternForIdCard(it);
                          setIdCardModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-[11px] font-semibold border border-cyan-800/60 transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="View & Print Official Institutional ID Card (Front & Back with QR code)"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>ID Card</span>
                      </button>
                      <button
                        onClick={() => viewInternProfile(it.id)}
                        className="px-2.5 py-1 rounded bg-brand-950/80 hover:bg-brand-900 text-brand-300 text-[11px] font-semibold border border-brand-800/60 transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="View Detailed Dossier Form & Manage Access"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Profile</span>
                      </button>
                      <button
                        onClick={() => handleArchiveIntern(it.id, `${it.first_name} ${it.last_name}`)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-[11px] font-medium border border-slate-700 hover:border-rose-800 transition-colors cursor-pointer"
                        title="Archive intern record (Soft Delete - Preserves all certificates & history)"
                      >
                        <Archive className="w-3 h-3" />
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
                  const rawVal = e.target.value;
                  const selTrack = rawVal ? Number(rawVal) : '';
                  const trackCohorts = cohorts.filter(c => Number(c.track_id) === selTrack && c.status !== 'archived');
                  setNewIntern(prev => ({
                    ...prev,
                    trackId: rawVal,
                    cohortId: trackCohorts[0]?.id || ''
                  }));
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
                onChange={(e) => setNewIntern(prev => ({ ...prev, cohortId: e.target.value ? Number(e.target.value) : '' }))}
                className="erp-input w-full"
              >
                <option value="">Select cohort...</option>
                {cohorts
                  .filter(c => Number(c.track_id) === Number(newIntern.trackId) && c.status !== 'archived')
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
                  ))}
              </select>
              {newIntern.trackId && cohorts.filter(c => Number(c.track_id) === Number(newIntern.trackId) && c.status !== 'archived').length === 0 && (
                <p className="text-[11px] text-amber-400 mt-1">No active cohort found for this track.</p>
              )}
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Lead Mentor</label>
              <select
                value={newIntern.mentorId}
                onChange={(e) => setNewIntern(prev => ({ ...prev, mentorId: e.target.value ? Number(e.target.value) : '' }))}
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
                onChange={(e) => {
                  const newStart = e.target.value;
                  setNewIntern(prev => ({
                    ...prev,
                    startDate: newStart,
                    expectedEndDate: (!prev.expectedEndDate || prev.expectedEndDate <= newStart)
                      ? calculateDefaultEndDate(newStart)
                      : prev.expectedEndDate
                  }));
                }}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase mb-1">Expected Completion *</label>
              <input
                type="date"
                required
                min={newIntern.startDate || undefined}
                value={newIntern.expectedEndDate}
                onChange={(e) => setNewIntern(prev => ({ ...prev, expectedEndDate: e.target.value }))}
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

      {/* COMPREHENSIVE INTERN PROFILE DOSSIER & SECURITY CONSOLE MODAL */}
      {selectedInternDetail && (
        <Modal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title={`Intern Record: ${selectedInternDetail.profile?.first_name || ''} ${selectedInternDetail.profile?.last_name || ''}`}
          maxWidth="max-w-5xl"
        >
          {(() => {
            const p = selectedInternDetail.profile || {};
            const attStats = selectedInternDetail.attendanceStats || {};
            const attRecords = selectedInternDetail.attendanceRecords || [];
            const certs = selectedInternDetail.certificates || [];
            const tasks = selectedInternDetail.tasks || [];
            const evals = selectedInternDetail.evaluations || [];
            const assignHistory = selectedInternDetail.assignmentHistory || [];
            const lifeHistory = selectedInternDetail.lifecycleHistory || [];
            const isRestricted = Number(p.user_active) === 0;

            const attTotal = Number(attStats.total_days || 0);
            const attPresent = Number(attStats.present_days || 0);
            const attRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 100;

            return (
              <div className="space-y-5 text-xs text-slate-200">
                {/* Executive Dossier Header */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-black/20">
                  <div className="flex items-center gap-3.5">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={`${p.first_name} ${p.last_name}`}
                        className="w-14 h-14 rounded-xl object-cover border-2 border-brand-500/40 shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-brand-950/80 border-2 border-brand-500/30 flex items-center justify-center text-lg font-bold text-brand-300 font-mono shadow-md">
                        {p.first_name?.[0] || 'I'}{p.last_name?.[0] || 'N'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {p.first_name} {p.last_name}
                        </h3>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-brand-950 border border-brand-800/80 text-brand-300 font-bold">
                          {p.intern_code}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        Track: <span className="text-slate-200 font-medium">{p.track_name}</span> • Cohort: <span className="text-slate-200 font-medium">{p.cohort_name}</span>
                      </p>
                      <p className="text-slate-400 text-xs">
                        Lead Mentor: <span className="text-slate-300 font-medium">{p.mentor_first ? `${p.mentor_first} ${p.mentor_last}` : 'Unassigned'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-start md:items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Lifecycle:</span>
                      <Badge status={p.status} />
                    </div>
                    <div>
                      {isRestricted ? (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-950/90 text-rose-300 border border-rose-700/80 inline-flex items-center gap-1.5 shadow-sm shadow-rose-950/50">
                          <Lock className="w-3.5 h-3.5" /> ACCESS RESTRICTED
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 inline-flex items-center gap-1.5 shadow-sm shadow-emerald-950/50">
                          <ShieldCheck className="w-3.5 h-3.5" /> ACCESS ACTIVE
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setDetailTab('records')}
                    className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      detailTab === 'records'
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                        : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Dossier, Tasks, Achievements & Attendance</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('security')}
                    className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      detailTab === 'security'
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                        : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>Account Access, Password Reset & Security</span>
                    {isRestricted && (
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse ml-0.5"></span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab('id_card')}
                    className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      detailTab === 'id_card'
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                        : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Official ID Badge & Print</span>
                  </button>
                </div>

                {/* TAB 1: COMPREHENSIVE DOSSIER FORM, TASKS, ACHIEVEMENTS, ATTENDANCE */}
                {detailTab === 'records' && (
                  <div className="space-y-6">
                    {/* SECTION 1: PERSONAL & INSTITUTIONAL DOSSIER FORM */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-brand-400 font-bold uppercase tracking-wider text-xs">
                          <Building2 className="w-4 h-4" />
                          <span>Personal & Institutional Profile Form</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">CONFIDENTIAL OFFICIAL RECORD</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-500" /> Full Name
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-semibold text-white">
                            {p.first_name} {p.last_name}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Key className="w-3 h-3 text-slate-500" /> Official Intern Code
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono font-bold text-brand-300">
                            {p.intern_code}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" /> Email Address
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 truncate" title={p.email}>
                            {p.email}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" /> Phone Contact
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
                            {p.phone || p.user_phone || 'None Provided'}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-500" /> Assigned Track
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 flex items-center justify-between">
                            <span>{p.track_name}</span>
                            <span className="font-mono text-[10px] text-slate-500">{p.track_code}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" /> Cohort Group
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 flex items-center justify-between">
                            <span>{p.cohort_name}</span>
                            <span className="font-mono text-[10px] text-slate-500">{p.cohort_code}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" /> Program Start Date
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-slate-300">
                            {p.start_date || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" /> Expected Completion Date
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-slate-300">
                            {p.expected_end_date || 'N/A'}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" /> Last Portal Authentication
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                            {p.last_login ? new Date(p.last_login).toLocaleString() : 'Never Authenticated'}
                          </div>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-500" /> Education & Academic Background
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
                            {p.education || 'No academic institution recorded'}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-slate-500" /> Core Skills & Competencies
                          </label>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 truncate" title={p.skills || ''}>
                            {p.skills || 'None Listed'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: ATTENDANCE RECORDS & METRICS */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-xs">
                          <Clock className="w-4 h-4" />
                          <span>Attendance Performance & Daily Check-in Logs</span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          Compliance: <strong className="text-emerald-400">{attRate}%</strong>
                        </span>
                      </div>

                      {/* KPI cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 uppercase block font-semibold">Total Days</span>
                          <span className="text-xl font-bold text-white mt-1 block">{attTotal}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-center">
                          <span className="text-[10px] text-emerald-400 uppercase block font-semibold">Present</span>
                          <span className="text-xl font-bold text-emerald-400 mt-1 block">{attPresent}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-center">
                          <span className="text-[10px] text-amber-400 uppercase block font-semibold">Late</span>
                          <span className="text-xl font-bold text-amber-400 mt-1 block">{attStats.late_days || 0}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/40 text-center">
                          <span className="text-[10px] text-rose-400 uppercase block font-semibold">Absent</span>
                          <span className="text-xl font-bold text-rose-400 mt-1 block">{attStats.absent_days || 0}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-sky-950/30 border border-sky-800/40 text-center">
                          <span className="text-[10px] text-sky-400 uppercase block font-semibold">Rate</span>
                          <span className="text-xl font-bold text-sky-400 mt-1 block">{attRate}%</span>
                        </div>
                      </div>

                      {/* Attendance table */}
                      <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-900/90 sticky top-0 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
                              <tr>
                                <th className="px-3 py-2">Session Date</th>
                                <th className="px-3 py-2">Check In</th>
                                <th className="px-3 py-2">Check Out</th>
                                <th className="px-3 py-2">Mode</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                              {attRecords.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="text-center py-6 text-slate-500 font-sans">
                                    No attendance sessions logged for this intern.
                                  </td>
                                </tr>
                              ) : (
                                attRecords.map((ar) => (
                                  <tr key={ar.id} className="hover:bg-slate-900/50">
                                    <td className="px-3 py-2 text-white font-medium">{ar.date}</td>
                                    <td className="px-3 py-2 text-slate-300">{ar.check_in_time || '--:--'}</td>
                                    <td className="px-3 py-2 text-slate-300">{ar.check_out_time || '--:--'}</td>
                                    <td className="px-3 py-2 capitalize font-sans text-slate-400">{ar.work_mode || 'onsite'}</td>
                                    <td className="px-3 py-2 font-sans">
                                      <Badge status={ar.status?.toLowerCase() || 'present'} size="sm" />
                                    </td>
                                    <td className="px-3 py-2 font-sans text-slate-400 truncate max-w-[140px]">{ar.notes || '-'}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: TASKS & SUBMISSIONS */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-xs">
                          <CheckSquare className="w-4 h-4" />
                          <span>Assigned Tasks & Submissions ({tasks.length})</span>
                        </div>
                        <span className="text-[10px] text-slate-500">Evaluated Deliverables</span>
                      </div>

                      {tasks.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800/60">
                          No tasks have been submitted or evaluated yet.
                        </div>
                      ) : (
                        <div className="border border-slate-800 rounded-lg overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-slate-900/90 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
                              <tr>
                                <th className="px-3 py-2">Task Title</th>
                                <th className="px-3 py-2">Due Date</th>
                                <th className="px-3 py-2">Submitted</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-[11px]">
                              {tasks.map((tk) => (
                                <tr key={tk.id} className="hover:bg-slate-900/50">
                                  <td className="px-3 py-2 font-medium text-white">{tk.task_title || `Task #${tk.task_id}`}</td>
                                  <td className="px-3 py-2 font-mono text-slate-400">{tk.due_date ? tk.due_date.split('T')[0] : 'N/A'}</td>
                                  <td className="px-3 py-2 font-mono text-slate-400">{tk.submitted_at ? new Date(tk.submitted_at).toLocaleDateString() : '-'}</td>
                                  <td className="px-3 py-2">
                                    <Badge status={tk.status || 'submitted'} size="sm" />
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold">
                                    {tk.score !== null && tk.score !== undefined ? (
                                      <span className="text-emerald-400">{tk.score} / {tk.max_score || 100}</span>
                                    ) : (
                                      <span className="text-slate-500">Pending</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* SECTION 4: ACHIEVEMENTS & CERTIFICATES */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
                          <Award className="w-4 h-4" />
                          <span>Achievements, Honors & Official Certificates ({certs.length})</span>
                        </div>
                        {evals[0]?.overall_score && (
                          <span className="text-[11px] font-semibold text-cyan-400">
                            Overall Evaluation: <strong>{evals[0].overall_score}%</strong>
                          </span>
                        )}
                      </div>

                      {certs.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800/60">
                          No institutional certificates issued yet for this intern.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {certs.map((c) => {
                            const isRevoked = c.status === 'revoked';
                            return (
                              <div
                                key={c.id}
                                className={`p-3.5 rounded-lg border flex flex-col justify-between gap-3 ${
                                  isRevoked
                                    ? 'bg-rose-950/20 border-rose-900/60'
                                    : 'bg-slate-900/80 border-slate-800'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-bold text-white text-xs">
                                      {c.certificate_type_name || 'Certificate of Completion'}
                                    </h4>
                                    <Badge status={c.status} size="sm" />
                                  </div>
                                  <div className="mt-2 space-y-0.5 text-[11px] font-mono">
                                    <div className="text-brand-300 font-bold">
                                      {c.certificate_number}
                                    </div>
                                    <div className="text-slate-500 text-[10px]">
                                      Code: {c.verification_code || 'N/A'}
                                    </div>
                                    <div className="text-slate-400 font-sans text-[10px] mt-1">
                                      Issued: {c.issue_date || 'N/A'}
                                    </div>
                                  </div>
                                  {isRevoked && (
                                    <div className="mt-2 p-2 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-[10px] flex items-start gap-1.5">
                                      <Ban className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <strong>Revoked:</strong> {c.revocation_reason || 'Certificate revoked by administrative authority.'}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500">
                                    {isRevoked ? 'Downloads restricted' : 'Verified official PDF'}
                                  </span>
                                  {isRevoked ? (
                                    <button
                                      disabled
                                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-500 text-[11px] font-medium border border-slate-700 flex items-center gap-1 cursor-not-allowed"
                                      title="Revoked certificate download is prohibited"
                                    >
                                      <Ban className="w-3 h-3" />
                                      <span>Download Disabled</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleDownloadCertificate(c)}
                                      className="px-2.5 py-1 rounded bg-brand-950 hover:bg-brand-900 text-brand-300 text-[11px] font-semibold border border-brand-800 flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Download className="w-3 h-3" />
                                      <span>Download PDF</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* SECTION 5: AUDIT LOGS & ACTIVITIES */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-slate-300 font-bold uppercase tracking-wider text-xs">
                          <History className="w-4 h-4 text-brand-400" />
                          <span>Lifecycle & Assignment Activities Audit Trail</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Assignment History */}
                        <div className="space-y-2">
                          <h5 className="font-semibold text-slate-300 text-[11px] flex items-center gap-1">
                            <GitCommit className="w-3 h-3 text-sky-400" /> Assignment Transitions ({assignHistory.length})
                          </h5>
                          {assignHistory.length === 0 ? (
                            <p className="text-slate-500 py-3 text-center bg-slate-900/40 rounded border border-slate-800/60">No reassignment records.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {assignHistory.map((ah) => (
                                <div key={ah.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-brand-300 font-bold">{ah.assignment_type}</span>
                                    <span className="font-mono text-[9px] text-slate-500">{ah.created_at ? new Date(ah.created_at).toLocaleDateString() : ''}</span>
                                  </div>
                                  <div className="mt-1 text-slate-300">
                                    <span className="line-through text-slate-500">{ah.previous_name || 'None'}</span> → <strong className="text-emerald-300">{ah.new_name}</strong>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-0.5"><em>"{ah.reason}"</em></p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Lifecycle History */}
                        <div className="space-y-2">
                          <h5 className="font-semibold text-slate-300 text-[11px] flex items-center gap-1">
                            <GitCommit className="w-3 h-3 text-emerald-400" /> Lifecycle State History ({lifeHistory.length})
                          </h5>
                          {lifeHistory.length === 0 ? (
                            <p className="text-slate-500 py-3 text-center bg-slate-900/40 rounded border border-slate-800/60">No lifecycle events recorded.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {lifeHistory.map((lh) => (
                                <div key={lh.id} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <span className="line-through text-slate-500 capitalize">{lh.previous_status || 'Initial'}</span>
                                      <span className="text-slate-400">→</span>
                                      <Badge status={lh.new_status} size="sm" />
                                    </div>
                                    <span className="font-mono text-[9px] text-slate-500">{lh.created_at ? new Date(lh.created_at).toLocaleDateString() : ''}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1"><em>"{lh.reason}"</em></p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ACCOUNT ACCESS, PASSWORD RESET & SECURITY */}
                {detailTab === 'security' && (
                  <div className="space-y-5">
                    {/* INSTITUTIONAL GUARANTEE ALERT */}
                    <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-800/70 text-sky-200 flex items-start gap-3 shadow-md">
                      <ShieldCheck className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <h4 className="font-bold text-white">Institutional Data Retention & Protection Guarantee</h4>
                        <p className="text-sky-300/90 leading-relaxed">
                          Under organizational governance policies, restricting account access or removing/archiving an intern profile <strong>guarantees full retention of all records</strong>. The intern's profile, issued certificates, verification codes, evaluations, task submissions, and attendance logs <strong>permanently remain accessible</strong> in the system registry for administrative audits and verification.
                        </p>
                      </div>
                    </div>

                    {/* Operational Feedback Alerts */}
                    {accessActionSuccess && (
                      <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded-lg text-emerald-300 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{accessActionSuccess}</span>
                      </div>
                    )}
                    {accessActionError && (
                      <div className="p-3 bg-rose-950/80 border border-rose-700 rounded-lg text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{accessActionError}</span>
                      </div>
                    )}

                    {/* CARD 1: ACCESS RESTRICTION & REOPENING */}
                    <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                          <Lock className="w-4 h-4 text-amber-400" />
                          <span>Portal Login Access Status & Authorization</span>
                        </div>
                        <div>
                          {isRestricted ? (
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 inline-flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5" /> Current: RESTRICTED
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 inline-flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" /> Current: ACTIVE & AUTHORIZED
                            </span>
                          )}
                        </div>
                      </div>

                      {isRestricted ? (
                        /* REOPEN ACCOUNT CONSOLE */
                        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 space-y-3">
                          <div className="flex items-start gap-2 text-amber-300">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
                            <div>
                              <h5 className="font-bold text-white text-xs">Account Access is Currently Restricted</h5>
                              <p className="text-[11px] text-amber-200/90 mt-0.5">
                                Reason: <em>"{p.deactivation_reason || 'Administrative restriction applied'}"</em>
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                This intern is barred from logging into their portal. You can reopen and restore their access at any time below.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-amber-900/50">
                            <label className="block text-[11px] font-semibold text-slate-300">
                              Reopening Authorization Note (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Cleared disciplinary review, probation concluded, re-enrolled..."
                              value={reopenReason}
                              onChange={(e) => setReopenReason(e.target.value)}
                              className="erp-input w-full"
                            />
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                disabled={managingAccess}
                                onClick={handleReopenAccess}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg shadow-emerald-950/40 flex items-center gap-2 cursor-pointer transition-all"
                              >
                                <Unlock className="w-4 h-4" />
                                <span>{managingAccess ? 'Reopening Account...' : 'Reopen Account & Restore Access'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* RESTRICT ACCESS CONSOLE */
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                          <div>
                            <h5 className="font-bold text-white text-xs">Restrict or Suspend Intern Portal Access</h5>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Immediately prevent this intern from authenticating or accessing their workspace. Their profile, attendance records, tasks, and certificates remain 100% preserved in the system.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-slate-300">
                              Reason for Restriction <span className="text-rose-400">*Required</span>
                            </label>
                            <textarea
                              rows={2}
                              required
                              placeholder="State the formal reason (e.g. Pending disciplinary review, unexcused absence threshold exceeded, temporary hold)..."
                              value={restrictionReason}
                              onChange={(e) => setRestrictionReason(e.target.value)}
                              className="erp-input w-full"
                            />
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                disabled={managingAccess || !restrictionReason.trim()}
                                onClick={handleRestrictAccess}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg shadow-rose-950/40 flex items-center gap-2 cursor-pointer transition-all"
                              >
                                <Lock className="w-4 h-4" />
                                <span>{managingAccess ? 'Restricting Access...' : 'Restrict Intern Access'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CARD 2: PASSWORD RESET CONSOLE */}
                    <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                          <Key className="w-4 h-4 text-brand-400" />
                          <span>Reset Intern Account Password</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">ENCRYPTED BCRYPT HASHER</span>
                      </div>

                      <form onSubmit={handleResetPassword} className="space-y-3">
                        <p className="text-[11px] text-slate-400">
                          Reset the intern's account password. Leave the custom password field blank to generate an automatic, cryptographically secure 12-character temporary password.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                              Custom Password (Optional)
                            </label>
                            <input
                              type="text"
                              placeholder="Leave blank to auto-generate secure password..."
                              value={resetPasswordCustom}
                              onChange={(e) => setResetPasswordCustom(e.target.value)}
                              className="erp-input w-full font-mono"
                            />
                          </div>

                          <div className="flex items-center">
                            <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-xs select-none">
                              <input
                                type="checkbox"
                                checked={mustChangePassword}
                                onChange={(e) => setMustChangePassword(e.target.checked)}
                                className="rounded bg-slate-800 border-slate-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
                              />
                              <span>Require password change upon next login</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={resettingPassword}
                            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg shadow-brand-950/40 flex items-center gap-2 cursor-pointer transition-all"
                          >
                            <Key className="w-4 h-4" />
                            <span>{resettingPassword ? 'Resetting Password...' : 'Reset & Generate New Password'}</span>
                          </button>
                        </div>
                      </form>

                      {/* Password Reset Result Callout */}
                      {passwordResetResult && (
                        <div className="p-4 rounded-xl bg-slate-900 border border-brand-500/50 space-y-3 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                              <CheckCircle className="w-4 h-4" />
                              <span>New Credentials Generated Successfully</span>
                            </div>
                            <span className="text-[10px] text-slate-400">Share securely with intern</span>
                          </div>

                          <div className="p-3 rounded-lg bg-black/60 border border-slate-800 flex items-center justify-between gap-4 font-mono">
                            <div>
                              <div className="text-[10px] text-slate-500">TEMPORARY PASSWORD</div>
                              <div className="text-base font-bold text-amber-300 tracking-wider">
                                {passwordResetResult.temporaryPassword}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyPassword}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center gap-1.5 text-xs font-sans font-medium transition-colors cursor-pointer"
                            >
                              {copiedPassword ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Password</span>
                                </>
                              )}
                            </button>
                          </div>

                          <p className="text-[10px] text-slate-400 italic">
                            Login ID: <strong className="text-slate-200">{passwordResetResult.email || p.email}</strong> • Must change on next login: <strong className="text-slate-200">{passwordResetResult.mustChangePassword ? 'Yes' : 'No'}</strong>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* CARD 3: INSTITUTIONAL SOFT-DELETE & ARCHIVAL */}
                    <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                          <Archive className="w-4 h-4 text-rose-400" />
                          <span>Archive / Remove Profile from Active Registry</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">AUDIT-SAFE SOFT DELETE</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="text-[11px] text-slate-400 max-w-lg leading-relaxed">
                          Archiving sets the intern's status to <em>dropped</em> and disables login access. <strong>In strict adherence to institutional standards, all historical certificates, evaluations, tasks, and attendance logs remain permanently saved and viewable.</strong>
                        </p>

                        <button
                          type="button"
                          onClick={() => handleArchiveIntern(p.id, `${p.first_name} ${p.last_name}`)}
                          className="px-4 py-2 bg-slate-900 hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-700 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all whitespace-nowrap shadow-sm"
                        >
                          <Archive className="w-4 h-4 text-rose-400" />
                          <span>Archive Intern Profile</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: OFFICIAL ID CARD & BADGE PRINT */}
                {detailTab === 'id_card' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-cyan-400" />
                          <span>Official Institutional Digital ID Badge</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          CR80 wallet standard with vector QR code linked to public verification registry.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          document.body.classList.add('printing-id-card');
                          window.print();
                          setTimeout(() => document.body.classList.remove('printing-id-card'), 1000);
                        }}
                        className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Badge</span>
                      </button>
                    </div>

                    <InstitutionalIDCard
                      user={{
                        ...p,
                        first_name: p.first_name,
                        last_name: p.last_name,
                        role: 'intern',
                        role_name: 'intern',
                        intern_code: p.intern_code,
                        track_name: p.track_name,
                        cohort_name: p.cohort_name,
                        start_date: p.start_date,
                        expected_end_date: p.expected_end_date,
                        avatar_url: p.avatar_url
                      }}
                      customConfig={idCardConfigs.intern}
                      cardRole="intern"
                      side="stacked"
                      showControls={true}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* STANDALONE INTERN ID CARD & BADGE PRINT MODAL */}
      {selectedInternForIdCard && (
        <Modal
          isOpen={idCardModalOpen}
          onClose={() => setIdCardModalOpen(false)}
          title={`Official Digital ID Badge: ${selectedInternForIdCard.first_name} ${selectedInternForIdCard.last_name} (${selectedInternForIdCard.intern_code})`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="font-bold text-white text-sm">Institutional Wallet Badge • CR80 Physical Standard</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Scannable vector QR code for security verification.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    document.body.classList.add('printing-id-card');
                    window.print();
                    setTimeout(() => document.body.classList.remove('printing-id-card'), 1000);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Official Badge</span>
                </button>
              </div>
            </div>

            <InstitutionalIDCard
              user={selectedInternForIdCard}
              customConfig={idCardConfigs.intern}
              cardRole="intern"
              side="stacked"
              showControls={true}
            />
          </div>
        </Modal>
      )}

      {/* ADMIN ID CARD STUDIO MODAL */}
      <AdminIDCardStudioModal
        isOpen={studioModalOpen}
        onClose={() => setStudioModalOpen(false)}
        initialRole="intern"
        onConfigSaved={(newCfg) => setIdCardConfigs(newCfg)}
      />
      {/* Credential Display Modal (Part 5) */}
      <CredentialDisplayModal
        isOpen={Boolean(credentialData)}
        onClose={() => setCredentialData(null)}
        credentialData={credentialData}
      />
    </div>
  );
};
