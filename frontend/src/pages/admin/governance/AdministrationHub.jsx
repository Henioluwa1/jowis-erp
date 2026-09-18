import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/common/Badge';
import {
  Shield,
  Users,
  ShieldCheck,
  Settings,
  FileText,
  LayoutDashboard,
  Search,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  Key,
  Eye,
  Edit2,
  UserX,
  UserCheck,
  Clock,
  Database,
  Sliders,
  Building,
  Server,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';

export const AdministrationHub = () => {
  const { user: currentUser, role: userRole } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'users', 'roles', 'settings', 'audit'

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

  // -------------------------------------------------------------
  // Overview Tab State
  // -------------------------------------------------------------
  const [overviewData, setOverviewData] = useState(null);

  // -------------------------------------------------------------
  // Users Tab State
  // -------------------------------------------------------------
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');

  // User Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);

  // Form States
  const [newUserForm, setNewUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleName: 'mentor',
    phone: ''
  });
  const [statusReason, setStatusReason] = useState('');
  const [newRoleForm, setNewRoleForm] = useState({ roleName: '', reason: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', reason: '' });
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '' });

  // -------------------------------------------------------------
  // Roles & Permissions State
  // -------------------------------------------------------------
  const [matrixData, setMatrixData] = useState({ roles: [], permissions: [], matrix: [] });
  const [permModuleFilter, setPermModuleFilter] = useState('all');

  // -------------------------------------------------------------
  // Settings Tab State
  // -------------------------------------------------------------
  const [settingsList, setSettingsList] = useState([]);
  const [settingsEdits, setSettingsEdits] = useState({});
  const [settingReason, setSettingReason] = useState('');
  const [savingKey, setSavingKey] = useState(null);

  // -------------------------------------------------------------
  // Audit Logs State
  // -------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditEntityFilter, setAuditEntityFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);

  const showFeedback = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------

  const fetchOverview = async () => {
    try {
      const res = await api.get('/admin/overview');
      if (res.data.success) {
        setOverviewData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load overview:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: userPagination.page,
        limit: userPagination.limit,
        role: userRoleFilter,
        status: userStatusFilter,
        search: userSearch.trim()
      });
      const res = await api.get(`/admin/users?${params.toString()}`);
      if (res.data.success) {
        setUsers(res.data.data);
        setUserPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRolesAndPermissions = async () => {
    try {
      const res = await api.get('/admin/permissions');
      if (res.data.success) {
        setMatrixData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      if (res.data.success) {
        setSettingsList(res.data.data);
        const map = {};
        res.data.data.forEach((s) => {
          map[s.setting_key] = s.setting_value;
        });
        setSettingsEdits(map);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: auditPagination.page,
        limit: auditPagination.limit,
        action: auditActionFilter,
        entityType: auditEntityFilter,
        search: auditSearch.trim()
      });
      const res = await api.get(`/admin/audit-logs?${params.toString()}`);
      if (res.data.success) {
        setAuditLogs(res.data.data);
        setAuditPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'roles') fetchRolesAndPermissions();
    if (activeTab === 'settings') fetchSettings();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab, userPagination.page, userRoleFilter, userStatusFilter, auditPagination.page, auditActionFilter, auditEntityFilter]);

  // -------------------------------------------------------------
  // User Actions
  // -------------------------------------------------------------

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newUserForm.password.length < 8) {
      showFeedback('error', 'Password must be at least 8 characters long.');
      return;
    }
    try {
      const res = await api.post('/admin/users', newUserForm);
      if (res.data.success) {
        showFeedback('success', `User "${newUserForm.email}" created successfully.`);
        setShowCreateUserModal(false);
        setNewUserForm({ firstName: '', lastName: '', email: '', password: '', roleName: 'mentor', phone: '' });
        fetchUsers();
      }
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to create user account.');
    }
  };

  const handleToggleStatus = async () => {
    if (!statusReason.trim() || statusReason.trim().length < 5) {
      showFeedback('error', 'A formal justification reason (min 5 chars) is mandatory.');
      return;
    }
    try {
      const targetStatus = selectedUser.is_active === 1 ? false : true;
      const res = await api.patch(`/admin/users/${selectedUser.id}/status`, {
        isActive: targetStatus,
        reason: statusReason.trim()
      });
      if (res.data.success) {
        showFeedback('success', res.data.message);
        setShowStatusModal(false);
        setStatusReason('');
        fetchUsers();
      }
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to update account status.');
    }
  };

  const handleChangeRole = async () => {
    if (!newRoleForm.reason.trim() || newRoleForm.reason.trim().length < 5) {
      showFeedback('error', 'A formal justification reason (min 5 chars) is required.');
      return;
    }
    try {
      const res = await api.patch(`/admin/users/${selectedUser.id}/role`, {
        roleName: newRoleForm.roleName,
        reason: newRoleForm.reason.trim()
      });
      if (res.data.success) {
        showFeedback('success', res.data.message);
        setShowRoleModal(false);
        setNewRoleForm({ roleName: '', reason: '' });
        fetchUsers();
      }
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to update user role.');
    }
  };

  const handleResetPassword = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      showFeedback('error', 'New password must be at least 8 characters long.');
      return;
    }
    try {
      const res = await api.post(`/admin/users/${selectedUser.id}/reset-password`, {
        newPassword: passwordForm.newPassword,
        reason: passwordForm.reason.trim() || 'Administrative reset requested'
      });
      if (res.data.success) {
        showFeedback('success', res.data.message);
        setShowPasswordModal(false);
        setPasswordForm({ newPassword: '', reason: '' });
      }
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to reset user password.');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/admin/users/${selectedUser.id}`, editForm);
      if (res.data.success) {
        showFeedback('success', 'User profile updated successfully.');
        setShowEditUserModal(false);
        fetchUsers();
      }
    } catch (err) {
      showFeedback('error', err.response?.data?.message || 'Failed to update user profile.');
    }
  };

  const handleSaveSetting = async (key) => {
    setSavingKey(key);
    try {
      const val = settingsEdits[key];
      const res = await api.put(`/admin/settings/${key}`, {
        value: val,
        reason: settingReason.trim() || `Administrative modification of ${key}`
      });
      if (res.data.success) {
        showFeedback('success', `Setting "${key}" updated successfully.`);
        setSettingReason('');
        fetchSettings();
      }
    } catch (err) {
      showFeedback('error', err.response?.data?.message || `Failed to update setting "${key}".`);
    } finally {
      setSavingKey(null);
    }
  };

  // Filter permissions matrix by module
  const modules = Array.from(new Set(matrixData.permissions.map((p) => p.module)));
  const filteredMatrix = matrixData.matrix.filter(
    (row) => permModuleFilter === 'all' || row.module === permModuleFilter
  );

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="erp-card p-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-brand-400 font-mono text-xs font-semibold uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4" />
            <span>Phase 8 Enterprise Governance Desk</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Administration & Governance Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Centralized User Oversight, Role Escalation Safeguards, Permission Matrix & Immutable Audit Trail.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-brand-950 text-brand-300 border border-brand-800/60 font-mono uppercase">
            Logged In As: {userRole?.replace('_', ' ')}
          </span>
          <button
            onClick={() => {
              if (activeTab === 'overview') fetchOverview();
              if (activeTab === 'users') fetchUsers();
              if (activeTab === 'roles') fetchRolesAndPermissions();
              if (activeTab === 'settings') fetchSettings();
              if (activeTab === 'audit') fetchAuditLogs();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
            title="Refresh current view"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg transition-all animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-800/80 shadow-emerald-950/50'
              : 'bg-rose-950/90 text-rose-200 border border-rose-800/80 shadow-rose-950/50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-current opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'overview', label: 'Governance Overview', icon: LayoutDashboard },
          { id: 'users', label: 'User Administration', icon: Users },
          { id: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
          { id: 'settings', label: 'Organization & System Settings', icon: Settings },
          { id: 'audit', label: 'Immutable Audit Logs', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GOVERNANCE OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Users', value: overviewData?.summary.totalUsers ?? '—', icon: Users, color: 'text-brand-400' },
              { label: 'Active Accounts', value: overviewData?.summary.activeUsers ?? '—', icon: UserCheck, color: 'text-emerald-400' },
              { label: 'Active Interns', value: overviewData?.summary.activeInterns ?? '—', icon: User, color: 'text-sky-400' },
              { label: 'Active Mentors', value: overviewData?.summary.activeMentors ?? '—', icon: ShieldCheck, color: 'text-amber-400' },
              { label: 'Active Cohorts', value: overviewData?.summary.activeCohorts ?? '—', icon: Building, color: 'text-purple-400' },
              { label: 'Active Tracks', value: overviewData?.summary.activeTracks ?? '—', icon: Sliders, color: 'text-indigo-400' }
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={idx} className="erp-card p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[11px] font-medium tracking-wide uppercase">{card.label}</span>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">{card.value}</div>
                </div>
              );
            })}
          </div>

          {/* Middle Two-Column Grid: Role Breakdown & System Health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users by Role Card */}
            <div className="erp-card p-6">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-brand-400" />
                <span>Roster Composition by Institutional Role</span>
              </h2>
              <div className="space-y-3">
                {overviewData?.usersByRole?.map((r) => (
                  <div key={r.role} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-500"></span>
                      <span className="text-xs font-semibold text-white capitalize">{r.role.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="text-emerald-400 font-bold">{r.active_count} active</span>
                      <span className="text-slate-500">/ {r.total} total</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Health & Lagos Environment Card */}
            <div className="erp-card p-6">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>System Architecture & Authoritative Environment</span>
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Database Engine</div>
                  <div className="text-white font-mono font-bold mt-1">{overviewData?.systemHealth?.database}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{overviewData?.systemHealth?.engineVersion}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Authoritative Clock</div>
                  <div className="text-emerald-400 font-mono font-bold mt-1">{overviewData?.systemHealth?.serverTimeLagos}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{overviewData?.systemHealth?.timezone}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Node.js Uptime</div>
                  <div className="text-white font-mono font-bold mt-1">
                    {Math.floor((overviewData?.systemHealth?.nodeUptimeSeconds || 0) / 60)} minutes
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">Daemon Status: Active</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">30-Day Security Actions</div>
                  <div className="text-amber-400 font-mono font-bold mt-1">
                    {(overviewData?.securitySummary?.statusChangesLast30Days || 0) +
                      (overviewData?.securitySummary?.roleChangesLast30Days || 0) +
                      (overviewData?.securitySummary?.passwordResetsLast30Days || 0)}{' '}
                    audited events
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Strict Governance Logged</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Feed Card */}
          <div className="erp-card p-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-brand-400" />
              <span>Real-Time Governance Activity Stream</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                    <th className="pb-3 pl-2">Timestamp (Lagos)</th>
                    <th className="pb-3">Administrator / Actor</th>
                    <th className="pb-3">Action Recorded</th>
                    <th className="pb-3">Target Entity</th>
                    <th className="pb-3">Justification Reason</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {overviewData?.recentActivity?.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 pl-2 font-mono text-slate-400 text-[11px]">
                        {new Date(act.created_at).toLocaleString()}
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-white">
                          {act.first_name ? `${act.first_name} ${act.last_name}` : 'System Engine'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{act.email || 'Automated'}</div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-brand-300 border border-slate-700">
                          {act.action}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-slate-300 text-[11px]">
                        {act.entity_type} {act.entity_id ? `#${act.entity_id}` : ''}
                      </td>
                      <td className="py-3 text-slate-300 max-w-xs truncate text-[11px]">
                        {act.reason || '—'}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
                          {act.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USER MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="erp-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by name, email, or intern code..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Role Filter */}
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="mentor">Mentor</option>
                <option value="intern">Intern</option>
              </select>

              {/* Status Filter */}
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Deactivated Only</option>
              </select>
            </div>

            <button
              onClick={() => setShowCreateUserModal(true)}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Provision User Account</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-mono uppercase text-[11px]">
                    <th className="p-3.5">User Identity</th>
                    <th className="p-3.5">Contact Details</th>
                    <th className="p-3.5">Assigned Role</th>
                    <th className="p-3.5">Placement / Track</th>
                    <th className="p-3.5">Account Status</th>
                    <th className="p-3.5">Last Login</th>
                    <th className="p-3.5 text-right">Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500 font-mono">
                        Loading administrative records...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500 font-mono">
                        No user accounts found matching query.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-brand-300">
                              {u.first_name?.[0] || 'U'}
                            </div>
                            <div>
                              <span>{u.first_name} {u.last_name}</span>
                              {u.intern_code && (
                                <span className="block text-[10px] font-mono text-brand-400">{u.intern_code}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5 font-mono text-slate-300 text-[11px]">
                          <div>{u.email}</div>
                          <div className="text-slate-500 text-[10px]">{u.phone || 'No phone'}</div>
                        </td>

                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase border ${
                              u.role_name === 'super_admin'
                                ? 'bg-purple-950 text-purple-300 border-purple-800/60'
                                : u.role_name === 'admin'
                                ? 'bg-blue-950 text-blue-300 border-blue-800/60'
                                : u.role_name === 'mentor'
                                ? 'bg-amber-950 text-amber-300 border-amber-800/60'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                            }`}
                          >
                            {u.role_name.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {u.track_name ? (
                            <div>
                              <span className="text-slate-200 font-semibold">{u.track_name}</span>
                              <span className="block text-[10px] text-slate-500">{u.cohort_name}</span>
                            </div>
                          ) : u.mentor_specialization ? (
                            <span className="text-amber-400 text-[10px]">{u.mentor_specialization}</span>
                          ) : (
                            <span className="text-slate-600">Enterprise Staff</span>
                          )}
                        </td>

                        <td className="p-3.5">
                          {u.is_active === 1 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-mono text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>Active</span>
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold font-mono text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                <span>Deactivated</span>
                              </span>
                              {u.deactivation_reason && (
                                <span className="block text-[10px] text-rose-300/80 truncate max-w-[150px]">
                                  {u.deactivation_reason}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                          {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* View Profile Detail */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setShowDetailModal(true);
                              }}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              title="Inspect Full Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Profile */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setEditForm({
                                  firstName: u.first_name,
                                  lastName: u.last_name,
                                  phone: u.phone || ''
                                });
                                setShowEditUserModal(true);
                              }}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                              title="Edit Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Role Change */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setNewRoleForm({ roleName: u.role_name, reason: '' });
                                setShowRoleModal(true);
                              }}
                              className="p-1.5 rounded bg-slate-800 hover:bg-indigo-900/60 text-indigo-300 transition-colors"
                              title="Change Role"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setPasswordForm({ newPassword: '', reason: '' });
                                setShowPasswordModal(true);
                              }}
                              className="p-1.5 rounded bg-slate-800 hover:bg-amber-900/60 text-amber-300 transition-colors"
                              title="Reset Password"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            {/* Activate / Deactivate Toggle */}
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setStatusReason('');
                                setShowStatusModal(true);
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                u.is_active === 1
                                  ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-400'
                                  : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-400'
                              }`}
                              title={u.is_active === 1 ? 'Deactivate Account' : 'Activate Account'}
                            >
                              {u.is_active === 1 ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div>
                Showing page {userPagination.page} of {userPagination.totalPages} ({userPagination.total} total accounts)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={userPagination.page <= 1}
                  onClick={() => setUserPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center gap-1 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  disabled={userPagination.page >= userPagination.totalPages}
                  onClick={() => setUserPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center gap-1 transition-all"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ROLES & PERMISSIONS MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="erp-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-400" />
                  <span>Centralized RBAC Capability Matrix</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Server-enforced institutional authorization covering all 14 enterprise domains.
                </p>
              </div>

              {/* Module Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={permModuleFilter}
                  onChange={(e) => setPermModuleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                >
                  <option value="all">All Modules</option>
                  {modules.map((m) => (
                    <option key={m} value={m} className="capitalize">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-mono uppercase text-[11px]">
                    <th className="p-3.5">Domain Module</th>
                    <th className="p-3.5">Permission Capability</th>
                    <th className="p-3.5">Action Slug</th>
                    <th className="p-3.5 text-center text-purple-300">Super Admin</th>
                    <th className="p-3.5 text-center text-blue-300">Admin</th>
                    <th className="p-3.5 text-center text-amber-300">Mentor</th>
                    <th className="p-3.5 text-center text-emerald-300">Intern</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMatrix.map((row) => (
                    <tr key={row.slug} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-bold text-white capitalize">{row.module}</td>
                      <td className="p-3.5 text-slate-300">{row.description}</td>
                      <td className="p-3.5 font-mono text-[11px] text-brand-400">{row.slug}</td>

                      {/* Super Admin */}
                      <td className="p-3.5 text-center">
                        {row.roles.super_admin ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 leading-5 text-center font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Admin */}
                      <td className="p-3.5 text-center">
                        {row.roles.admin ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 leading-5 text-center font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Mentor */}
                      <td className="p-3.5 text-center">
                        {row.roles.mentor ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 leading-5 text-center font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold">—</span>
                        )}
                      </td>

                      {/* Intern */}
                      <td className="p-3.5 text-center">
                        {row.roles.intern ? (
                          <span className="inline-block w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 leading-5 text-center font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-600 font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ORGANIZATION & SYSTEM SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Form Groups */}
          {['general', 'attendance', 'certificates', 'security', 'performance', 'alerts'].map((category) => {
            const catSettings = settingsList.filter((s) => s.category === category);
            if (catSettings.length === 0) return null;

            return (
              <div key={category} className="erp-card p-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
                  <div className="flex items-center gap-2">
                    {category === 'general' && <Building className="w-4 h-4 text-brand-400" />}
                    {category === 'attendance' && <Clock className="w-4 h-4 text-emerald-400" />}
                    {category === 'certificates' && <FileText className="w-4 h-4 text-sky-400" />}
                    {category === 'security' && <Lock className="w-4 h-4 text-purple-400" />}
                    {category === 'performance' && <Sliders className="w-4 h-4 text-amber-400" />}
                    {category === 'alerts' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    <h2 className="text-sm font-bold text-white capitalize tracking-wide">
                      {category} Configuration & Rules
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {catSettings.length} setting{catSettings.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {catSettings.map((s) => (
                    <div key={s.setting_key} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-200 font-mono">
                            {s.setting_key}
                          </label>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {s.value_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 mb-3">{s.description}</p>
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        {s.value_type === 'boolean' ? (
                          <select
                            value={settingsEdits[s.setting_key] || '0'}
                            onChange={(e) =>
                              setSettingsEdits({ ...settingsEdits, [s.setting_key]: e.target.value })
                            }
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                          >
                            <option value="1">1 (Enabled / True)</option>
                            <option value="0">0 (Disabled / False)</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={settingsEdits[s.setting_key] ?? ''}
                            onChange={(e) =>
                              setSettingsEdits({ ...settingsEdits, [s.setting_key]: e.target.value })
                            }
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                          />
                        )}

                        <button
                          disabled={savingKey === s.setting_key || settingsEdits[s.setting_key] === s.setting_value}
                          onClick={() => handleSaveSetting(s.setting_key)}
                          className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 shadow transition-all"
                        >
                          <Save className="w-3 h-3" />
                          <span>{savingKey === s.setting_key ? 'Saving...' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: IMMUTABLE AUDIT LOGS VIEWER */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Filter Toolbar */}
          <div className="erp-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by action, entity, user, or reason..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Action Filter */}
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 font-mono"
              >
                <option value="all">All Actions</option>
                <option value="CREATE_USER">CREATE_USER</option>
                <option value="UPDATE_USER">UPDATE_USER</option>
                <option value="ACTIVATE_USER">ACTIVATE_USER</option>
                <option value="DEACTIVATE_USER">DEACTIVATE_USER</option>
                <option value="CHANGE_ROLE">CHANGE_ROLE</option>
                <option value="RESET_PASSWORD">RESET_PASSWORD</option>
                <option value="UPDATE_SYSTEM_SETTING">UPDATE_SYSTEM_SETTING</option>
                <option value="UPDATE_ORGANIZATION_SETTING">UPDATE_ORGANIZATION_SETTING</option>
                <option value="PUBLISH_ANNOUNCEMENT">PUBLISH_ANNOUNCEMENT</option>
                <option value="CERTIFICATE_ISSUED">CERTIFICATE_ISSUED</option>
                <option value="DOCUMENT_VERIFIED">DOCUMENT_VERIFIED</option>
              </select>

              {/* Entity Type Filter */}
              <select
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-brand-500 font-mono"
              >
                <option value="all">All Entity Types</option>
                <option value="users">users</option>
                <option value="system_settings">system_settings</option>
                <option value="attendance">attendance</option>
                <option value="tasks">tasks</option>
                <option value="performance_evaluations">performance_evaluations</option>
                <option value="intern_documents">intern_documents</option>
                <option value="certificates">certificates</option>
                <option value="announcements">announcements</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-mono uppercase text-[11px]">
                    <th className="p-3.5">Timestamp (Lagos)</th>
                    <th className="p-3.5">Administrator</th>
                    <th className="p-3.5">Action Executed</th>
                    <th className="p-3.5">Target Scope</th>
                    <th className="p-3.5">Formal Justification</th>
                    <th className="p-3.5">Network Context</th>
                    <th className="p-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500 font-mono">
                        Querying immutable audit logs...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-500 font-mono">
                        No audit records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString()}
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-white">
                            {l.first_name ? `${l.first_name} ${l.last_name}` : 'System Kernel'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{l.role_name || 'root'}</div>
                        </td>

                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-brand-300 border border-slate-700">
                            {l.action}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono text-slate-300 text-[11px]">
                          {l.entity_type} {l.entity_id ? `#${l.entity_id}` : ''}
                        </td>

                        <td className="p-3.5 text-slate-300 text-[11px] max-w-xs truncate">
                          {l.reason || '—'}
                        </td>

                        <td className="p-3.5 font-mono text-[10px] text-slate-500">
                          <div>{l.ip_address || '127.0.0.1'}</div>
                          <div className="truncate max-w-[120px]">{l.user_agent || 'Client'}</div>
                        </td>

                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedAuditLog(l)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-brand-300 font-mono text-[11px] border border-slate-700 transition-all"
                          >
                            Inspect Payload
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <div>
                Showing page {auditPagination.page} of {auditPagination.totalPages} ({auditPagination.total} total logs)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={auditPagination.page <= 1}
                  onClick={() => setAuditPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center gap-1 transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  disabled={auditPagination.page >= auditPagination.totalPages}
                  onClick={() => setAuditPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center gap-1 transition-all"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PROVISION NEW USER */}
      {/* ========================================================================= */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="erp-card max-w-lg w-full p-6 border-slate-700 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-400" />
                <span>Provision User Account</span>
              </h3>
              <button onClick={() => setShowCreateUserModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.firstName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.lastName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Institutional Email *</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500 font-mono"
                  placeholder="user@jowis.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Initial Password * (min 8)</label>
                  <input
                    type="password"
                    required
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Role Assignment *</label>
                  <select
                    value={newUserForm.roleName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, roleName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500 font-mono"
                  >
                    {userRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
                    <option value="admin">Operational Admin</option>
                    <option value="mentor">Mentor</option>
                    <option value="intern">Intern</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Phone Contact (Optional)</label>
                <input
                  type="text"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500 font-mono"
                  placeholder="+234 800 000 0000"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-lg"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ACTIVATE / DEACTIVATE WITH MANDATORY REASON */}
      {/* ========================================================================= */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="erp-card max-w-md w-full p-6 border-slate-700 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {selectedUser.is_active === 1 ? (
                  <UserX className="w-5 h-5 text-rose-400" />
                ) : (
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                )}
                <span>
                  {selectedUser.is_active === 1 ? 'Deactivate Account' : 'Reactivate Account'}
                </span>
              </h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Target User:{' '}
              <strong className="text-white">
                {selectedUser.first_name} {selectedUser.last_name} ({selectedUser.email})
              </strong>
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-200">
                Formal Administrative Justification (Mandatory) *
              </label>
              <textarea
                rows="3"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Enter regulatory or operational reason for this account status change..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                className={`px-4 py-2 rounded-lg font-bold text-xs text-white shadow-lg ${
                  selectedUser.is_active === 1 ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                Confirm {selectedUser.is_active === 1 ? 'Deactivation' : 'Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ROLE CHANGE WITH ESCALATION CONTROLS */}
      {/* ========================================================================= */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="erp-card max-w-md w-full p-6 border-slate-700 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <span>Modify Institutional Role</span>
              </h3>
              <button onClick={() => setShowRoleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/50 text-[11px] text-amber-200 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Privilege Guard: Only Super Admins may grant super_admin privilege. Self-role escalation is blocked.
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Role Target</label>
                <select
                  value={newRoleForm.roleName}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, roleName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                >
                  {userRole === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  <option value="admin">Operational Admin</option>
                  <option value="mentor">Mentor</option>
                  <option value="intern">Intern</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mandatory Governance Reason *</label>
                <textarea
                  rows="3"
                  value={newRoleForm.reason}
                  onChange={(e) => setNewRoleForm({ ...newRoleForm, reason: e.target.value })}
                  placeholder="State formal justification for altering institutional authorization..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangeRole}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg"
              >
                Apply Role Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADMINISTRATIVE PASSWORD RESET */}
      {/* ========================================================================= */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="erp-card max-w-md w-full p-6 border-slate-700 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <span>Administrative Password Reset</span>
              </h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Resetting credentials for: <strong className="text-white">{selectedUser.email}</strong>
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">New Password * (min 8 chars)</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={passwordForm.reason}
                  onChange={(e) => setPasswordForm({ ...passwordForm, reason: e.target.value })}
                  placeholder="e.g. User requested credential reset"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-lg"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: AUDIT LOG PAYLOAD INSPECTOR */}
      {/* ========================================================================= */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="erp-card max-w-2xl w-full p-6 border-slate-700 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-400" />
                <span>Audit Trail Payload Inspector #{selectedAuditLog.id}</span>
              </h3>
              <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Action:</span>
                  <div className="text-brand-300 font-bold">{selectedAuditLog.action}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Entity:</span>
                  <div className="text-white">
                    {selectedAuditLog.entity_type} #{selectedAuditLog.entity_id}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Actor:</span>
                  <div className="text-white">{selectedAuditLog.email || 'System'}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Justification Reason:</span>
                  <div className="text-amber-300 font-sans">{selectedAuditLog.reason || 'None provided'}</div>
                </div>
              </div>

              {/* Before State */}
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Before State (Previous Payload)
                </label>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 overflow-x-auto text-[11px] text-slate-300 max-h-36">
                  {selectedAuditLog.old_value
                    ? JSON.stringify(JSON.parse(selectedAuditLog.old_value), null, 2)
                    : 'null (Created)'}
                </pre>
              </div>

              {/* After State */}
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  After State (Updated Payload)
                </label>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 overflow-x-auto text-[11px] text-emerald-300 max-h-36">
                  {selectedAuditLog.new_value
                    ? JSON.stringify(JSON.parse(selectedAuditLog.new_value), null, 2)
                    : 'null (Deleted)'}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdministrationHub;
