import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Clock,
  LogOut,
  Bell,
  Check,
  ExternalLink,
  Megaphone,
  CheckSquare,
  Award,
  FileText,
  ShieldAlert,
  Info,
  ChevronRight
} from 'lucide-react';

export const Header = () => {
  const { user, logout, role } = useAuth();
  const navigate = useNavigate();
  const [lagosTime, setLagosTime] = useState('');

  // Notification State
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const dropdownRef = useRef(null);

  // Lagos Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Africa/Lagos',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setLagosTime(new Intl.DateTimeFormat('en-US', options).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/communications/notifications/unread-count');
      if (res.data && typeof res.data.count === 'number') {
        setUnreadCount(res.data.count);
      }
    } catch (err) {
      // Ignore background fetch errors
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000); // 30s background sync
    return () => clearInterval(timer);
  }, []);

  // Fetch recent notifications when dropdown opens
  const fetchRecentNotifs = async () => {
    setLoadingNotifs(true);
    try {
      const res = await api.get('/communications/notifications?limit=6');
      if (res.data && res.data.success) {
        setRecentNotifs(res.data.data);
        if (typeof res.data.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const toggleDropdown = () => {
    if (!showDropdown) {
      fetchRecentNotifs();
    }
    setShowDropdown(!showDropdown);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Mark single notification as read and follow link
  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.patch(`/communications/notifications/${notif.id}/read`);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setRecentNotifs((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
        );
      } catch (e) {
        console.error('Error marking as read:', e);
      }
    }
    setShowDropdown(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await api.patch('/communications/notifications/mark-all-read');
      setUnreadCount(0);
      setRecentNotifs((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  };

  // Get icon by notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-3.5 h-3.5 text-brand-400" />;
      case 'task':
        return <CheckSquare className="w-3.5 h-3.5 text-blue-400" />;
      case 'evaluation':
        return <Award className="w-3.5 h-3.5 text-amber-400" />;
      case 'document':
      case 'certificate':
        return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
      case 'system':
      default:
        return <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const notificationCenterLink = role === 'intern' ? '/intern/notifications' : '/admin/notifications';

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Organization Clock */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300">
          <Clock className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
          <span>Lagos Server Time:</span>
          <span className="font-mono font-bold text-brand-300">{lagosTime || 'Loading...'}</span>
          <span className="text-[10px] text-slate-500 border-l border-slate-700 pl-2">UTC+1</span>
        </div>
        <div className="hidden md:flex items-center text-xs text-slate-400">
          Cutoff: <span className="text-amber-400 font-semibold ml-1">09:00:00 AM</span>
        </div>
      </div>

      {/* Right: Notifications & User Profile */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Notification Bell with Dropdown (Gate 17) */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleDropdown}
            id="notification-bell-button"
            title="In-App Notifications"
            className={`p-2 rounded-lg transition-all duration-150 relative flex items-center justify-center ${
              showDropdown
                ? 'bg-slate-800 text-brand-300 border border-brand-500/40 shadow-sm shadow-brand-500/20'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span
                id="notification-badge-count"
                className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold flex items-center justify-center border-2 border-slate-900 shadow-md animate-pulse"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div
              id="notification-dropdown-menu"
              className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              {/* Dropdown Header */}
              <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand-950 text-brand-400 border border-brand-800 font-mono font-semibold">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-slate-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                {loadingNotifs ? (
                  <div className="p-6 text-center text-xs text-slate-500">Loading notifications...</div>
                ) : recentNotifs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <Info className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                    No notifications yet. You're all caught up!
                  </div>
                ) : (
                  recentNotifs.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 hover:bg-slate-800/60 cursor-pointer transition-colors flex items-start gap-3 relative ${
                        !n.is_read ? 'bg-brand-950/20' : ''
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {getNotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`text-xs truncate ${
                              !n.is_read ? 'font-semibold text-white' : 'font-medium text-slate-300'
                            }`}
                          >
                            {n.title}
                          </h4>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                          {n.message}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                          <span className="capitalize">{n.type}</span>
                          <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="p-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
                <Link
                  to={notificationCenterLink}
                  onClick={() => setShowDropdown(false)}
                  className="w-full py-1 text-center font-medium text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Notification Center & Preferences</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-300 font-bold text-xs">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-white leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-slate-400 capitalize">
              {user?.internCode || user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-800/50 transition-all duration-150 flex items-center gap-1.5 text-xs font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
