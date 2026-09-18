import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Award,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  Download,
  Search,
  ExternalLink,
  Lock,
  Building,
  Calendar,
  User,
  GraduationCap
} from 'lucide-react';

export const CertificateVerificationPage = () => {
  const { verificationCode } = useParams();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(verificationCode || '');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (verificationCode) {
      performVerification(verificationCode);
    }
  }, [verificationCode]);

  const performVerification = async (code) => {
    if (!code || !code.trim()) return;

    try {
      setLoading(true);
      setErrorMessage('');
      setVerificationResult(null);

      const cleanCode = code.trim().toUpperCase();
      const res = await axios.get(`/api/certificates/verify/${cleanCode}`);

      if (res.data?.success) {
        setVerificationResult(res.data);
      } else {
        setErrorMessage(res.data?.message || 'Verification lookup failed.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      if (err.response && err.response.status === 404) {
        setErrorMessage('Invalid certificate verification code. No matching credential found in the Jowis Studio registry.');
      } else {
        setErrorMessage(err.response?.data?.message || 'An error occurred while contacting the verification server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      navigate(`/verify/certificate/${inputCode.trim().toUpperCase()}`);
      performVerification(inputCode.trim());
    }
  };

  const handleDownloadPDF = () => {
    if (!verificationResult?.data?.verificationCode) return;
    const url = `/api/certificates/verify/${verificationResult.data.verificationCode}/download`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-amber-500/20 text-lg">
              J
            </div>
            <div>
              <span className="text-base font-bold tracking-wide text-white">JOWIS STUDIO</span>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                Official Credential Verification Registry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Cryptographically Secured Ledger</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        {/* Hero Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Institutional Credential Verification
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Verify Jowis Studio Credentials
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Validate the authenticity of certificates, completion credentials, and program honors issued by Jowis Studio Technology Training Center.
          </p>
        </div>

        {/* Verification Input Box */}
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto">
          <div className="relative flex items-center shadow-2xl">
            <Search className="w-5 h-5 text-slate-500 absolute left-4" />
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Enter Verification Code (e.g., JW-XXXXXXXXXXXX)..."
              className="w-full bg-slate-900 border-2 border-slate-800 focus:border-amber-500 rounded-xl pl-12 pr-32 py-3.5 text-sm text-white font-mono tracking-wider placeholder-slate-500 focus:outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !inputCode.trim()}
              className="absolute right-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg uppercase tracking-wider shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>

        {/* Loading Indicator */}
        {loading && (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium">Validating cryptographic verification code against institutional registry...</p>
          </div>
        )}

        {/* Error Notice */}
        {errorMessage && !loading && (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 max-w-xl mx-auto space-y-2 text-center shadow-lg">
            <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Verification Failed</h3>
            <p className="text-xs text-rose-300/90">{errorMessage}</p>
          </div>
        )}

        {/* Verification Result Display */}
        {verificationResult && !loading && (
          <div className="bg-slate-900/80 border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8 backdrop-blur-xl relative overflow-hidden">
            {/* Status Banner */}
            <div className="text-center space-y-2">
              {verificationResult.valid ? (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4" /> Authentic & Formally Verified
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Credential Verified Authentic
                  </h2>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    This document is an authentic institutional credential registered in the Jowis Studio central ledger.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider shadow-lg shadow-rose-500/10">
                    <AlertTriangle className="w-4 h-4" /> Credential Formally Revoked
                  </div>
                  <h2 className="text-2xl font-bold text-rose-300 tracking-tight">
                    Revoked Credential
                  </h2>
                  <p className="text-xs text-rose-400/90 max-w-md mx-auto">
                    {verificationResult.message}
                  </p>
                  {verificationResult.data?.revocationReason && (
                    <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/40 rounded-xl text-xs text-rose-300">
                      <span className="font-semibold">Institutional Reason:</span> {verificationResult.data.revocationReason}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Credential Data Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" /> Recipient Name
                </span>
                <p className="text-lg font-bold text-white">{verificationResult.data.recipientName}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" /> Credential Title
                </span>
                <p className="text-lg font-bold text-amber-300">{verificationResult.data.certificateTitle}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-amber-400" /> Program Track & Cohort
                </span>
                <p className="text-sm font-semibold text-slate-200">
                  {verificationResult.data.trackName} {verificationResult.data.cohortName ? `• ${verificationResult.data.cohortName}` : ''}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" /> Issue Date
                </span>
                <p className="text-sm font-semibold text-slate-200">{verificationResult.data.issueDate}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Certificate Number
                </span>
                <p className="font-mono font-bold text-slate-200">{verificationResult.data.certificateNumber}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Verification Code
                </span>
                <p className="font-mono font-bold text-amber-400">{verificationResult.data.verificationCode}</p>
              </div>
            </div>

            {/* Issuing Authority & Actions */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    {verificationResult.data.signatoryName || 'Executive Director'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {verificationResult.data.signatoryTitle || 'Lead Director, Jowis Studio'}
                  </p>
                </div>
              </div>

              {verificationResult.valid && (
                <button
                  onClick={handleDownloadPDF}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Download className="w-4 h-4" /> Download Official PDF
                </button>
              )}
            </div>

            {/* Privacy Compliance Footer */}
            <div className="text-center pt-4 border-t border-slate-800/60">
              <p className="text-[11px] text-slate-500">
                Privacy Protection Policy: Zero sensitive student records, personal email addresses, marks, or internal notes are disclosed in the public registry.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-6">
          © {new Date().getFullYear()} Jowis Studio — Technology Training & Internship Center. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
