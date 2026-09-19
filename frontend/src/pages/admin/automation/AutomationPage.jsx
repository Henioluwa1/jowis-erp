import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/common/Badge';
import {
  Cpu,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  Sliders,
  Filter,
  Search,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
  Shield,
  Zap,
  Bell,
  Check,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AutomationPage = () => {
  const { user, role } = useAuth();
  const isSuperOrAdmin = role === 'super_admin' || role === 'admin';

  const [activeTab, setActiveTab] = useState('rules'); // 'rules', 'executions', 'alerts'
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: '' }

  // -------------------------------------------------------------
  // Tab 1: Rules State
  // -------------------------------------------------------------
  const [rules, setRules] = useState([]);
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState('all');
  const [runningRules, setRunningRules] = useState({}); // { [ruleCode]: true }
  const [selectedRuleForConfig, setSelectedRuleForConfig] = useState(null);
  const [configFormData, setConfigFormData] = useState({
    name: '',
    description: '',
    schedule_interval: 'daily',
    configJson: ''
  });

  // -------------------------------------------------------------
  // Tab 2: Execution History State
  // -------------------------------------------------------------
  const [executions, setExecutions] = useState([]);
  const [execPagination, setExecPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [execRuleFilter, setExecRuleFilter] = useState('all');
  const [execStatusFilter, setExecStatusFilter] = useState('all');
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [retryingExecId, setRetryingExecId] = useState(null);

  // -------------------------------------------------------------
  // Tab 3: System Alerts State
  // -------------------------------------------------------------
  const [alerts, setAlerts] = useState([]);

  // Fetch Rules
  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await api.get('/automation/rules');
      if (res.data.success) {
        setRules(res.data.data);
      }
    } catch (err) {
      console.error('fetchRules error:', err);
      setFeedback({ type: 'error', text: 'Failed to load automation rules.' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Executions
  const fetchExecutions = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: execPagination.limit,
        ruleCode: execRuleFilter,
        status: execStatusFilter
      });
      const res = await api.get(`/automation/executions?${params.toString()}`);
      if (res.data.success) {
        setExecutions(res.data.data);
        setExecPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('fetchExecutions error:', err);
      setFeedback({ type: 'error', text: 'Failed to load execution records.' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch Alerts
  const fetchAlerts = async () => {
    try {
      const res = await api.get('/automation/alerts');
      if (res.data.success) {
        setAlerts(res.data.data);
      }
    } catch (err) {
      console.error('fetchAlerts error:', err);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (activeTab === 'executions') {
      fetchExecutions(1);
    }
  }, [activeTab, execRuleFilter, execStatusFilter]);

  // Handle Manual Rule Trigger ("Run Now")
  const handleRunRule = async (ruleCode) => {
    setRunningRules(prev => ({ ...prev, [ruleCode]: true }));
    setFeedback(null);
    try {
      const res = await api.post(`/automation/rules/${ruleCode}/run`, { force: true });
      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: res.data.message || `Automation ${ruleCode} completed successfully.`
        });
        fetchRules();
        fetchAlerts();
      } else {
        setFeedback({
          type: 'error',
          text: res.data.message || `Automation run ${res.data.data?.status || 'failed'}.`
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || `Execution error for ${ruleCode}.`
      });
    } finally {
      setRunningRules(prev => ({ ...prev, [ruleCode]: false }));
    }
  };

  // Handle Enable/Disable Toggle
  const handleToggleRule = async (ruleId) => {
    try {
      const res = await api.patch(`/automation/rules/${ruleId}/toggle`);
      if (res.data.success) {
        setRules(prev =>
          prev.map(r => (r.id === ruleId ? { ...r, is_enabled: res.data.data.is_enabled } : r))
        );
        setFeedback({
          type: 'success',
          text: res.data.message
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to toggle rule state.'
      });
    }
  };

  // Handle Retry
  const handleRetryExecution = async (executionId) => {
    setRetryingExecId(executionId);
    try {
      const res = await api.post(`/automation/executions/${executionId}/retry`);
      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: res.data.message || 'Execution successfully retried.'
        });
        fetchExecutions(execPagination.page);
        fetchAlerts();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Retry failed.'
      });
    } finally {
      setRetryingExecId(null);
    }
  };

  // Handle Open Config Modal
  const openConfigModal = (rule) => {
    setSelectedRuleForConfig(rule);
    setConfigFormData({
      name: rule.name,
      description: rule.description || '',
      schedule_interval: rule.schedule_interval || 'daily',
      configJson: JSON.stringify(rule.config || {}, null, 2)
    });
  };

  // Handle Save Config
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedRuleForConfig) return;

    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configFormData.configJson);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Invalid JSON configuration syntax.' });
      return;
    }

    try {
      const res = await api.put(`/automation/rules/${selectedRuleForConfig.id}`, {
        name: configFormData.name,
        description: configFormData.description,
        schedule_interval: configFormData.schedule_interval,
        config: parsedConfig
      });
      if (res.data.success) {
        setFeedback({ type: 'success', text: `Rule '${selectedRuleForConfig.rule_code}' configuration saved.` });
        setSelectedRuleForConfig(null);
        fetchRules();
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update rule configuration.'
      });
    }
  };

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    if (ruleCategoryFilter === 'all') return true;
    return r.category === ruleCategoryFilter;
  });

  const activeRulesCount = rules.filter(r => r.is_enabled).length;
  const totalCompletedRuns = rules.reduce((acc, r) => acc + (r.total_completed_runs || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-brand-400" />
            <span>Advanced ERP & Automation Engine</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic Business Workflow Orchestration, Idempotent Trigger Execution, Bounded Retries & System Anomaly Alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-brand-950 text-brand-300 border border-brand-800/60 font-mono uppercase">
            Timezone: Africa/Lagos
          </span>
          <button
            onClick={() => {
              if (activeTab === 'rules') fetchRules();
              if (activeTab === 'executions') fetchExecutions(execPagination.page);
              fetchAlerts();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
            title="Refresh views"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="erp-card p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Configured Rules</span>
            <Sliders className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{rules.length}</p>
          <p className="text-[11px] text-emerald-400 font-mono mt-1 font-semibold">{activeRulesCount} Active Rules</p>
        </div>

        <div className="erp-card p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Successful Executions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{totalCompletedRuns}</p>
          <p className="text-[11px] text-slate-400 font-mono mt-1 font-semibold">Deterministic & Idempotent</p>
        </div>

        <div className="erp-card p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Live System Alerts</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{alerts.length}</p>
          <p className="text-[11px] text-amber-400 font-mono mt-1 font-semibold">Actionable Anomalies</p>
        </div>

        <div className="erp-card p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Engine Status</span>
            <Zap className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-base font-bold text-emerald-400 tracking-tight flex items-center gap-1.5 mt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            OPERATIONAL
          </p>
          <p className="text-[11px] text-slate-400 font-mono mt-1">Bounded Retry Max: 3</p>
        </div>
      </div>

      {/* Tab Navigation Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'rules', label: 'Automation Rules & Triggers', icon: Sliders, count: rules.length },
          { id: 'executions', label: 'Execution History & Audit Log', icon: Clock, count: execPagination.total || null },
          { id: 'alerts', label: 'Live Operational Alerts', icon: Bell, count: alerts.length || null }
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
              {tab.count !== null && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${isActive ? 'bg-brand-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUTOMATION RULES & TRIGGERS */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Domain:
            </span>
            {['all', 'attendance', 'tasks', 'training', 'performance', 'documents', 'certificates', 'cohorts', 'mentors', 'reports'].map((cat) => (
              <button
                key={cat}
                onClick={() => setRuleCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg font-medium capitalize transition-all ${
                  ruleCategoryFilter === cat
                    ? 'bg-brand-600 text-white font-bold shadow-sm shadow-brand-600/20'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map((rule) => {
              const isRunning = !!runningRules[rule.rule_code];
              const isEnabled = !!rule.is_enabled;

              return (
                <div
                  key={rule.id}
                  className={`erp-card p-5 flex flex-col justify-between transition-all border ${
                    isEnabled ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/40 opacity-70 bg-slate-950/40'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {rule.category}
                        </span>
                        <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">{rule.name}</h3>
                      </div>
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isEnabled
                            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400 hover:bg-emerald-900'
                            : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                        title={isEnabled ? 'Rule is Enabled (Click to disable)' : 'Rule is Disabled (Click to enable)'}
                      >
                        <Zap className={`w-4 h-4 ${isEnabled ? 'fill-emerald-400' : ''}`} />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed min-h-[48px]">{rule.description}</p>

                    <div className="pt-2 border-t border-slate-800/70 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500 block">Schedule</span>
                        <span className="font-semibold text-slate-300 capitalize">{rule.schedule_interval}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Last Run</span>
                        <span className="font-mono text-slate-300 truncate block">{rule.last_run_at || 'Never'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/70 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openConfigModal(rule)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all flex items-center gap-1.5"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Config</span>
                    </button>

                    <button
                      onClick={() => handleRunRule(rule.rule_code)}
                      disabled={isRunning}
                      className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 ${
                        isRunning
                          ? 'bg-brand-800 text-brand-200 cursor-not-allowed'
                          : 'bg-brand-600 hover:bg-brand-500 text-white shadow-sm shadow-brand-500/20'
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Running...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Run Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MASTER EXECUTION HISTORY & AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === 'executions' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="erp-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Filter Rule</label>
                <select
                  value={execRuleFilter}
                  onChange={(e) => setExecRuleFilter(e.target.value)}
                  className="erp-input text-xs py-1.5 px-3 bg-slate-900 border-slate-700 rounded-lg text-white"
                >
                  <option value="all">All Rules</option>
                  {rules.map(r => (
                    <option key={r.rule_code} value={r.rule_code}>{r.rule_code}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Filter Status</label>
                <select
                  value={execStatusFilter}
                  onChange={(e) => setExecStatusFilter(e.target.value)}
                  className="erp-input text-xs py-1.5 px-3 bg-slate-900 border-slate-700 rounded-lg text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="skipped">Skipped (Idempotent)</option>
                  <option value="retrying">Retrying</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => fetchExecutions(1)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center gap-1.5 self-end"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Apply Filters</span>
            </button>
          </div>

          {/* Execution Table */}
          <div className="erp-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">Exec ID</th>
                    <th className="px-5 py-3">Rule</th>
                    <th className="px-5 py-3">Trigger</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Start Time (Lagos)</th>
                    <th className="px-5 py-3">Affected</th>
                    <th className="px-5 py-3">Executor</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {executions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-slate-400 font-bold">#{exec.id}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-white block">{exec.rule_code}</span>
                        <span className="text-[11px] text-slate-400">{exec.rule_name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase">
                          {exec.trigger_type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {exec.status === 'completed' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold font-mono">
                            COMPLETED
                          </span>
                        )}
                        {exec.status === 'failed' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold font-mono">
                            FAILED
                          </span>
                        )}
                        {exec.status === 'skipped' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold font-mono">
                            SKIPPED
                          </span>
                        )}
                        {exec.status === 'retrying' && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 text-[10px] font-bold font-mono">
                            RETRYING
                          </span>
                        )}
                        {exec.status === 'running' && (
                          <span className="px-2 py-0.5 rounded-full bg-brand-950 text-brand-400 border border-brand-800 text-[10px] font-bold font-mono">
                            RUNNING
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">{exec.start_time}</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-200">{exec.affected_count}</td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {exec.executor_first ? `${exec.executor_first} ${exec.executor_last}` : 'System / Engine'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedExecution(exec)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {exec.status === 'failed' && (
                            <button
                              onClick={() => handleRetryExecution(exec.id)}
                              disabled={retryingExecId === exec.id}
                              className="p-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-all"
                              title={`Retry (${exec.retry_count}/${exec.max_retries})`}
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${retryingExecId === exec.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {executions.length === 0 && (
                    <tr>
                      <td colSpan="8" className="px-5 py-8 text-center text-slate-500">
                        No automation executions found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {execPagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-800/70 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing page {execPagination.page} of {execPagination.totalPages} ({execPagination.total} records)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={execPagination.page <= 1}
                    onClick={() => fetchExecutions(execPagination.page - 1)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={execPagination.page >= execPagination.totalPages}
                    onClick={() => fetchExecutions(execPagination.page + 1)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LIVE OPERATIONAL ALERTS FEED */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Aggregated anomalies and operational bottlenecks detected across Attendance, Tasks, Evaluations, Documents, and Automation.
            </p>
            <button
              onClick={fetchAlerts}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Feed</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="erp-card p-5 flex flex-col justify-between border-l-4 border-l-amber-500 hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                      {alert.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                      {alert.count} Pending
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1.5">{alert.title}</h4>
                  <p className="text-xs text-slate-400">{alert.message}</p>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-800/70 flex justify-end">
                  <Link
                    to={alert.link}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-400 hover:text-brand-300 transition-all"
                  >
                    <span>View in Module</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="erp-card p-12 text-center text-slate-500 col-span-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">All Systems Nominal</p>
                <p className="text-xs text-slate-500 mt-1">No active operational alerts or bottlenecks detected.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONFIGURE AUTOMATION RULE */}
      {/* ========================================================================= */}
      {selectedRuleForConfig && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-brand-400" />
                  <span>Configure Rule: {selectedRuleForConfig.rule_code}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedRuleForConfig.name}</p>
              </div>
              <button onClick={() => setSelectedRuleForConfig(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rule Name</label>
                <input
                  type="text"
                  value={configFormData.name}
                  onChange={(e) => setConfigFormData({ ...configFormData, name: e.target.value })}
                  className="erp-input w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={configFormData.description}
                  onChange={(e) => setConfigFormData({ ...configFormData, description: e.target.value })}
                  className="erp-input w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Execution Schedule Interval</label>
                <select
                  value={configFormData.schedule_interval}
                  onChange={(e) => setConfigFormData({ ...configFormData, schedule_interval: e.target.value })}
                  className="erp-input w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="realtime">Real-time / Event-driven</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">JSON Operational Parameters</label>
                <textarea
                  rows={6}
                  value={configFormData.configJson}
                  onChange={(e) => setConfigFormData({ ...configFormData, configJson: e.target.value })}
                  className="erp-input w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-[11px]"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRuleForConfig(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-600/20"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EXECUTION INSPECTOR */}
      {/* ========================================================================= */}
      {selectedExecution && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-400" />
                  <span>Execution Inspector: #{selectedExecution.id}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedExecution.rule_code}</p>
              </div>
              <button onClick={() => setSelectedExecution(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="font-bold text-emerald-400 font-mono">{selectedExecution.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Trigger Type</span>
                  <span className="font-semibold text-slate-200 capitalize">{selectedExecution.trigger_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Start Time</span>
                  <span className="font-mono text-slate-300">{selectedExecution.start_time}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Completion Time</span>
                  <span className="font-mono text-slate-300">{selectedExecution.completion_time || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Affected Count</span>
                  <span className="font-mono font-bold text-white">{selectedExecution.affected_count}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Retry Attempt</span>
                  <span className="font-mono text-slate-300">{selectedExecution.retry_count} / {selectedExecution.max_retries}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Idempotency Key (SHA-256)</span>
                <p className="p-2 rounded bg-slate-950 font-mono text-[10px] text-slate-300 break-all border border-slate-800">
                  {selectedExecution.idempotency_key}
                </p>
              </div>

              {selectedExecution.error_message && (
                <div>
                  <span className="text-rose-400 font-semibold block mb-1">Error Trace</span>
                  <p className="p-2 rounded bg-rose-950/50 text-rose-300 font-mono text-[11px] border border-rose-800">
                    {selectedExecution.error_message}
                  </p>
                </div>
              )}

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Execution Payload / Details</span>
                <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                  {JSON.stringify(selectedExecution.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedExecution(null)}
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

export default AutomationPage;
