import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Bell,
  Check,
  Trash2,
  Settings,
  ExternalLink,
  Megaphone,
  CheckSquare,
  Award,
  FileText,
  ShieldAlert,
  Info,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';

export const NotificationInboxPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'preferences'

  // Inbox state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterRead, setFilterRead] = useState('all'); // 'all', 'unread', 'read'
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Preferences state
  const [preferences, setPreferences] = useState({
    announcements_in_app: 1,
    tasks_in_app: 1,
    performance_in_app: 1,
    documents_in_app: 1,
    system_in_app: 1
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefFeedback, setPrefFeedback] = useState(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterRead === 'unread') params.append('isRead', '0');
      if (filterRead === 'read') params.append('isRead', '1');
      params.append('page', page);
      params.append('limit', 15);

      const res = await api.get(`/communications/notifications?${params.toString()}`);
      if (res.data.success) {
        setNotifications(res.data.data);
        if (typeof res.data.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount);
        }
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filterType, filterRead, page]);

  // Fetch preferences
  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await api.get('/communications/preferences');
        if (res.data.success && res.data.data) {
          setPreferences(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      }
    };
    fetchPrefs();
  }, []);

  // Mark single read
  const handleToggleRead = async (notif) => {
    try {
      if (notif.is_read) {
        await api.patch(`/communications/notifications/${notif.id}/unread`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: 0, read_at: null } : n))
        );
        setUnreadCount((c) => c + 1);
      } else {
        await api.patch(`/communications/notifications/${notif.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error('Toggle read error:', err);
    }
  };

  // Mark all read
  const handleMarkAllRead = async () => {
    try {
      await api.patch('/communications/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  // Delete notification
  const handleDelete = async (id) => {
    try {
      await api.delete(`/communications/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchNotifications();
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    setPrefFeedback(null);
    try {
      const res = await api.put('/communications/preferences', {
        announcementsInApp: preferences.announcements_in_app === 1,
        tasksInApp: preferences.tasks_in_app === 1,
        performanceInApp: preferences.performance_in_app === 1,
        documentsInApp: preferences.documents_in_app === 1
      });
      if (res.data.success) {
        setPreferences(res.data.data);
        setPrefFeedback({ type: 'success', text: 'Notification preferences saved successfully!' });
      }
    } catch (err) {
      setPrefFeedback({ type: 'error', text: 'Failed to update preferences.' });
    } finally {
      setSavingPrefs(false);
      setTimeout(() => setPrefFeedback(null), 4000);
    }
  };

  // Icon by type
  const getTypeIcon = (type) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-brand-400" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-blue-400" />;
      case 'evaluation':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'document':
      case 'certificate':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'system':
      default:
        return <ShieldAlert className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-brand-400" />
            <span>Notification Center & Preferences</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time deliverable notifications, review results, announcement alerts, and communication preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && activeTab === 'inbox' && (
            <button
              onClick={handleMarkAllRead}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700"
            >
              <Check className="w-4 h-4 text-brand-400" />
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'inbox'
              ? 'border-brand-500 text-brand-400 bg-brand-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notification Inbox</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-brand-950 text-brand-400 border border-brand-800 text-[10px] font-mono font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'preferences'
              ? 'border-brand-500 text-brand-400 bg-brand-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Notification Preferences</span>
        </button>
      </div>

      {/* TAB 1: NOTIFICATION INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="erp-card p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Read / Unread Pills */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setFilterRead('all'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterRead === 'all'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => { setFilterRead('unread'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  filterRead === 'unread'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-brand-300 font-mono text-[10px]">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setFilterRead('read'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  filterRead === 'read'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Read
              </button>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Category:</span>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Categories</option>
                <option value="announcement">Announcements</option>
                <option value="task">Tasks & Assignments</option>
                <option value="evaluation">Performance Evaluations</option>
                <option value="document">Documents & Verification</option>
                <option value="certificate">Certificates</option>
                <option value="system">System Alerts</option>
              </select>
            </div>
          </div>

          {/* Notifications List */}
          <div className="erp-card overflow-hidden divide-y divide-slate-800/60">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-500">Loading notification inbox...</div>
            ) : notifications.length === 0 ? (
              <div className="p-16 text-center text-xs text-slate-500">
                <Info className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                No notifications found.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4.5 hover:bg-slate-800/40 transition-colors flex items-start gap-4 ${
                    !n.is_read ? 'bg-brand-950/20' : ''
                  }`}
                >
                  {/* Type Icon */}
                  <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getTypeIcon(n.type)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white tracking-wide">{n.title}</span>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" title="Unread" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                      {n.message}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/50 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{n.type?.toUpperCase()}</Badge>

                        {n.link && (
                          <button
                            onClick={() => navigate(n.link)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 hover:underline"
                          >
                            <span>Open Resource</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleRead(n)}
                          className="text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          {n.is_read ? 'Mark as unread' : 'Mark as read'}
                        </button>
                        <button
                          onClick={() => handleDelete(n.id)}
                          title="Dismiss notification"
                          className="p-1 rounded hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1">
            <span>
              Page {pagination.page || 1} of {pagination.totalPages || 1} ({pagination.total || 0} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
              >
                Previous
              </button>
              <button
                disabled={page >= (pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NOTIFICATION PREFERENCES (Gate 8) */}
      {activeTab === 'preferences' && (
        <div className="erp-card p-6 max-w-2xl space-y-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-brand-400" />
              <span>In-App Notification Preferences</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Configure which operational and training updates you wish to receive in your portal notifications inbox.
            </p>
          </div>

          {prefFeedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                prefFeedback.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-800 text-rose-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{prefFeedback.text}</span>
            </div>
          )}

          <div className="space-y-4 divide-y divide-slate-800">
            {/* Announcements */}
            <div className="pt-3 first:pt-0 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-200 text-xs block">
                  Center Announcements & Bulletins
                </span>
                <span className="text-[11px] text-slate-400 leading-snug block">
                  Broadcasts, guest lectures, deadline extensions, and cohort notices.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.announcements_in_app === 1}
                  onChange={(e) =>
                    setPreferences({ ...preferences, announcements_in_app: e.target.checked ? 1 : 0 })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* Tasks & Assignments */}
            <div className="pt-3 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-200 text-xs block">
                  Tasks & Assignment Deliverables
                </span>
                <span className="text-[11px] text-slate-400 leading-snug block">
                  New task assignments, mentor review scores, and revision return notes.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.tasks_in_app === 1}
                  onChange={(e) =>
                    setPreferences({ ...preferences, tasks_in_app: e.target.checked ? 1 : 0 })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* Performance */}
            <div className="pt-3 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-200 text-xs block">
                  Performance Evaluations & Grade Finalizations
                </span>
                <span className="text-[11px] text-slate-400 leading-snug block">
                  Notices when milestone assessments and quarterly evaluations are finalized.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.performance_in_app === 1}
                  onChange={(e) =>
                    setPreferences({ ...preferences, performance_in_app: e.target.checked ? 1 : 0 })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* Documents & Verification */}
            <div className="pt-3 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-slate-200 text-xs block">
                  Documents & Verification Outcomes
                </span>
                <span className="text-[11px] text-slate-400 leading-snug block">
                  Document approvals, rejection feedback with mandatory reviewer notes.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={preferences.documents_in_app === 1}
                  onChange={(e) =>
                    setPreferences({ ...preferences, documents_in_app: e.target.checked ? 1 : 0 })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* System Notifications (Mandatory) */}
            <div className="pt-3 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 text-xs block">
                    Institutional Security & Policy Compliance
                  </span>
                  <span className="px-2 py-0.2 rounded text-[10px] font-bold uppercase bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                    Mandatory
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 leading-snug block mt-0.5">
                  Authoritative attendance cutoff notices, certificate issuance/revocation, and security audit logs cannot be silenced.
                </span>
              </div>
              <div className="flex-shrink-0 text-slate-500 font-mono text-xs font-semibold">
                LOCKED ON
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleSavePreferences}
              disabled={savingPrefs}
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{savingPrefs ? 'Saving Settings...' : 'Save Preferences'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationInboxPage;
