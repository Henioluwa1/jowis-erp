import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Copy,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Ban
} from 'lucide-react';

export const InternCertificatesPage = () => {
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [myCertificates, setMyCertificates] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadCertificatesAndEligibility();
  }, []);

  // Clear messages
  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  const loadCertificatesAndEligibility = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const [eligRes, certsRes] = await Promise.all([
        api.get('/certificates/eligibility'),
        api.get('/certificates')
      ]);

      if (eligRes.data?.success) {
        setEligibility(eligRes.data.data);
      }
      if (certsRes.data?.success) {
        setMyCertificates(certsRes.data.data || []);
      }
    } catch (err) {
      console.error('Intern certificates load error:', err);
      setErrorMsg('Failed to load certificates and eligibility status.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (certId, certNumber) => {
    try {
      const res = await api.get(`/certificates/${certId}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certNumber || 'certificate'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      setErrorMsg('Failed to download certificate PDF.');
    }
  };

  const copyPublicVerificationLink = (vCode) => {
    const url = `${window.location.origin}/verify/certificate/${vCode}`;
    navigator.clipboard.writeText(url);
    setSuccessMsg(`Public Verification URL copied: ${url}`);
  };

  const handleAddToLinkedIn = (cert) => {
    const issueDateObj = new Date(cert.issue_date || Date.now());
    const issueYear = issueDateObj.getFullYear();
    const issueMonth = issueDateObj.getMonth() + 1;
    const certName = encodeURIComponent(cert.certificate_title || `${cert.track_name || 'Technology'} Internship Specialization`);
    const orgName = encodeURIComponent('Jowis Studio');
    const verifyUrl = encodeURIComponent(`${window.location.origin}/verify/certificate/${cert.verification_code}`);
    const certId = encodeURIComponent(cert.certificate_number);

    const linkedinUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${certName}&organizationName=${orgName}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${verifyUrl}&certId=${certId}`;
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Institutional Credentials & Graduation</h1>
            <p className="text-sm text-slate-400">
              Verified certifications, graduation eligibility tracking, and cryptographic registry.
            </p>
          </div>
        </div>

        <button
          onClick={loadCertificatesAndEligibility}
          className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/60 self-start md:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span className="text-sm">{successMsg}</span>
        </div>
      )}

      {/* Graduation Eligibility Status Card */}
      {eligibility && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Graduation Readiness</span>
              <h2 className="text-xl font-bold text-white mt-0.5">4-Gate Institutional Eligibility Engine</h2>
            </div>
            <div>
              <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center gap-2 ${
                eligibility.isEligible
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {eligibility.isEligible ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> 100% Eligible for Certificate Issuance
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" /> Curriculum In Progress
                  </>
                )}
              </span>
            </div>
          </div>

          {/* 4 Criteria Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gate 1 */}
            <div className={`p-4 rounded-xl border ${
              eligibility.criteria.lifecycle.passed
                ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">1. Lifecycle</span>
                {eligibility.criteria.lifecycle.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-white mt-2 capitalize">{eligibility.criteria.lifecycle.currentStatus}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Requires 'completed' status</p>
            </div>

            {/* Gate 2 */}
            <div className={`p-4 rounded-xl border ${
              eligibility.criteria.tasks.passed
                ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">2. Tasks Completion</span>
                {eligibility.criteria.tasks.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-white mt-2">
                {eligibility.criteria.tasks.completedTasks}/{eligibility.criteria.tasks.totalTasks} ({eligibility.criteria.tasks.completionRate}%)
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">100% curriculum completion</p>
            </div>

            {/* Gate 3 */}
            <div className={`p-4 rounded-xl border ${
              eligibility.criteria.performance.passed
                ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">3. Performance Score</span>
                {eligibility.criteria.performance.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-white mt-2">
                {eligibility.criteria.performance.averageScore > 0 ? `${eligibility.criteria.performance.averageScore.toFixed(1)}%` : 'Pending'}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Min 60% passing threshold</p>
            </div>

            {/* Gate 4 */}
            <div className={`p-4 rounded-xl border ${
              eligibility.criteria.documents.passed
                ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">4. Documents</span>
                {eligibility.criteria.documents.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-white mt-2">
                {eligibility.criteria.documents.verifiedCount} of {eligibility.criteria.documents.requiredCount} Verified
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">All mandatory files verified</p>
            </div>
          </div>

          {/* Outstanding items note */}
          {!eligibility.isEligible && eligibility.reasons.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Pending Requirements for Graduation</h4>
              <ul className="space-y-1 text-xs text-amber-300/90 list-disc list-inside">
                {eligibility.reasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* My Issued Certificates Gallery */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> Earned Institutional Credentials
        </h3>

        {myCertificates.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-500 space-y-2">
            <Award className="w-12 h-12 text-slate-700 mx-auto" />
            <h4 className="text-base font-medium text-slate-300">No Credentials Issued Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Once you fulfill all 4 institutional gates and complete your training, your official certificate will be generated and made available here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myCertificates.map((cert) => (
              <div
                key={cert.id}
                className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between space-y-6"
              >
                {/* Decorative Seal Background */}
                <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-amber-500/5 border border-amber-500/10 pointer-events-none flex items-center justify-center">
                  <Award className="w-24 h-24 text-amber-500/10" />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      {cert.certificate_number}
                    </span>
                    {cert.status === 'issued' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Official Issued
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        Revoked Credential
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500">
                      Jowis Studio Enterprise Credential
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {cert.certificate_title || 'Internship Completion Certificate'}
                    </h3>
                  </div>

                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Awarded to:</span>
                      <span className="font-bold text-white">{cert.intern_first} {cert.intern_last}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Curriculum Track:</span>
                      <span className="text-slate-200">{cert.track_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cohort:</span>
                      <span className="text-slate-200">{cert.cohort_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Issue Date:</span>
                      <span className="font-mono text-slate-300">{cert.issue_date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Verification Code:</span>
                      <span className="font-mono text-amber-400 font-bold">{cert.verification_code}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyPublicVerificationLink(cert.verification_code)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 cursor-pointer"
                      title="Copy verification link"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy Link
                    </button>

                    {cert.status === 'issued' && (
                      <button
                        onClick={() => handleAddToLinkedIn(cert)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A66C2]/15 hover:bg-[#0A66C2]/25 text-[#388be6] hover:text-[#70aefa] transition-colors border border-[#0A66C2]/40 cursor-pointer"
                        title="Add this certification directly to your LinkedIn Profile"
                      >
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.6 1.6 0 0 0-1.6 1.6 1.6 1.6 0 0 0 1.6 1.6 1.6 1.6 0 0 0 1.6-1.6 1.6 1.6 0 0 0-1.6-1.6Z" />
                        </svg>
                        Add to LinkedIn
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/verify/certificate/${cert.verification_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors border border-slate-700"
                      title="View Public Verification Registry"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {cert.status === 'revoked' ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-950/40 text-rose-400/80 border border-rose-800/50 cursor-not-allowed opacity-75 shadow-none"
                        title="This credential has been revoked and cannot be downloaded."
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-400" /> Download Disabled (Revoked)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadPDF(cert.id, cert.certificate_number)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" /> Download PDF
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
