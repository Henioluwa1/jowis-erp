import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  Lock
} from 'lucide-react';

export const FirstLoginModal = () => {
  const { user, mustChangePassword, clearPasswordChangeRequirement, logout } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!mustChangePassword) {
    return null;
  }

  // Password Policy Checks
  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>_+\-=\\[\]]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword
  };

  const isFormValid =
    checks.length &&
    checks.upper &&
    checks.lower &&
    checks.number &&
    checks.special &&
    checks.match;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) {
      setErrorMsg('Please ensure all password security requirements are fulfilled.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/auth/change-password', {
        newPassword: newPassword.trim()
      });

      if (res.data?.success) {
        setSuccessMsg('Your permanent password has been set successfully! Initializing ERP workspace...');
        setTimeout(() => {
          clearPasswordChangeRequirement();
        }, 1200);
      }
    } catch (err) {
      console.error('Password change error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="erp-card max-w-lg w-full p-6 md:p-8 border-brand-500/30 shadow-2xl shadow-brand-500/10 animate-in zoom-in-95 duration-200">
        {/* Header Badge */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
            <KeyRound className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-brand-400">
              First-Login Security Onboarding
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Welcome to Jowis Studio ERP
            </h2>
          </div>
        </div>

        {/* Personalized Welcome Banner */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <p className="text-sm font-semibold text-white">
            Hello, {user?.firstName || 'Valued User'}!
          </p>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Your enterprise account has been created with temporary login credentials. For institutional security and identity protection, you are required to set your own private, permanent password before accessing system tools.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              New Permanent Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter strong password"
                className="w-full erp-input text-xs py-2.5 px-3 pr-10 font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password to confirm"
                className="w-full erp-input text-xs py-2.5 px-3 pr-10 font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Real-time Password Security Checklist */}
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Password Complexity Requirements:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`flex items-center gap-1.5 ${checks.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                {checks.length ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${checks.upper ? 'text-emerald-400' : 'text-slate-500'}`}>
                {checks.upper ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Uppercase letter (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${checks.lower ? 'text-emerald-400' : 'text-slate-500'}`}>
                {checks.lower ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Lowercase letter (a-z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${checks.number ? 'text-emerald-400' : 'text-slate-500'}`}>
                {checks.number ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Numeric digit (0-9)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${checks.special ? 'text-emerald-400' : 'text-slate-500'}`}>
                {checks.special ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Special symbol (!@#$...)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${checks.match ? 'text-emerald-400' : 'text-slate-500'}`}>
                {checks.match ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>Passwords match</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={logout}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isFormValid && !submitting
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{submitting ? 'Updating Credentials...' : 'Set Permanent Password & Continue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FirstLoginModal;
