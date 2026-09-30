import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Settings, Shield, Clock, Sliders, CheckCircle, Calendar, Save, AlertCircle, Palette } from 'lucide-react';
import { AdminIDCardStudioContent } from '../../components/common/AdminIDCardStudioModal';

export const SystemSettingsPage = () => {
  const [settings, setSettings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('settings');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Parse working days safely
  const [workingDays, setWorkingDays] = useState({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false
  });

  const fetchSettings = async () => {
    try {
      const res = await api.get('/system/settings');
      if (res.data.success) {
        setSettings(res.data.data);
        const wd = res.data.data.find(s => s.setting_key === 'working_days');
        if (wd) {
          try {
            const parsed = typeof wd.setting_value === 'string' ? JSON.parse(wd.setting_value) : wd.setting_value;
            setWorkingDays(parsed);
          } catch (e) {
            console.error('Error parsing working days', e);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.get('/system/audit-logs');
      if (res.data.success) setAuditLogs(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchAuditLogs();
  }, []);

  const handleUpdate = async (key, value) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.put(`/system/settings/${key}`, { value });
      if (res.data.success) {
        setSaveSuccess(`Setting "${key}" successfully saved.`);
        setTimeout(() => setSaveSuccess(''), 3000);
        fetchSettings();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || `Failed to update setting "${key}".`);
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkingDay = async (day) => {
    const updated = {
      ...workingDays,
      [day]: !workingDays[day]
    };
    setWorkingDays(updated);
    await handleUpdate('working_days', updated);
  };

  const daysList = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  const getSettingVal = (key, fallback = '') => {
    const s = settings.find(item => item.setting_key === key);
    return s ? s.setting_value : fallback;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-400" />
          <span>System Administration & Audit</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure authoritative operational parameters, working day schedule, attendance cutoffs, and view global audit logs.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 border-b-2 flex items-center gap-2 ${activeTab === 'settings' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Sliders className="w-4 h-4" />
          <span>Operational Rules & Working Schedule</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 flex items-center gap-2 ${activeTab === 'audit' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Shield className="w-4 h-4" />
          <span>Master Audit Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('id_cards')}
          className={`pb-3 border-b-2 flex items-center gap-2 ${activeTab === 'id_cards' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Palette className="w-4 h-4" />
          <span>Digital ID Card Customizer & Badges</span>
        </button>
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Working Days & Schedule Card */}
          <div className="erp-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-400" />
                <h3 className="text-sm font-bold text-white">Configured Working Days (Expected Attendance)</h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-950/80 border border-brand-800/60 text-brand-300">
                Lagos Working Schedule
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Only active working days are factored into the expected attendance denominator. Non-working days and company holidays are strictly excluded from absence counts.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 pt-2">
              {daysList.map(d => {
                const isActive = !!workingDays[d.key];
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleWorkingDay(d.key)}
                    className={`p-3 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                      isActive
                        ? 'bg-brand-600/20 border-brand-500/60 text-brand-300 shadow-sm shadow-brand-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{d.label.slice(0, 3)}</span>
                    <span className="text-[10px] uppercase font-mono tracking-wider">
                      {isActive ? 'Active' : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attendance Rules Card */}
          <div className="erp-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Attendance Timings & Cutoff Rules</h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300">
                Africa/Lagos (UTC+1)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-1">
                <label className="text-white font-semibold flex items-center justify-between">
                  <span>Punctuality Cutoff Time</span>
                  <span className="text-slate-400 font-mono text-[11px]">Strict Enforcement</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Check-ins before this exact server time are marked <span className="text-emerald-400 font-bold">PRESENT</span>. Check-ins at or after are marked <span className="text-amber-400 font-bold">LATE</span>.
                </p>
                <input
                  type="text"
                  defaultValue={getSettingVal('attendance_cutoff_time', '09:00:00')}
                  onBlur={(e) => handleUpdate('attendance_cutoff_time', e.target.value)}
                  className="erp-input font-mono text-sm py-2 px-3 mt-2"
                  placeholder="09:00:00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-white font-semibold flex items-center justify-between">
                  <span>Daily Closing / Auto-Absence Time</span>
                  <span className="text-slate-400 font-mono text-[11px]">Daily Register Close</span>
                </label>
                <p className="text-[11px] text-slate-400">
                  Cutoff hour after which unmarked interns may be transitioned to <span className="text-rose-400 font-bold">ABSENT</span>.
                </p>
                <input
                  type="text"
                  defaultValue={getSettingVal('attendance_closing_time', '17:00:00')}
                  onBlur={(e) => handleUpdate('attendance_closing_time', e.target.value)}
                  className="erp-input font-mono text-sm py-2 px-3 mt-2"
                  placeholder="17:00:00"
                />
              </div>
            </div>
          </div>

          {/* All Configured Parameters Table */}
          <div className="erp-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white mb-2">All Operational Parameters</h3>
            <div className="divide-y divide-slate-800 text-xs">
              {settings.map((s) => (
                <div key={s.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-semibold text-white block font-mono">{s.setting_key}</span>
                    <span className="text-slate-400 text-[11px]">{s.description || 'System setting'}</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      defaultValue={s.setting_value}
                      onBlur={(e) => {
                        if (e.target.value !== s.setting_value) {
                          handleUpdate(s.setting_key, e.target.value);
                        }
                      }}
                      className="erp-input text-xs font-mono py-1.5 px-3 w-full sm:w-64 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="erp-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Entity ID</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3 font-mono text-slate-400">{log.created_at}</td>
                  <td className="px-5 py-3 font-bold text-brand-300">{log.action}</td>
                  <td className="px-5 py-3 text-slate-300">{log.entity_type}</td>
                  <td className="px-5 py-3 font-mono text-slate-400">{log.entity_id || '—'}</td>
                  <td className="px-5 py-3 text-slate-300">
                    {log.first_name ? `${log.first_name} ${log.last_name}` : 'System / Auto'}
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-slate-500">
                    No audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'id_cards' && (
        <div className="erp-card p-6 bg-slate-900/90">
          <AdminIDCardStudioContent isEmbedded={true} />
        </div>
      )}
    </div>
  );
};
