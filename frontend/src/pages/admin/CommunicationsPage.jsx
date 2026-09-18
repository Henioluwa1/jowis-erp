import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Megaphone,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Filter,
  Users,
  Eye,
  Edit2,
  Trash2,
  Archive,
  Pin,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Bell
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { MetricCard } from '../../components/common/MetricCard';

export const CommunicationsPage = () => {
  const [activeTab, setActiveTab] = useState('registry'); // 'registry', 'compose', 'tracker'
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination for Registry
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Auxiliary Master Data for Compose Targeting
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [interns, setInterns] = useState([]);

  // Compose Form State
  const [composeForm, setComposeForm] = useState({
    title: '',
    content: '',
    priority: 'normal',
    targetType: 'all',
    targetId: '',
    isPinned: false,
    requiresAcknowledgement: false,
    status: 'published', // 'published', 'draft', 'scheduled'
    scheduledAt: '',
    expiresAt: ''
  });
  const [audiencePreview, setAudiencePreview] = useState({ count: 0, sample: [] });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  // Modals
  const [viewModalAnn, setViewModalAnn] = useState(null);
  const [scheduleModalAnn, setScheduleModalAnn] = useState(null);
  const [scheduleInputDate, setScheduleInputDate] = useState('');

  // Acknowledgement Tracker State
  const [ackAnnouncements, setAckAnnouncements] = useState([]);
  const [selectedAckAnnId, setSelectedAckAnnId] = useState('');
  const [ackReport, setAckReport] = useState({ records: [], stats: null, loading: false });
  const [ackStatusFilter, setAckStatusFilter] = useState('all');

  // Load announcements list
  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (targetFilter !== 'all') params.append('targetType', targetFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('page', page);
      params.append('limit', 15);

      const res = await api.get(`/communications/announcements?${params.toString()}`);
      if (res.data.success) {
        setAnnouncements(res.data.data);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [statusFilter, priorityFilter, targetFilter, page]);

  // Load tracks, cohorts, and interns for compose dropdowns
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [trRes, coRes, inRes] = await Promise.all([
          api.get('/training/tracks').catch(() => ({ data: { data: [] } })),
          api.get('/training/cohorts').catch(() => ({ data: { data: [] } })),
          api.get('/interns?limit=100').catch(() => ({ data: { data: [] } }))
        ]);
        if (trRes.data?.data) setTracks(trRes.data.data);
        if (coRes.data?.data) setCohorts(coRes.data.data);
        if (inRes.data?.data) setInterns(inRes.data.data);
      } catch (e) {
        console.error('Failed to load master data:', e);
      }
    };
    loadMasterData();
  }, []);

  // Update audience preview when targetType or targetId changes
  useEffect(() => {
    const updatePreview = async () => {
      if (['track', 'cohort', 'intern'].includes(composeForm.targetType) && !composeForm.targetId) {
        setAudiencePreview({ count: 0, sample: [] });
        return;
      }
      setLoadingPreview(true);
      try {
        const res = await api.get(`/communications/announcements/audience`, {
          params: {
            targetType: composeForm.targetType,
            targetId: composeForm.targetId || undefined
          }
        });
        if (res.data.success) {
          setAudiencePreview({
            count: res.data.data.recipientCount,
            sample: res.data.data.sampleUsers || []
          });
        }
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        setLoadingPreview(false);
      }
    };

    updatePreview();
  }, [composeForm.targetType, composeForm.targetId]);

  // Handle compose submit
  const handleComposeSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!composeForm.title.trim() || !composeForm.content.trim()) {
      setFormError('Please provide both an announcement title and body content.');
      return;
    }

    if (['track', 'cohort', 'intern'].includes(composeForm.targetType) && !composeForm.targetId) {
      setFormError(`Please select a specific target for '${composeForm.targetType}'.`);
      return;
    }

    if (composeForm.status === 'scheduled' && !composeForm.scheduledAt) {
      setFormError('Please select a scheduled publication date & time.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: composeForm.title,
        content: composeForm.content,
        priority: composeForm.priority,
        targetType: composeForm.targetType,
        targetId: composeForm.targetId ? parseInt(composeForm.targetId, 10) : null,
        isPinned: composeForm.isPinned,
        requiresAcknowledgement: composeForm.requiresAcknowledgement,
        status: composeForm.status,
        scheduledAt: composeForm.status === 'scheduled' ? composeForm.scheduledAt : null,
        expiresAt: composeForm.expiresAt || null
      };

      const res = await api.post('/communications/announcements', payload);
      if (res.data.success) {
        setFormSuccess(
          composeForm.status === 'published'
            ? 'Announcement published immediately and targeted notifications dispatched!'
            : (composeForm.status === 'scheduled'
                ? 'Announcement scheduled successfully.'
                : 'Announcement saved as draft.')
        );
        // Reset form
        setComposeForm({
          title: '',
          content: '',
          priority: 'normal',
          targetType: 'all',
          targetId: '',
          isPinned: false,
          requiresAcknowledgement: false,
          status: 'published',
          scheduledAt: '',
          expiresAt: ''
        });
        fetchAnnouncements();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  // Immediate publish action
  const handlePublishNow = async (annId) => {
    try {
      const res = await api.patch(`/communications/announcements/${annId}/publish`);
      if (res.data.success) {
        fetchAnnouncements();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to publish announcement.');
    }
  };

  // Archive action
  const handleArchive = async (annId) => {
    if (!confirm('Are you sure you want to archive this announcement?')) return;
    try {
      const res = await api.patch(`/communications/announcements/${annId}/archive`);
      if (res.data.success) {
        fetchAnnouncements();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive announcement.');
    }
  };

  // Delete action
  const handleDelete = async (annId) => {
    if (!confirm('Are you sure you want to permanently delete this announcement?')) return;
    try {
      const res = await api.delete(`/communications/announcements/${annId}`);
      if (res.data.success) {
        fetchAnnouncements();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete announcement.');
    }
  };

  // Handle schedule modal submit
  const handleConfirmSchedule = async () => {
    if (!scheduleInputDate) return;
    try {
      const res = await api.patch(`/communications/announcements/${scheduleModalAnn.id}/schedule`, {
        scheduledAt: scheduleInputDate
      });
      if (res.data.success) {
        setScheduleModalAnn(null);
        setScheduleInputDate('');
        fetchAnnouncements();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to schedule announcement.');
    }
  };

  // Load announcements that require acknowledgement for the tracker tab
  useEffect(() => {
    if (activeTab === 'tracker') {
      const loadAckList = async () => {
        try {
          const res = await api.get('/communications/announcements?limit=50');
          if (res.data.success) {
            const requiringAck = res.data.data.filter((a) => a.requires_acknowledgement === 1);
            setAckAnnouncements(requiringAck);
            if (requiringAck.length > 0 && !selectedAckAnnId) {
              setSelectedAckAnnId(String(requiringAck[0].id));
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadAckList();
    }
  }, [activeTab]);

  // Load acknowledgement report for selected announcement
  useEffect(() => {
    if (activeTab === 'tracker' && selectedAckAnnId) {
      const loadReport = async () => {
        setAckReport((prev) => ({ ...prev, loading: true }));
        try {
          const res = await api.get(`/communications/announcements/${selectedAckAnnId}/acknowledgements`, {
            params: { status: ackStatusFilter !== 'all' ? ackStatusFilter : undefined }
          });
          if (res.data.success) {
            setAckReport({
              records: res.data.data,
              stats: res.data.stats,
              loading: false
            });
          }
        } catch (e) {
          console.error(e);
          setAckReport((prev) => ({ ...prev, loading: false }));
        }
      };
      loadReport();
    }
  }, [activeTab, selectedAckAnnId, ackStatusFilter]);

  // Summary Metrics calculations
  const totalAnn = pagination.total || announcements.length;
  const publishedCount = announcements.filter((a) => a.status === 'published').length;
  const scheduledCount = announcements.filter((a) => a.status === 'scheduled').length;
  const requiresAckCount = announcements.filter((a) => a.requires_acknowledgement === 1).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-brand-400" />
            <span>Communications & Broadcast Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise announcements, audience targeting, scheduled releases, and formal acknowledgement compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('compose')}
            id="compose-announcement-button"
            className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Announcement</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Broadcasts"
          value={totalAnn}
          icon={Layers}
          color="blue"
          subtext="Recorded notices"
        />
        <MetricCard
          title="Published & Live"
          value={publishedCount}
          icon={Send}
          color="emerald"
          subtext="Active in portal"
        />
        <MetricCard
          title="Scheduled Releases"
          value={scheduledCount}
          icon={Clock}
          color="amber"
          subtext="Upcoming automations"
        />
        <MetricCard
          title="Action Required"
          value={requiresAckCount}
          icon={ShieldCheck}
          color="indigo"
          subtext="Formal acknowledgement"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('registry')}
          id="tab-announcements-registry"
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'registry'
              ? 'border-brand-500 text-brand-400 bg-brand-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Announcements Registry</span>
        </button>
        <button
          onClick={() => setActiveTab('compose')}
          id="tab-compose-announcement"
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'compose'
              ? 'border-brand-500 text-brand-400 bg-brand-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Edit2 className="w-4 h-4" />
          <span>Compose & Target</span>
        </button>
        <button
          onClick={() => setActiveTab('tracker')}
          id="tab-acknowledgement-tracker"
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'tracker'
              ? 'border-brand-500 text-brand-400 bg-brand-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Acknowledgement Compliance</span>
        </button>
      </div>

      {/* TAB 1: ANNOUNCEMENTS REGISTRY */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="erp-card p-4 flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search broadcasts by title or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAnnouncements()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
              <button
                onClick={fetchAnnouncements}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Drafts</option>
                <option value="archived">Archived</option>
                <option value="expired">Expired</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>

              <select
                value={targetFilter}
                onChange={(e) => { setTargetFilter(e.target.value); setPage(1); }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Audiences</option>
                <option value="all">Everyone</option>
                <option value="interns">All Interns</option>
                <option value="mentors">All Mentors</option>
                <option value="admins">Admins Only</option>
                <option value="track">Track Targeted</option>
                <option value="cohort">Cohort Targeted</option>
                <option value="intern">Direct Intern</option>
              </select>

              <button
                onClick={fetchAnnouncements}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Announcement</th>
                    <th className="p-3.5">Target Audience</th>
                    <th className="p-3.5">Priority</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Compliance</th>
                    <th className="p-3.5">Publication / Dates</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500">
                        Loading announcements...
                      </td>
                    </tr>
                  ) : announcements.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500">
                        No announcements found matching the current filters.
                      </td>
                    </tr>
                  ) : (
                    announcements.map((ann) => (
                      <tr key={ann.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 max-w-xs">
                          <div className="flex items-center gap-2">
                            {ann.is_pinned === 1 && (
                              <Pin className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" title="Pinned Announcement" />
                            )}
                            <span className="font-semibold text-white truncate block" title={ann.title}>
                              {ann.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5" title={ann.content}>
                            {ann.content}
                          </p>
                          <span className="text-[10px] text-slate-500 mt-1 block">
                            By {ann.author_first_name} {ann.author_last_name}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <Users className="w-3 h-3 text-slate-400" />
                            {ann.target_type === 'all' && 'Everyone'}
                            {ann.target_type === 'interns' && 'All Interns'}
                            {ann.target_type === 'mentors' && 'All Mentors'}
                            {ann.target_type === 'admins' && 'Admins Only'}
                            {ann.target_type === 'track' && `Track: ${ann.track_name || ann.target_id}`}
                            {ann.target_type === 'cohort' && `Cohort: ${ann.cohort_name || ann.target_id}`}
                            {ann.target_type === 'intern' && `Intern: ${ann.intern_code || ann.target_id}`}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <Badge
                            variant={
                              ann.priority === 'urgent'
                                ? 'danger'
                                : ann.priority === 'high'
                                ? 'warning'
                                : ann.priority === 'low'
                                ? 'secondary'
                                : 'default'
                            }
                          >
                            {ann.priority?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          <Badge
                            variant={
                              ann.status === 'published'
                                ? 'success'
                                : ann.status === 'scheduled'
                                ? 'warning'
                                : ann.status === 'draft'
                                ? 'secondary'
                                : ann.status === 'expired'
                                ? 'danger'
                                : 'default'
                            }
                          >
                            {ann.status?.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3.5">
                          {ann.requires_acknowledgement === 1 ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-300">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              <span>{ann.acknowledged_count || 0} acked</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">Not required</span>
                          )}
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-400 font-mono">
                          {ann.status === 'scheduled' && ann.scheduled_at && (
                            <div className="text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Sched: {new Date(ann.scheduled_at).toLocaleString()}</span>
                            </div>
                          )}
                          {ann.published_at && (
                            <div>Pub: {new Date(ann.published_at).toLocaleDateString()}</div>
                          )}
                          {ann.expires_at && (
                            <div className="text-rose-400">Exp: {new Date(ann.expires_at).toLocaleDateString()}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewModalAnn(ann)}
                              title="View Details"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {(ann.status === 'draft' || ann.status === 'scheduled') && (
                              <button
                                onClick={() => handlePublishNow(ann.id)}
                                title="Publish Now"
                                className="p-1 rounded hover:bg-emerald-950/60 text-emerald-400 hover:text-emerald-300"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {ann.status === 'draft' && (
                              <button
                                onClick={() => { setScheduleModalAnn(ann); setScheduleInputDate(''); }}
                                title="Schedule Release"
                                className="p-1 rounded hover:bg-amber-950/60 text-amber-400 hover:text-amber-300"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {ann.status === 'published' && (
                              <button
                                onClick={() => handleArchive(ann.id)}
                                title="Archive Announcement"
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(ann.id)}
                              title="Delete Announcement"
                              className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
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

            {/* Pagination footer */}
            <div className="p-3.5 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing Page <strong className="text-white">{pagination.page || 1}</strong> of{' '}
                <strong className="text-white">{pagination.totalPages || 1}</strong> ({pagination.total || 0} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                  Previous
                </button>
                <button
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPOSE & SCHEDULE ANNOUNCEMENT */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 erp-card p-6">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-brand-400" />
              <span>Compose Official Broadcast</span>
            </h3>

            {formSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleComposeSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Announcement Headline / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Milestone Deliverable Submissions Open"
                  value={composeForm.title}
                  onChange={(e) => setComposeForm({ ...composeForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Announcement Message Body (Safe Text / Markdown) *
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder="Draft clear operational instructions, deadlines, or official policy notices..."
                  value={composeForm.content}
                  onChange={(e) => setComposeForm({ ...composeForm, content: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 leading-relaxed font-sans"
                />
              </div>

              {/* Priority & Target Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority Level</label>
                  <select
                    value={composeForm.priority}
                    onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent / Critical Action</option>
                    <option value="low">Low Priority (Informational)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Audience Targeting Scope *
                  </label>
                  <select
                    value={composeForm.targetType}
                    onChange={(e) => setComposeForm({ ...composeForm, targetType: e.target.value, targetId: '' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="all">Organization-Wide (Everyone)</option>
                    <option value="interns">All Active Interns</option>
                    <option value="mentors">All Mentors</option>
                    <option value="admins">Administrative Staff Only</option>
                    <option value="track">Specific Program Track</option>
                    <option value="cohort">Specific Cohort</option>
                    <option value="intern">Specific Individual Intern</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Target ID Dropdown */}
              {composeForm.targetType === 'track' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Select Program Track *</label>
                  <select
                    required
                    value={composeForm.targetId}
                    onChange={(e) => setComposeForm({ ...composeForm, targetId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Choose Track --</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {composeForm.targetType === 'cohort' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Select Target Cohort *</label>
                  <select
                    required
                    value={composeForm.targetId}
                    onChange={(e) => setComposeForm({ ...composeForm, targetId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Choose Cohort --</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.cohort_code}) — Track: {c.track_name || c.track_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {composeForm.targetType === 'intern' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Select Intern *</label>
                  <select
                    required
                    value={composeForm.targetId}
                    onChange={(e) => setComposeForm({ ...composeForm, targetId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Choose Intern --</option>
                    {interns.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.first_name} {i.last_name} ({i.intern_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Choices: Publish Now, Draft, Schedule */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
                <span className="block text-xs font-semibold text-slate-300">Release Execution Mode</span>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="status"
                      value="published"
                      checked={composeForm.status === 'published'}
                      onChange={() => setComposeForm({ ...composeForm, status: 'published' })}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Publish Immediately</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="status"
                      value="scheduled"
                      checked={composeForm.status === 'scheduled'}
                      onChange={() => setComposeForm({ ...composeForm, status: 'scheduled' })}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Schedule For Future Date</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={composeForm.status === 'draft'}
                      onChange={() => setComposeForm({ ...composeForm, status: 'draft' })}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span>Save As Draft</span>
                  </label>
                </div>

                {composeForm.status === 'scheduled' && (
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-amber-300 mb-1">
                      Scheduled Publication Time (Lagos UTC+1) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={composeForm.scheduledAt}
                      onChange={(e) => setComposeForm({ ...composeForm, scheduledAt: e.target.value })}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}
              </div>

              {/* Additional Options */}
              <div className="flex flex-wrap items-center gap-6 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={composeForm.isPinned}
                    onChange={(e) => setComposeForm({ ...composeForm, isPinned: e.target.checked })}
                    className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 bg-slate-950"
                  />
                  <span>Pin to top of bulletin board</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={composeForm.requiresAcknowledgement}
                    onChange={(e) => setComposeForm({ ...composeForm, requiresAcknowledgement: e.target.checked })}
                    className="rounded border-slate-700 text-brand-600 focus:ring-brand-500 bg-slate-950"
                  />
                  <span className="font-semibold text-amber-400">Require formal intern acknowledgement</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/30 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Processing Release...'
                      : composeForm.status === 'published'
                      ? 'Dispatch Broadcast'
                      : composeForm.status === 'scheduled'
                      ? 'Confirm Scheduled Broadcast'
                      : 'Save Draft'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Audience Preview Card (Gate 4 & 16) */}
          <div className="space-y-6">
            <div className="erp-card p-5">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <span>Audience Resolution Preview</span>
              </h4>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800/80 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Targeted Recipients</span>
                <div className="text-3xl font-extrabold text-brand-400 font-mono mt-1">
                  {loadingPreview ? '...' : audiencePreview.count}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {composeForm.targetType === 'all' && 'All active accounts across all roles'}
                  {composeForm.targetType === 'interns' && 'All actively enrolled interns'}
                  {composeForm.targetType === 'mentors' && 'All active studio mentors'}
                  {composeForm.targetType === 'admins' && 'All operations and executive admins'}
                  {composeForm.targetType === 'track' && 'Enrolled interns in specified track'}
                  {composeForm.targetType === 'cohort' && 'Enrolled interns in specified cohort'}
                  {composeForm.targetType === 'intern' && 'Designated individual intern'}
                </span>
              </div>

              {/* Sample Recipients List */}
              <div className="mt-4">
                <span className="text-[11px] font-semibold text-slate-400 block mb-2">Sample Targeted Users:</span>
                {audiencePreview.sample.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No users match target rule.</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {audiencePreview.sample.map((u) => (
                      <div
                        key={u.id}
                        className="p-2 rounded bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="text-slate-200 font-medium">
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {u.intern_code || u.role_name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {u.track_name || u.role_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="erp-card p-5 text-xs text-slate-400 space-y-2">
              <h5 className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Institutional Delivery Standard</span>
              </h5>
              <p className="leading-relaxed">
                Publishing an announcement automatically generates in-app notifications for each targeted user in their inbox and updates their notification bell badge.
              </p>
              <p className="text-[11px] text-slate-500">
                If formal acknowledgement is enabled, recipients will be required to acknowledge the directive in their portal before it is marked resolved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACKNOWLEDGEMENT COMPLIANCE TRACKER */}
      {activeTab === 'tracker' && (
        <div className="space-y-6">
          {/* Announcement Selector */}
          <div className="erp-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Select Directive / Announcement Requiring Acknowledgement
              </label>
              <select
                value={selectedAckAnnId}
                onChange={(e) => setSelectedAckAnnId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {ackAnnouncements.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.priority?.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Filter status:</span>
              <select
                value={ackStatusFilter}
                onChange={(e) => setAckStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Targeted Users</option>
                <option value="acknowledged">Acknowledged Only</option>
                <option value="pending">Pending Compliance</option>
              </select>
            </div>
          </div>

          {/* Progress Bar & KPIs */}
          {ackReport.stats && (
            <div className="erp-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Acknowledgement Compliance Rate</h4>
                  <p className="text-xs text-slate-400">Targeted audience acknowledgement completion</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Total Targeted</span>
                    <span className="font-bold text-white text-sm">{ackReport.stats.totalTargeted}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Acknowledged</span>
                    <span className="font-bold text-emerald-400 text-sm">{ackReport.stats.acknowledgedCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Pending</span>
                    <span className="font-bold text-amber-400 text-sm">
                      {ackReport.stats.totalTargeted - ackReport.stats.acknowledgedCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-brand-600 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${ackReport.stats.completionRate}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>0%</span>
                <span className="font-bold text-brand-300">{ackReport.stats.completionRate}% Complete</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Acknowledgement Records Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Identifier / Role</th>
                    <th className="p-3.5">Track / Cohort</th>
                    <th className="p-3.5">Acknowledgement State</th>
                    <th className="p-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ackReport.loading ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500">
                        Loading acknowledgement records...
                      </td>
                    </tr>
                  ) : ackReport.records.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500">
                        No acknowledgement records found.
                      </td>
                    </tr>
                  ) : (
                    ackReport.records.map((r) => (
                      <tr key={r.user_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <span className="font-semibold text-white block">
                            {r.first_name} {r.last_name}
                          </span>
                          <span className="text-[11px] text-slate-500">{r.email}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-xs text-brand-300">{r.intern_code || r.role_name}</span>
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {r.track_name || 'N/A'} {r.cohort_name ? `(${r.cohort_name})` : ''}
                        </td>
                        <td className="p-3.5">
                          {r.is_acknowledged === 1 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Acknowledged</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/60">
                              <AlertCircle className="w-3 h-3 text-amber-400" />
                              <span>Pending Action</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-mono text-[11px] text-slate-400">
                          {r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleString() : '—'}
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

      {/* Modal: View Announcement Details */}
      {viewModalAnn && (
        <Modal
          isOpen={true}
          onClose={() => setViewModalAnn(null)}
          title="Announcement Details"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <Badge
                variant={
                  viewModalAnn.priority === 'urgent'
                    ? 'danger'
                    : viewModalAnn.priority === 'high'
                    ? 'warning'
                    : 'default'
                }
              >
                {viewModalAnn.priority?.toUpperCase()} PRIORITY
              </Badge>
              <Badge variant={viewModalAnn.status === 'published' ? 'success' : 'secondary'}>
                {viewModalAnn.status?.toUpperCase()}
              </Badge>
            </div>

            <h3 className="text-base font-bold text-white">{viewModalAnn.title}</h3>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-wrap">
              {viewModalAnn.content}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-mono">
              <div>
                <span className="text-slate-500 block">Targeting</span>
                <span className="text-slate-200">{viewModalAnn.target_type?.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Requires Ack</span>
                <span className="text-slate-200">{viewModalAnn.requires_acknowledgement ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Published At</span>
                <span className="text-slate-200">{viewModalAnn.published_at || 'Not yet published'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Author</span>
                <span className="text-slate-200">
                  {viewModalAnn.author_first_name} {viewModalAnn.author_last_name}
                </span>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={() => setViewModalAnn(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Schedule Announcement */}
      {scheduleModalAnn && (
        <Modal
          isOpen={true}
          onClose={() => setScheduleModalAnn(null)}
          title="Schedule Publication"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-300">
              Set the future date and time for automatic publication of "{scheduleModalAnn.title}":
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Release Timestamp (Africa/Lagos UTC+1)
              </label>
              <input
                type="datetime-local"
                value={scheduleInputDate}
                onChange={(e) => setScheduleInputDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setScheduleModalAnn(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={!scheduleInputDate}
                onClick={handleConfirmSchedule}
                className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-xs font-semibold"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CommunicationsPage;
