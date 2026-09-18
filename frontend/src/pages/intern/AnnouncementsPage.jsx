import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Megaphone,
  Pin,
  ShieldAlert,
  CheckCircle2,
  Clock,
  User,
  Filter,
  Check,
  AlertCircle,
  Calendar,
  Layers,
  Search
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';

export const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'action_required', 'pinned'
  const [searchQuery, setSearchQuery] = useState('');
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/communications/announcements?limit=50');
      if (res.data.success) {
        setAnnouncements(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Handle single announcement acknowledgement
  const handleAcknowledge = async (annId) => {
    setAcknowledgingId(annId);
    setFeedbackMessage(null);
    try {
      const res = await api.post(`/communications/announcements/${annId}/acknowledge`);
      if (res.data.success) {
        setFeedbackMessage({
          type: 'success',
          text: 'Official announcement acknowledged successfully.'
        });
        // Update local state immediately
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === annId
              ? { ...a, is_acknowledged: 1, acknowledged_at: res.data.data?.acknowledgedAt || new Date().toISOString() }
              : a
          )
        );
      }
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to acknowledge announcement.'
      });
    } finally {
      setAcknowledgingId(null);
      setTimeout(() => setFeedbackMessage(null), 4000);
    }
  };

  // Filtered announcements
  const filtered = announcements.filter((a) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.title?.toLowerCase().includes(q);
      const matchBody = a.content?.toLowerCase().includes(q);
      if (!matchTitle && !matchBody) return false;
    }

    if (filterMode === 'action_required') {
      return a.requires_acknowledgement === 1 && !a.is_acknowledged;
    }
    if (filterMode === 'pinned') {
      return a.is_pinned === 1;
    }
    return true;
  });

  const pendingAckList = announcements.filter(
    (a) => a.requires_acknowledgement === 1 && !a.is_acknowledged
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Megaphone className="w-6 h-6 text-brand-400" />
          <span>Official Center Announcements</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Direct studio broadcasts, track schedules, guest speaker briefings, and institutional deadline reminders.
        </p>
      </div>

      {/* Action Required Banner if unacknowledged announcements exist */}
      {pendingAckList.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 shadow-lg shadow-amber-950/20 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-200">
                Action Required: {pendingAckList.length} Directive(s) Awaiting Acknowledgement
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5 leading-relaxed">
                Institutional policy requires all enrolled interns to formally acknowledge receipt of mandatory center broadcasts.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterMode('action_required')}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all flex-shrink-0"
          >
            Review Pending
          </button>
        </div>
      )}

      {/* Global Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border border-rose-800 text-rose-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="erp-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'all'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Broadcasts ({announcements.length})
          </button>
          <button
            onClick={() => setFilterMode('action_required')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterMode === 'action_required'
                ? 'bg-amber-600 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
          >
            <span>Action Required</span>
            {pendingAckList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 text-[10px] font-mono">
                {pendingAckList.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterMode('pinned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterMode === 'pinned'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Pin className="w-3 h-3" />
            <span>Pinned</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Announcement Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-xs">Loading announcements...</div>
        ) : filtered.length === 0 ? (
          <div className="erp-card p-16 text-center text-slate-500 text-xs">
            No announcements found matching the current filter.
          </div>
        ) : (
          filtered.map((a) => {
            const isAcknowledged = a.is_acknowledged === 1;
            const requiresAck = a.requires_acknowledgement === 1;

            return (
              <div
                key={a.id}
                className={`erp-card p-6 relative transition-all duration-200 ${
                  a.is_pinned === 1 ? 'border-brand-600/50 bg-slate-900/90' : ''
                } ${
                  requiresAck && !isAcknowledged ? 'ring-1 ring-amber-500/30' : ''
                }`}
              >
                {/* Card Top Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {a.is_pinned === 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-400 uppercase tracking-wider">
                        <Pin className="w-3.5 h-3.5" />
                        <span>Pinned</span>
                      </span>
                    )}

                    <Badge
                      variant={
                        a.priority === 'urgent'
                          ? 'danger'
                          : a.priority === 'high'
                          ? 'warning'
                          : a.priority === 'low'
                          ? 'secondary'
                          : 'default'
                      }
                    >
                      {a.priority?.toUpperCase()} PRIORITY
                    </Badge>
                  </div>

                  {/* Acknowledgement Status Badge */}
                  {requiresAck && (
                    <div>
                      {isAcknowledged ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>
                            Acknowledged on {new Date(a.acknowledged_at).toLocaleDateString()}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/60">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Acknowledgement Required</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Title & Body */}
                <h3 className="text-base font-bold text-white tracking-wide">{a.title}</h3>
                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed whitespace-pre-line font-sans">
                  {a.content}
                </p>

                {/* Card Footer */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-4">
                    <span>By {a.author_first_name} {a.author_last_name}</span>
                    <span>
                      {a.published_at
                        ? new Date(a.published_at).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Published recently'}
                    </span>
                  </div>

                  {/* Acknowledge Action Button */}
                  {requiresAck && !isAcknowledged && (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      disabled={acknowledgingId === a.id}
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all self-start sm:self-auto"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{acknowledgingId === a.id ? 'Recording...' : 'Acknowledge Announcement'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AnnouncementsPage;
