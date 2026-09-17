import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Bell, Pin } from 'lucide-react';

export const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnn = async () => {
      try {
        const res = await api.get('/communications/announcements');
        if (res.data.success) setAnnouncements(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnn();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-brand-400" />
          <span>Official Center Announcements</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Broadcasts, track schedules, guest speaker briefings, and deadline reminders.
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="erp-card p-12 text-center text-slate-500 text-xs">
            No announcements published yet.
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className={`erp-card p-6 relative ${a.is_pinned ? 'border-brand-600/60 bg-slate-900/90' : ''}`}
            >
              {a.is_pinned === 1 && (
                <div className="flex items-center gap-1 text-[11px] font-bold text-brand-400 uppercase tracking-wider mb-2">
                  <Pin className="w-3.5 h-3.5" />
                  <span>Pinned Broadcast</span>
                </div>
              )}
              <h3 className="text-base font-bold text-white">{a.title}</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-line">{a.content}</p>
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Published by {a.first_name} {a.last_name}</span>
                <span>{a.created_at}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
