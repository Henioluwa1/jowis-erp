import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Bug,
  Terminal,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Ban,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  User,
  Globe,
  Server,
  Lock,
  Unlock,
  AlertOctagon,
  Copy,
  ChevronRight,
  Database,
  ArrowUpRight,
  Layers,
  Sparkles,
  X
} from 'lucide-react';

export const SecurityAuditLogsPage = () => {
  const { user, role } = useAuth();

  // Active Tab: 'logs' | 'firewall' | 'debugger'
  const [activeTab, setActiveTab] = useState('logs');

  // Stats & Monitoring
  const [stats, setStats] = useState(null);
  const [recentThreats, setRecentThreats] = useState([]);
  const [topIps, setTopIps] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Logs stream state
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [threatFilter, setThreatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Blocked IPs state
  const [blockedIps, setBlockedIps] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({ ipAddress: '', reason: 'Malicious activity detected', durationHours: '24' });
  const [blockingSubmitting, setBlockingSubmitting] = useState(false);

  // Debug detail modal state
  const [selectedLog, setSelectedLog] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  // 1. Fetch Security Overview Stats
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/admin/security/stats');
      if (res.data?.success) {
        setStats(res.data.stats);
        setRecentThreats(res.data.recentThreats || []);
        setTopIps(res.data.topIps || []);
      }
    } catch (err) {
      console.error('Failed to load security stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // 2. Fetch System Logs
  const fetchLogs = async (pageNum = 1) => {
    try {
      setLoadingLogs(true);
      const params = {
        page: pageNum,
        limit: 25,
        search: search.trim() || undefined,
        threatLevel: threatFilter !== 'all' ? threatFilter : undefined,
        statusCode: statusFilter !== 'all' ? statusFilter : undefined,
        onlyErrors: onlyErrors ? 'true' : undefined
      };

      const res = await api.get('/admin/security/logs', { params });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setPage(res.data.pagination.page);
        setTotalPages(res.data.pagination.totalPages || 1);
        setTotalLogs(res.data.pagination.total || 0);
      }
    } catch (err) {
      console.error('Failed to load system logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // 3. Fetch Blocked IPs
  const fetchBlockedIps = async () => {
    try {
      setLoadingBlocked(true);
      const res = await api.get('/admin/security/blocked-ips');
      if (res.data?.success) {
        setBlockedIps(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load blocked IPs:', err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLogs(1);
    fetchBlockedIps();
  }, []);

  // Auto-refresh interval (every 5 seconds when toggled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(page);
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, page, search, threatFilter, statusFilter, onlyErrors]);

  const handleApplyFilters = (e) => {
    e?.preventDefault();
    setPage(1);
    fetchLogs(1);
  };

  const handleInspectLog = async (logId) => {
    try {
      setLoadingDetail(true);
      const res = await api.get(`/admin/security/debug/${logId}`);
      if (res.data?.success) {
        setSelectedLog(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch log details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleBlockIpSubmit = async (e) => {
    e.preventDefault();
    if (!blockForm.ipAddress || !blockForm.reason) return;

    try {
      setBlockingSubmitting(true);
      const res = await api.post('/admin/security/block-ip', blockForm);
      if (res.data?.success) {
        setActionMessage({ type: 'success', text: res.data.message });
        setShowBlockModal(false);
        setBlockForm({ ipAddress: '', reason: 'Malicious activity detected', durationHours: '24' });
        fetchBlockedIps();
        fetchStats();
        setTimeout(() => setActionMessage({ type: '', text: '' }), 5000);
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to quarantine IP address.' });
    } finally {
      setBlockingSubmitting(false);
    }
  };

  const handleUnblockIp = async (ipAddress) => {
    if (!window.confirm(`Are you sure you want to release the quarantine on IP ${ipAddress}?`)) return;

    try {
      const res = await api.post('/admin/security/unblock-ip', { ipAddress });
      if (res.data?.success) {
        setActionMessage({ type: 'success', text: res.data.message });
        fetchBlockedIps();
        fetchStats();
        setTimeout(() => setActionMessage({ type: '', text: '' }), 5000);
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to release IP address.' });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setActionMessage({ type: 'success', text: `Copied to clipboard: ${text}` });
    setTimeout(() => setActionMessage({ type: '', text: '' }), 2500);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & DEFENSE SHIELD STATUS                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 border border-slate-700/80 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-inner">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Security Defense & System Debugger
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  SUPER ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Live institutional operations monitor, IP address tracking, hacker defense firewall & technical exception debugger.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Auto Refresh Toggle */}
        <div className="relative z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              autoRefresh
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Auto-refresh log feed every 5s"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span>{autoRefresh ? 'Live Polling ON' : 'Live Polling OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => { fetchStats(); fetchLogs(page); fetchBlockedIps(); }}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            title="Refresh logs & metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
          >
            <Ban className="w-4 h-4" />
            <span>Quarantine IP</span>
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 shadow-lg ${
          actionMessage.type === 'error'
            ? 'bg-rose-950/80 text-rose-200 border border-rose-800'
            : 'bg-emerald-950/80 text-emerald-200 border border-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage({ type: '', text: '' })} className="cursor-pointer text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECURITY TELEMETRY & THREAT METRICS                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Today's Requests</span>
            <Activity className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {loadingStats ? '...' : (stats?.totalRequestsToday?.toLocaleString() || 0)}
          </div>
          <span className="text-[10px] text-slate-400">Total system operations</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Unique Client IPs</span>
            <Globe className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-black text-sky-400 font-mono">
            {loadingStats ? '...' : (stats?.uniqueIpsToday?.toLocaleString() || 0)}
          </div>
          <span className="text-[10px] text-slate-400">Recorded access points</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-rose-900/40 shadow-md">
          <div className="flex items-center justify-between text-rose-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Active Threats</span>
            <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <div className="text-xl font-black text-rose-400 font-mono">
            {loadingStats ? '...' : (stats?.activeThreatsToday || 0)}
          </div>
          <span className="text-[10px] text-slate-400">SQLi, XSS, Probes</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Quarantined IPs</span>
            <Ban className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {loadingStats ? '...' : (stats?.totalBlockedIps || 0)}
          </div>
          <span className="text-[10px] text-slate-400">Blocked in firewall</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">5xx Server Errors</span>
            <Server className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-black text-rose-300 font-mono">
            {loadingStats ? '...' : (stats?.serverErrorsToday || 0)}
          </div>
          <span className="text-[10px] text-slate-400">Exceptions to fix</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">4xx Client Errors</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-300 font-mono">
            {loadingStats ? '...' : (stats?.clientErrorsToday || 0)}
          </div>
          <span className="text-[10px] text-slate-400">Auth & 404 rejects</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. NAVIGATION TABS                                                        */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Operations Log ({totalLogs})</span>
        </button>

        <button
          onClick={() => setActiveTab('firewall')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'firewall'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Firewall & Quarantined IPs ({blockedIps.filter(b => b.is_active).length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('logs'); setOnlyErrors(true); }}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            onlyErrors && activeTab === 'logs'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Bug className="w-4 h-4" />
          <span>Error & Exception Debugger</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB A: LIVE SYSTEM OPERATIONS & DEBUGGER                                   */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          
          {/* Search & Filter Bar */}
          <form onSubmit={handleApplyFilters} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by endpoint, IP address, user name, error message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="erp-input w-full pl-9 py-2 text-xs bg-slate-950 border-slate-700"
              />
            </div>

            {/* Threat Level */}
            <select
              value={threatFilter}
              onChange={(e) => setThreatFilter(e.target.value)}
              className="erp-input py-2 text-xs bg-slate-950 border-slate-700 text-slate-200"
            >
              <option value="all">All Threat Levels</option>
              <option value="NONE">Normal (NONE)</option>
              <option value="SUSPICIOUS">Suspicious</option>
              <option value="HIGH">High Threat</option>
              <option value="CRITICAL">Critical Attack</option>
            </select>

            {/* Status Code */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="erp-input py-2 text-xs bg-slate-950 border-slate-700 text-slate-200"
            >
              <option value="all">All HTTP Status</option>
              <option value="2xx">2xx Success</option>
              <option value="4xx">4xx Client Errors</option>
              <option value="5xx">5xx Server Exceptions</option>
              <option value="403">403 Forbidden</option>
              <option value="401">401 Unauthorized</option>
            </select>

            {/* Only Errors Checkbox */}
            <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer select-none bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800">
              <input
                type="checkbox"
                checked={onlyErrors}
                onChange={(e) => setOnlyErrors(e.target.checked)}
                className="rounded accent-brand-500"
              />
              <span>Errors Only</span>
            </label>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-brand-600/30"
            >
              Filter
            </button>
          </form>

          {/* Logs Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/90 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">User / Accessor</th>
                    <th className="py-3 px-4">Client IP Address</th>
                    <th className="py-3 px-4">Method & Operation / Route</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Threat Level</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500 font-sans">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-400 mb-2" />
                        <span>Loading authoritative system access logs...</span>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-slate-500 font-sans">
                        No system operations found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isError = log.status_code >= 400 || log.error_details;
                      const isThreat = log.threat_level !== 'NONE';

                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-800/50 transition-colors ${
                            isThreat ? 'bg-rose-950/15' : isError ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          {/* Timestamp */}
                          <td className="py-3 px-4 whitespace-nowrap text-[11px] text-slate-400">
                            {new Date(log.created_at).toLocaleString([], {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </td>

                          {/* User */}
                          <td className="py-3 px-4 font-sans whitespace-nowrap">
                            {log.user_name ? (
                              <div>
                                <span className="font-bold text-white block text-xs">{log.user_name}</span>
                                <span className="text-[10px] uppercase font-semibold text-brand-300">
                                  {log.user_role?.replace('_', ' ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">Unauthenticated Visitor</span>
                            )}
                          </td>

                          {/* Client IP Address */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-sky-400">{log.ip_address}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(log.ip_address)}
                                className="text-slate-600 hover:text-slate-300 transition-colors"
                                title="Copy IP Address"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Method & Route */}
                          <td className="py-3 px-4 max-w-xs truncate font-mono text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                log.method === 'GET' ? 'bg-blue-500/20 text-blue-300' :
                                log.method === 'POST' ? 'bg-emerald-500/20 text-emerald-300' :
                                log.method === 'PUT' ? 'bg-amber-500/20 text-amber-300' :
                                log.method === 'DELETE' ? 'bg-rose-500/20 text-rose-300' :
                                'bg-purple-500/20 text-purple-300'
                              }`}>
                                {log.method}
                              </span>
                              <span className="text-slate-200 truncate" title={log.endpoint}>
                                {log.endpoint}
                              </span>
                            </div>
                          </td>

                          {/* Status Code */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              log.status_code >= 500 ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' :
                              log.status_code >= 400 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {log.status_code}
                            </span>
                          </td>

                          {/* Latency */}
                          <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                            {log.duration_ms} ms
                          </td>

                          {/* Threat Level */}
                          <td className="py-3 px-4 whitespace-nowrap font-sans">
                            {log.threat_level === 'CRITICAL' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-600 text-white animate-pulse">
                                CRITICAL THREAT
                              </span>
                            ) : log.threat_level === 'HIGH' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                HIGH THREAT
                              </span>
                            ) : log.threat_level === 'SUSPICIOUS' ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                SUSPICIOUS
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400">
                                NORMAL
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleInspectLog(log.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                                title="Inspect Debugging Telemetry"
                              >
                                <Bug className="w-3.5 h-3.5 text-brand-400" />
                                <span>Inspect</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setBlockForm({
                                    ipAddress: log.ip_address,
                                    reason: `Suspicious activity on ${log.endpoint} (Status ${log.status_code})`,
                                    durationHours: '24'
                                  });
                                  setShowBlockModal(true);
                                }}
                                className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                                title="Block this IP address"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong> ({totalLogs} operations recorded)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchLogs(p); }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold cursor-pointer border border-slate-700"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchLogs(p); }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold cursor-pointer border border-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB B: IP FIREWALL & HACKER DEFENSE                                       */}
      {/* ========================================================================= */}
      {activeTab === 'firewall' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Institutional IP Firewall & Intrusion Defense</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Active defense layer automatically quarantines unauthorized attack vectors, brute-force bots, and malicious IP addresses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockModal(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30"
              >
                <Ban className="w-4 h-4" />
                <span>Add IP to Blocklist</span>
              </button>
            </div>

            {/* Blocked IPs Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/90 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Quarantined IP</th>
                    <th className="py-3 px-4">Reason / Threat Vector</th>
                    <th className="py-3 px-4">Threat Type</th>
                    <th className="py-3 px-4">Quarantine Status</th>
                    <th className="py-3 px-4">Blocked Date</th>
                    <th className="py-3 px-4 text-right">Firewall Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {loadingBlocked ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-slate-500 font-sans">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand-400 mb-2" />
                        <span>Loading firewall blocklist...</span>
                      </td>
                    </tr>
                  ) : blockedIps.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 font-sans">
                        No IP addresses are currently quarantined. All active defense parameters normal.
                      </td>
                    </tr>
                  ) : (
                    blockedIps.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-rose-400">
                          {b.ip_address}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300">
                          {b.reason}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {b.threat_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          {b.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              <Ban className="w-3 h-3" /> QUARANTINED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500">
                              RELEASED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(b.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          {b.is_active ? (
                            <button
                              type="button"
                              onClick={() => handleUnblockIp(b.ip_address)}
                              className="px-3 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold cursor-pointer transition-colors"
                            >
                              Release Ban
                            </button>
                          ) : (
                            <span className="text-slate-500 text-xs italic">Unblocked</span>
                          )}
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

      {/* ========================================================================= */}
      {/* 4. MODAL: DETAILED DEBUGGING INSPECTION                                    */}
      {/* ========================================================================= */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl text-slate-100 relative max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Operation Telemetry Inspector</span>
                    <span className="font-mono text-xs font-normal text-slate-400">ID #{selectedLog.id}</span>
                  </h3>
                  <p className="text-xs text-slate-400">Technical debugging details for error diagnosing & root cause analysis.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs font-sans">
              
              {/* Technical Context Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">HTTP Method</span>
                  <span className="font-bold text-brand-300">{selectedLog.method}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Status Code</span>
                  <span className={`font-bold ${selectedLog.status_code >= 400 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {selectedLog.status_code}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Client IP</span>
                  <span className="font-bold text-sky-400">{selectedLog.ip_address}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Latency</span>
                  <span className="font-bold text-slate-300">{selectedLog.duration_ms} ms</span>
                </div>
              </div>

              {/* Endpoint */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Endpoint</span>
                <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-xs text-slate-200 border border-slate-800 break-all">
                  {selectedLog.endpoint}
                </div>
              </div>

              {/* User Agent */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client User-Agent</span>
                <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 break-all">
                  {selectedLog.user_agent || 'Unknown / Not Provided'}
                </div>
              </div>

              {/* Exception & Error Details (Debugging tool) */}
              {selectedLog.error_details && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase tracking-wider text-[11px]">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Exception Stack Trace & Diagnostic Error</span>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {typeof selectedLog.errorDetailsParsed === 'object'
                      ? JSON.stringify(selectedLog.errorDetailsParsed, null, 2)
                      : selectedLog.error_details}
                  </pre>
                </div>
              )}

              {/* Sanitized Request Payload */}
              {selectedLog.request_payload && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Request Payload (Sanitized)</span>
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {typeof selectedLog.requestPayloadParsed === 'object'
                      ? JSON.stringify(selectedLog.requestPayloadParsed, null, 2)
                      : selectedLog.request_payload}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setBlockForm({
                    ipAddress: selectedLog.ip_address,
                    reason: `Quarantine initiated from log inspection #${selectedLog.id} (${selectedLog.endpoint})`,
                    durationHours: '24'
                  });
                  setSelectedLog(null);
                  setShowBlockModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Block Client IP</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: QUARANTINE / BAN IP ADDRESS                                     */}
      {/* ========================================================================= */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-600/50 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-slate-100 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Quarantine IP Address</h3>
                <p className="text-xs text-slate-400">Institutional Firewall Enforcement</p>
              </div>
            </div>

            <form onSubmit={handleBlockIpSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">IP Address to Block</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.1.50 or 45.33.32.156"
                  value={blockForm.ipAddress}
                  onChange={(e) => setBlockForm({ ...blockForm, ipAddress: e.target.value })}
                  className="erp-input w-full py-2 text-xs bg-slate-950 border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Reason / Threat Vector</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Repeated SQL Injection attack attempts"
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                  className="erp-input w-full py-2 text-xs bg-slate-950 border-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Quarantine Duration</label>
                <select
                  value={blockForm.durationHours}
                  onChange={(e) => setBlockForm({ ...blockForm, durationHours: e.target.value })}
                  className="erp-input w-full py-2 text-xs bg-slate-950 border-slate-700 text-slate-200"
                >
                  <option value="1">1 Hour</option>
                  <option value="24">24 Hours (1 Day)</option>
                  <option value="168">7 Days (1 Week)</option>
                  <option value="720">30 Days</option>
                  <option value="">Indefinite / Permanent Ban</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={blockingSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  {blockingSubmitting ? 'Enforcing...' : 'Enforce Quarantine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
