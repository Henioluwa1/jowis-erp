import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, AlertCircle, Clock } from 'lucide-react';

export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const inactivityReason = searchParams.get('reason') === 'inactivity';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const res = await login(email, password);
    setIsSubmitting(false);

    if (res.success) {
      if (res.user.role === 'intern') {
        navigate('/intern/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-400 text-white font-bold text-2xl shadow-xl shadow-brand-500/25 mb-4 border border-white/10">
            J
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">JOWIS STUDIO</h2>
          <p className="text-sm text-slate-400 mt-1">Internship & Technology Training Center ERP</p>
        </div>

        {/* Login Card */}
        <div className="erp-card p-8 bg-slate-900/80 backdrop-blur-xl border-slate-800 shadow-2xl">
          <h3 className="text-lg font-semibold text-white mb-2">Portal Authentication</h3>
          <p className="text-xs text-slate-400 mb-6">Sign in to access your administrative or intern portal.</p>

          {inactivityReason && !error && (
            <div className="mb-5 p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 flex items-center gap-2.5 text-amber-300 text-xs animate-in fade-in">
              <Clock className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>You were automatically logged out due to 10 minutes of inactivity. Please sign in again.</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 flex items-center gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Official Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@jowis.com"
                  className="erp-input w-full pl-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="erp-input w-full pl-9 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Authenticate & Enter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
