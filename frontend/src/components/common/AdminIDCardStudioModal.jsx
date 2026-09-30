import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Modal } from './Modal';
import { InstitutionalIDCard, DEFAULT_ID_CARD_CONFIGS } from './InstitutionalIDCard';
import {
  Palette,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Printer,
  Shield,
  Layers,
  ChevronRight,
  Info,
  Sliders,
  Eye
} from 'lucide-react';

const PRESET_THEMES = [
  {
    id: 'cyber_teal',
    name: 'Cyber Ocean Teal',
    accent: '#06b6d4',
    bgPreview: 'from-[#061824] via-[#0c2c3e] to-[#040e16]',
    config: {
      themePreset: 'cyber_teal',
      portalAccent: '#06b6d4',
      frontCardBg: 'bg-gradient-to-br from-[#061824] via-[#0c2c3e] to-[#040e16] border-2 border-cyan-400/90 shadow-2xl shadow-cyan-500/20 ring-2 ring-cyan-400/40 text-slate-100',
      topBanner: 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-700 text-white border-b-2 border-cyan-400/80 shadow-md',
      crestBadge: 'bg-white/20 text-white border-white/40',
      rolePillBg: 'bg-white text-teal-950 font-black shadow-md border border-white/90',
      statusIndicator: 'bg-cyan-400',
      photoRing: 'bg-gradient-to-tr from-cyan-400 via-teal-300 to-blue-600 shadow-lg shadow-cyan-500/30',
      fallbackAvatar: 'bg-cyan-100 text-cyan-950',
      idBadgeColor: 'bg-cyan-950 text-cyan-200 border-cyan-800 font-mono font-bold',
      footerBar: 'bg-teal-950/95 border-t border-cyan-500/40 text-slate-300',
      footerHighlight: 'text-cyan-300 font-bold',
      accessIconColor: 'text-cyan-400',
      backCardBg: 'bg-gradient-to-br from-[#061824] via-[#0c2c3e] to-[#040e16] border-2 border-cyan-400/90 shadow-2xl shadow-cyan-500/20 ring-2 ring-cyan-400/40 text-slate-100',
      magneticStripe: 'bg-slate-950 border-b border-cyan-500/40',
      magneticText: 'text-cyan-400',
      signatureBorder: 'border-cyan-400',
      barcodeColor: 'text-cyan-300',
      hotlineBox: 'bg-cyan-50 border-cyan-200 text-slate-800',
      hotlineWeb: 'text-cyan-700'
    }
  },
  {
    id: 'royal_blue',
    name: 'Royal Sapphire Navy',
    accent: '#3b82f6',
    bgPreview: 'from-[#09142b] via-[#102246] to-[#060e1e]',
    config: {
      themePreset: 'royal_blue',
      portalAccent: '#3b82f6',
      frontCardBg: 'bg-gradient-to-br from-[#09142b] via-[#102246] to-[#060e1e] border-2 border-blue-400/90 shadow-2xl shadow-blue-500/20 ring-2 ring-blue-400/40 text-slate-100',
      topBanner: 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-900 text-white border-b-2 border-blue-400/80 shadow-md',
      crestBadge: 'bg-white/20 text-white border-white/40',
      rolePillBg: 'bg-white text-blue-950 font-black shadow-md border border-white/90',
      statusIndicator: 'bg-blue-400',
      photoRing: 'bg-gradient-to-tr from-blue-400 via-cyan-300 to-indigo-600 shadow-lg shadow-blue-500/30',
      fallbackAvatar: 'bg-blue-100 text-blue-950',
      idBadgeColor: 'bg-blue-950 text-blue-200 border-blue-800 font-mono font-bold',
      footerBar: 'bg-blue-950/95 border-t border-blue-500/40 text-slate-300',
      footerHighlight: 'text-blue-300 font-bold',
      accessIconColor: 'text-blue-400',
      backCardBg: 'bg-gradient-to-br from-[#09142b] via-[#102246] to-[#060e1e] border-2 border-blue-400/90 shadow-2xl shadow-blue-500/20 ring-2 ring-blue-400/40 text-slate-100',
      magneticStripe: 'bg-slate-950 border-b border-blue-500/40',
      magneticText: 'text-blue-400',
      signatureBorder: 'border-blue-400',
      barcodeColor: 'text-blue-300',
      hotlineBox: 'bg-blue-50 border-blue-200 text-slate-800',
      hotlineWeb: 'text-blue-700'
    }
  },
  {
    id: 'imperial_gold',
    name: 'Imperial Obsidian & Gold',
    accent: '#f59e0b',
    bgPreview: 'from-[#0c0f1c] via-[#141d33] to-[#080b14]',
    config: {
      themePreset: 'imperial_gold',
      portalAccent: '#f59e0b',
      frontCardBg: 'bg-gradient-to-br from-[#0c0f1c] via-[#141d33] to-[#080b14] border-2 border-amber-400/90 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400/40 text-slate-100',
      topBanner: 'bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-950 text-white border-b-2 border-amber-400/80 shadow-md',
      crestBadge: 'bg-amber-400/25 text-amber-200 border-amber-300/50',
      rolePillBg: 'bg-white text-slate-950 font-black shadow-md border border-white/90',
      statusIndicator: 'bg-amber-400',
      photoRing: 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-indigo-500 shadow-lg shadow-amber-500/30',
      fallbackAvatar: 'bg-amber-100 text-amber-950',
      idBadgeColor: 'bg-slate-950 text-amber-300 border-amber-500/40 font-mono font-bold',
      footerBar: 'bg-slate-950/95 border-t border-amber-500/40 text-slate-400',
      footerHighlight: 'text-amber-300 font-bold',
      accessIconColor: 'text-amber-400',
      backCardBg: 'bg-gradient-to-br from-[#0c0f1c] via-[#141d33] to-[#080b14] border-2 border-amber-400/90 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400/40 text-slate-100',
      magneticStripe: 'bg-slate-950 border-b border-amber-500/40',
      magneticText: 'text-amber-400',
      signatureBorder: 'border-amber-400',
      barcodeColor: 'text-amber-300',
      hotlineBox: 'bg-amber-50 border-amber-200 text-slate-800',
      hotlineWeb: 'text-amber-700'
    }
  },
  {
    id: 'amethyst_purple',
    name: 'Amethyst & Royal Violet',
    accent: '#8b5cf6',
    bgPreview: 'from-[#130b2b] via-[#211149] to-[#0a0618]',
    config: {
      themePreset: 'amethyst_purple',
      portalAccent: '#8b5cf6',
      frontCardBg: 'bg-gradient-to-br from-[#130b2b] via-[#211149] to-[#0a0618] border-2 border-purple-400/90 shadow-2xl shadow-purple-500/20 ring-2 ring-purple-400/40 text-slate-100',
      topBanner: 'bg-gradient-to-r from-purple-600 via-violet-700 to-indigo-900 text-white border-b-2 border-purple-400/80 shadow-md',
      crestBadge: 'bg-white/20 text-white border-white/40',
      rolePillBg: 'bg-white text-purple-950 font-black shadow-md border border-white/90',
      statusIndicator: 'bg-purple-400',
      photoRing: 'bg-gradient-to-tr from-purple-400 via-pink-400 to-indigo-600 shadow-lg shadow-purple-500/30',
      fallbackAvatar: 'bg-purple-100 text-purple-950',
      idBadgeColor: 'bg-purple-950 text-purple-200 border-purple-800 font-mono font-bold',
      footerBar: 'bg-purple-950/95 border-t border-purple-500/40 text-slate-300',
      footerHighlight: 'text-purple-300 font-bold',
      accessIconColor: 'text-purple-400',
      backCardBg: 'bg-gradient-to-br from-[#130b2b] via-[#211149] to-[#0a0618] border-2 border-purple-400/90 shadow-2xl shadow-purple-500/20 ring-2 ring-purple-400/40 text-slate-100',
      magneticStripe: 'bg-slate-950 border-b border-purple-500/40',
      magneticText: 'text-purple-400',
      signatureBorder: 'border-purple-400',
      barcodeColor: 'text-purple-300',
      hotlineBox: 'bg-purple-50 border-purple-200 text-slate-800',
      hotlineWeb: 'text-purple-700'
    }
  },
  {
    id: 'emerald_matrix',
    name: 'Emerald Matrix Cyber',
    accent: '#10b981',
    bgPreview: 'from-[#041a12] via-[#092d20] to-[#02100a]',
    config: {
      themePreset: 'emerald_matrix',
      portalAccent: '#10b981',
      frontCardBg: 'bg-gradient-to-br from-[#041a12] via-[#092d20] to-[#02100a] border-2 border-emerald-400/90 shadow-2xl shadow-emerald-500/20 ring-2 ring-emerald-400/40 text-slate-100',
      topBanner: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white border-b-2 border-emerald-400/80 shadow-md',
      crestBadge: 'bg-white/20 text-white border-white/40',
      rolePillBg: 'bg-white text-emerald-950 font-black shadow-md border border-white/90',
      statusIndicator: 'bg-emerald-400',
      photoRing: 'bg-gradient-to-tr from-emerald-400 via-teal-300 to-lime-500 shadow-lg shadow-emerald-500/30',
      fallbackAvatar: 'bg-emerald-100 text-emerald-950',
      idBadgeColor: 'bg-emerald-950 text-emerald-200 border-emerald-800 font-mono font-bold',
      footerBar: 'bg-emerald-950/95 border-t border-emerald-500/40 text-slate-300',
      footerHighlight: 'text-emerald-300 font-bold',
      accessIconColor: 'text-emerald-400',
      backCardBg: 'bg-gradient-to-br from-[#041a12] via-[#092d20] to-[#02100a] border-2 border-emerald-400/90 shadow-2xl shadow-emerald-500/20 ring-2 ring-emerald-400/40 text-slate-100',
      magneticStripe: 'bg-slate-950 border-b border-emerald-500/40',
      magneticText: 'text-emerald-400',
      signatureBorder: 'border-emerald-400',
      barcodeColor: 'text-emerald-300',
      hotlineBox: 'bg-emerald-50 border-emerald-200 text-slate-800',
      hotlineWeb: 'text-emerald-700'
    }
  },
  {
    id: 'crimson_ruby',
    name: 'Crimson Velvet & Ruby',
    accent: '#f43f5e',
    bgPreview: 'from-[#20050e] via-[#370d1a] to-[#120207]',
    config: {
      themePreset: 'crimson_ruby',
      portalAccent: '#f43f5e',
      frontCardBg: 'bg-gradient-to-br from-[#20050e] via-[#370d1a] to-[#120207] border-2 border-rose-400/90 shadow-2xl shadow-rose-500/20 ring-2 ring-rose-400/40 text-slate-100',
      topBanner: 'bg-gradient-to-r from-rose-600 via-red-600 to-indigo-950 text-white border-b-2 border-rose-400/80 shadow-md',
      crestBadge: 'bg-white/20 text-white border-white/40',
      rolePillBg: 'bg-white text-rose-950 font-black shadow-md border border-white/90',
      statusIndicator: 'bg-rose-400',
      photoRing: 'bg-gradient-to-tr from-rose-400 via-pink-400 to-amber-500 shadow-lg shadow-rose-500/30',
      fallbackAvatar: 'bg-rose-100 text-rose-950',
      idBadgeColor: 'bg-rose-950 text-rose-200 border-rose-800 font-mono font-bold',
      footerBar: 'bg-rose-950/95 border-t border-rose-500/40 text-slate-300',
      footerHighlight: 'text-rose-300 font-bold',
      accessIconColor: 'text-rose-400',
      backCardBg: 'bg-gradient-to-br from-[#20050e] via-[#370d1a] to-[#120207] border-2 border-rose-400/90 shadow-2xl shadow-rose-500/20 ring-2 ring-rose-400/40 text-slate-100',
      magneticStripe: 'bg-slate-950 border-b border-rose-500/40',
      magneticText: 'text-rose-400',
      signatureBorder: 'border-rose-400',
      barcodeColor: 'text-rose-300',
      hotlineBox: 'bg-rose-50 border-rose-200 text-slate-800',
      hotlineWeb: 'text-rose-700'
    }
  }
];

export const AdminIDCardStudioContent = ({
  initialRole = 'intern',
  onConfigSaved,
  onClose,
  isEmbedded = false
}) => {
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [configs, setConfigs] = useState(DEFAULT_ID_CARD_CONFIGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // User search/preview list
  const [usersList, setUsersList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Active form values for the selected role
  const currentRoleConfig = configs[selectedRole] || DEFAULT_ID_CARD_CONFIGS[selectedRole] || {};

  useEffect(() => {
    loadCardConfigs();
    loadUsers();
  }, []);

  const loadCardConfigs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/system/id-card-config');
      if (res.data?.success && res.data?.data) {
        const saved = res.data.data;
        setConfigs({
          intern: { ...DEFAULT_ID_CARD_CONFIGS.intern, ...(saved.intern || {}) },
          mentor: { ...DEFAULT_ID_CARD_CONFIGS.mentor, ...(saved.mentor || {}) },
          admin: { ...DEFAULT_ID_CARD_CONFIGS.admin, ...(saved.admin || {}) },
          super_admin: { ...DEFAULT_ID_CARD_CONFIGS.super_admin, ...(saved.super_admin || {}) }
        });
      }
    } catch (err) {
      console.error('Failed to load ID card configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/interns?limit=50');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setUsersList(res.data.data);
        if (res.data.data.length > 0 && !selectedUser) {
          setSelectedUser(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load user list for card preview:', err);
    }
  };

  const handleFieldChange = (field, value) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedRole]: {
        ...(prev[selectedRole] || DEFAULT_ID_CARD_CONFIGS[selectedRole]),
        [field]: value
      }
    }));
  };

  const handleApplyPreset = (preset) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedRole]: {
        ...(prev[selectedRole] || DEFAULT_ID_CARD_CONFIGS[selectedRole]),
        ...preset.config
      }
    }));
  };

  const handleSaveConfigs = async () => {
    setSaving(true);
    setSaveSuccess('');
    setErrorMessage('');
    try {
      const res = await api.put('/system/id-card-config', { config: configs });
      if (res.data?.success) {
        setSaveSuccess('ID Card configurations saved successfully! All users will immediately see the updated design.');
        setTimeout(() => setSaveSuccess(''), 5000);
        if (onConfigSaved) onConfigSaved(configs);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to save ID card designs.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm(`Reset ${selectedRole.toUpperCase()} card design back to standard institutional defaults?`)) {
      setConfigs((prev) => ({
        ...prev,
        [selectedRole]: DEFAULT_ID_CARD_CONFIGS[selectedRole]
      }));
    }
  };

  // Mock sample fallback if no real user selected
  const activePreviewUser = selectedUser || {
    id: 1,
    first_name: 'David',
    last_name: 'Adeleke',
    role: selectedRole,
    role_name: selectedRole,
    intern_code: 'JOWIS-INT-2026-001',
    track_name: 'Frontend Engineering Track',
    cohort_name: 'Alpha Cohort 2026',
    start_date: '2026-01-15',
    expected_end_date: '2026-12-31'
  };

  return (
    <div className="space-y-6 text-xs text-slate-300">
      {/* Header Description & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-brand-400" />
              <span>Institutional Card Customizer & User Badge Printing</span>
            </h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Customize card styling, division titles, authorized signatories, and themes for all users. Changes take effect universally.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
              title="Reset current role card to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Role Defaults</span>
            </button>
            <button
              type="button"
              onClick={handleSaveConfigs}
              disabled={saving}
              className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Design for All Users'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Notifications */}
        {saveSuccess && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-800/80 text-rose-300 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Top Controls: Role Tabs & Real User Badge Switcher */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
          {/* Role Tabs */}
          <div className="lg:col-span-2 space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              1. Select Role Design to Customize:
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'intern', label: 'Intern Badge', color: 'bg-cyan-500' },
                { id: 'mentor', label: 'Mentor Badge', color: 'bg-purple-500' },
                { id: 'admin', label: 'Admin Badge', color: 'bg-blue-500' },
                { id: 'super_admin', label: 'Super Admin Badge', color: 'bg-amber-500' }
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    selectedRole === r.id
                      ? 'bg-slate-800 text-white border-2 border-brand-500 shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${r.color}`} />
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User selector for direct badge preview & printing */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              2. Test Real User & Print Badge:
            </label>
            <div className="relative">
              <select
                value={selectedUser?.id || ''}
                onChange={(e) => {
                  const match = usersList.find((u) => String(u.id) === String(e.target.value));
                  if (match) setSelectedUser(match);
                }}
                className="erp-input w-full text-xs"
              >
                <option value="">Default Sample Cardholder</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name} ({u.intern_code || `ID-${u.id}`})
                  </option>
                ))}
              </select>
            </div>
            {selectedUser && (
              <p className="text-[10px] text-brand-400 font-mono">
                Active User: {selectedUser.first_name} {selectedUser.last_name} • {selectedUser.intern_code}
              </p>
            )}
          </div>
        </div>

        {/* Studio Grid: Left Configuration Forms, Right Live Card Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form: Design Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {/* Color Presets */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Theme Color Presets
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Pick 1-Click Scheme</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_THEMES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                      currentRoleConfig.themePreset === p.id
                        ? 'border-brand-500 bg-brand-950/40 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: p.accent }} />
                    <span className="text-[11px] font-semibold truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Typography & Badge Metadata */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <span className="font-bold text-white text-xs block">Official Text & Clearances</span>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Badge Title</label>
                <input
                  type="text"
                  value={currentRoleConfig.title || ''}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="e.g. ENGINEERING INTERN"
                  className="erp-input w-full text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Division / Track Line</label>
                <input
                  type="text"
                  value={currentRoleConfig.division || ''}
                  onChange={(e) => handleFieldChange('division', e.target.value)}
                  placeholder="e.g. Technology & Product Engineering Track"
                  className="erp-input w-full text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Access Clearance Label (Footer)</label>
                <input
                  type="text"
                  value={currentRoleConfig.accessLabel || ''}
                  onChange={(e) => handleFieldChange('accessLabel', e.target.value)}
                  placeholder="e.g. FELLOW ACCESS AUTHORIZED"
                  className="erp-input w-full text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Microchip Label</label>
                <input
                  type="text"
                  value={currentRoleConfig.chipLabel || ''}
                  onChange={(e) => handleFieldChange('chipLabel', e.target.value)}
                  placeholder="e.g. CR80-INTERN-AES256"
                  className="erp-input w-full text-xs"
                />
              </div>
            </div>

            {/* Signatory & Security Reverse Info */}
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-3">
              <span className="font-bold text-white text-xs block">Signatory & Card Reverse</span>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Signatory Title</label>
                  <input
                    type="text"
                    value={currentRoleConfig.signatureTitle || ''}
                    onChange={(e) => handleFieldChange('signatureTitle', e.target.value)}
                    placeholder="Director of Internships"
                    className="erp-input w-full text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Signatory Name</label>
                  <input
                    type="text"
                    value={currentRoleConfig.signatureName || ''}
                    onChange={(e) => handleFieldChange('signatureName', e.target.value)}
                    placeholder="Dr. J. Owis"
                    className="erp-input w-full text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Return Address (Reverse)</label>
                <input
                  type="text"
                  value={currentRoleConfig.returnAddress || ''}
                  onChange={(e) => handleFieldChange('returnAddress', e.target.value)}
                  placeholder="Jowis Studio Hub, Lagos, Nigeria"
                  className="erp-input w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Hotline</label>
                  <input
                    type="text"
                    value={currentRoleConfig.supportHotline || ''}
                    onChange={(e) => handleFieldChange('supportHotline', e.target.value)}
                    placeholder="+234 (0) 800-JOWIS-ERP"
                    className="erp-input w-full text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Website</label>
                  <input
                    type="text"
                    value={currentRoleConfig.supportWeb || ''}
                    onChange={(e) => handleFieldChange('supportWeb', e.target.value)}
                    placeholder="https://erp.jowis.com"
                    className="erp-input w-full text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Terms / Disclaimer Text</label>
                <textarea
                  rows={2}
                  value={currentRoleConfig.disclaimerText || ''}
                  onChange={(e) => handleFieldChange('disclaimerText', e.target.value)}
                  placeholder="Cardholder property terms..."
                  className="erp-input w-full text-xs resize-none"
                />
              </div>
            </div>
          </div>

          {/* Right Preview: Live ID Card (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 p-4 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-2 text-white">
                <Eye className="w-4 h-4 text-brand-400" />
                <span>Live Card Preview ({selectedRole.toUpperCase()})</span>
              </span>
              <span className="text-[10px] text-brand-400 font-mono">
                Cardholder: {activePreviewUser.first_name} {activePreviewUser.last_name}
              </span>
            </div>

            {/* Render Live Card */}
            <div className="w-full overflow-hidden">
              <InstitutionalIDCard
                user={activePreviewUser}
                customConfig={currentRoleConfig}
                cardRole={selectedRole}
                side="stacked"
                showControls={true}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 flex-wrap gap-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-brand-400" />
            <span>
              All ID cards incorporate vector QR codes linked to the institutional public registry for instant phone camera verification.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Close Studio
            </button>
            <button
              type="button"
              onClick={handleSaveConfigs}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Applying Universal Settings...' : 'Save & Apply to All Users'}</span>
            </button>
          </div>
        </div>
      </div>
  );
};

export const AdminIDCardStudioModal = ({
  isOpen,
  onClose,
  initialRole = 'intern',
  onConfigSaved
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Admin Institutional ID Card Studio"
      maxWidth="max-w-6xl"
    >
      <AdminIDCardStudioContent
        initialRole={initialRole}
        onConfigSaved={onConfigSaved}
        onClose={onClose}
      />
    </Modal>
  );
};

export default AdminIDCardStudioModal;
