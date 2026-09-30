import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  QrCode,
  Search,
  ExternalLink,
  Building,
  Calendar,
  User,
  CreditCard,
  Lock,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export const IdCardVerificationPage = () => {
  const { code } = useParams();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(code || '');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (code) {
      performVerification(code);
    }
  }, [code]);

  const performVerification = async (queryCode) => {
    if (!queryCode || !queryCode.trim()) return;

    try {
      setLoading(true);
      setErrorMessage('');
      setVerificationResult(null);

      const cleanCode = queryCode.trim();
      const res = await axios.get(`/api/system/verify-id/${encodeURIComponent(cleanCode)}`);

      if (res.data?.success && res.data?.verified) {
        setVerificationResult(res.data.data);
      } else {
        setErrorMessage(res.data?.message || 'Verification lookup failed.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      if (err.response && err.response.status === 404) {
        setErrorMessage('Invalid ID credential code. No matching member or intern identity record found in the official Jowis Studio registry.');
      } else {
        setErrorMessage(err.response?.data?.message || 'An error occurred while contacting the verification registry.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      navigate(`/verify/id/${encodeURIComponent(inputCode.trim())}`);
      performVerification(inputCode.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-brand-600/30">
              J
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-wider text-white">JOWIS STUDIO</h1>
              <p className="text-[10px] uppercase tracking-widest text-brand-400 font-bold">Institutional Registry</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-semibold"
            >
              <span>ERP Portal Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 py-10 w-full flex-1 flex flex-col justify-center">
        {/* Title & Search bar */}
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-950/80 border border-brand-800 text-brand-300 text-xs font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
            <span>Digital ID Card Verification Service</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Official Credential Verification
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Scan an official Jowis Studio ID card QR code or enter the institutional ID code below to verify personnel authenticity, assignment track, and active standing.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="pt-4 flex gap-2 max-w-md mx-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Enter ID Code (e.g. JOWIS-INT-2026-001)"
                className="erp-input w-full pl-9 text-xs h-11"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputCode.trim()}
              className="px-5 h-11 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs cursor-pointer transition-all shadow-md shadow-brand-600/30 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>

        {/* Verification Result Card */}
        {verificationResult && (
          <div className="bg-slate-900/80 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden animate-fadeIn max-w-2xl mx-auto w-full">
            {/* Ambient decorative glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Official Verification Header */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                      AUTHENTIC CREDENTIAL VERIFIED
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-black text-white">Official Institutional Record</h3>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">Registry ID</span>
                <span className="text-xs font-mono font-bold text-white bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  {verificationResult.institutionalId}
                </span>
              </div>
            </div>

            {/* Cardholder Profile Body */}
            <div className="py-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Photo Frame */}
              <div className="w-28 h-32 rounded-2xl overflow-hidden bg-slate-800 border-2 border-emerald-500/40 shadow-lg flex-shrink-0 flex items-center justify-center relative">
                {verificationResult.avatarUrl ? (
                  <img
                    src={verificationResult.avatarUrl}
                    alt={verificationResult.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-400">
                    <User className="w-10 h-10 text-slate-600 mb-1" />
                    <span className="text-[9px] font-mono font-bold uppercase">NO PHOTO</span>
                  </div>
                )}
              </div>

              {/* Identity Details */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Authorized Personnel
                  </span>
                  <h4 className="text-xl font-black text-white">{verificationResult.fullName}</h4>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-brand-500/20 text-brand-300 border border-brand-500/30">
                      {verificationResult.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {verificationResult.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Department / Track</span>
                    <strong className="text-white text-xs">{verificationResult.department}</strong>
                  </div>
                  {verificationResult.cohort && (
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">Assigned Cohort</span>
                      <strong className="text-white text-xs">{verificationResult.cohort}</strong>
                    </div>
                  )}
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Issue Date</span>
                    <strong className="text-slate-300 text-xs">{verificationResult.issuedAt}</strong>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Valid Through</span>
                    <strong className="text-emerald-400 text-xs">{verificationResult.expiresAt}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Footer Assurance */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-2">
              <span className="font-mono">Authority: {verificationResult.institution}</span>
              <span className="font-mono text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Cryptographically Verified
              </span>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="bg-rose-950/60 border border-rose-800/80 rounded-3xl p-6 text-center max-w-xl mx-auto space-y-3 animate-fadeIn">
            <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Credential Verification Failed</h4>
            <p className="text-xs text-rose-200">{errorMessage}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>© 2026 Jowis Studio — Enterprise Internship ERP. All institutional badges are protected by digital security seals.</p>
      </footer>
    </div>
  );
};

export default IdCardVerificationPage;
