import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ShieldCheck,
  FileCheck,
  Calendar,
  Layers,
  Copy,
  ExternalLink,
  Ban,
  Send,
  Users,
  CheckSquare,
  BarChart3
} from 'lucide-react';

export const CertificatesPage = () => {
  const { role } = useAuth();
  const isAdmin = role === 'super_admin' || role === 'admin';

  // Tabs: 'registry' | 'issuance' | 'types'
  const [activeTab, setActiveTab] = useState('registry');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tab 1: Registry State
  const [certificates, setCertificates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Revocation Modal State
  const [selectedCertToRevoke, setSelectedCertToRevoke] = useState(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Tab 2: Eligibility & Issuance Desk State
  const [interns, setInterns] = useState([]);
  const [selectedInternId, setSelectedInternId] = useState('');
  const [certTypes, setCertTypes] = useState([]);
  const [selectedCertTypeId, setSelectedCertTypeId] = useState('');
  const [eligibilityData, setEligibilityData] = useState(null);
  const [evaluatingEligibility, setEvaluatingEligibility] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [customSignatory, setCustomSignatory] = useState({
    name: 'Dr. John O. Williams',
    title: 'Executive Director, Jowis Studio'
  });

  // Clear notifications
  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  // Load initial data
  useEffect(() => {
    if (activeTab === 'registry') {
      fetchCertificates();
    } else if (activeTab === 'issuance') {
      fetchInternsAndTypes();
    } else if (activeTab === 'types') {
      fetchCertificateTypes();
    }
  }, [activeTab, statusFilter, pagination.page]);

  // When selected intern changes, run eligibility check
  useEffect(() => {
    if (selectedInternId) {
      evaluateEligibility(selectedInternId, selectedCertTypeId);
    } else {
      setEligibilityData(null);
    }
  }, [selectedInternId, selectedCertTypeId]);

  // 1. Fetch Certificates Registry
  const fetchCertificates = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/certificates', { params });
      if (res.data?.success) {
        setCertificates(res.data.data || []);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load certificates:', err);
      setErrorMsg('Failed to load certificates registry.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Certificate Types
  const fetchCertificateTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/certificates/types');
      if (res.data?.success) {
        setCertTypes(res.data.data || []);
        if (res.data.data.length > 0 && !selectedCertTypeId) {
          setSelectedCertTypeId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Types error:', err);
      setErrorMsg('Failed to load certificate types.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Interns & Types for Issuance Desk
  const fetchInternsAndTypes = async () => {
    try {
      setLoading(true);
      const [internsRes, typesRes] = await Promise.all([
        api.get('/interns', { params: { limit: 100 } }),
        api.get('/certificates/types')
      ]);

      if (internsRes.data?.success) {
        setInterns(internsRes.data.data || []);
      }
      if (typesRes.data?.success) {
        setCertTypes(typesRes.data.data || []);
        if (typesRes.data.data.length > 0 && !selectedCertTypeId) {
          setSelectedCertTypeId(typesRes.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Issuance desk load error:', err);
      setErrorMsg('Failed to load interns or certificate types.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Evaluate Server-Side Eligibility
  const evaluateEligibility = async (internId, typeId) => {
    try {
      setEvaluatingEligibility(true);
      const params = { internId };
      if (typeId) params.certificateTypeId = typeId;

      const res = await api.get('/certificates/eligibility', { params });
      if (res.data?.success) {
        setEligibilityData(res.data.data);
      }
    } catch (err) {
      console.error('Eligibility check error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to evaluate intern eligibility.');
    } finally {
      setEvaluatingEligibility(false);
    }
  };

  // 5. Issue Official Certificate
  const handleIssueCertificate = async () => {
    if (!selectedInternId || !eligibilityData) return;

    try {
      setIssuing(true);
      const payload = {
        intern_id: parseInt(selectedInternId, 10),
        certificate_type_id: selectedCertTypeId ? parseInt(selectedCertTypeId, 10) : undefined,
        signatory_name: customSignatory.name,
        signatory_title: customSignatory.title
      };

      const res = await api.post('/certificates/issue', payload);
      if (res.data?.success) {
        setSuccessMsg(`Official Certificate ${res.data.data.certificateNumber} issued successfully!`);
        // Re-evaluate eligibility
        evaluateEligibility(selectedInternId, selectedCertTypeId);
      }
    } catch (err) {
      console.error('Issue certificate error:', err);
      setErrorMsg(err.response?.data?.message || 'Certificate issuance failed.');
    } finally {
      setIssuing(false);
    }
  };

  // 6. Revoke Certificate
  const handleRevokeCertificate = async (e) => {
    e.preventDefault();
    if (!selectedCertToRevoke || !revocationReason.trim()) {
      setErrorMsg('Formal revocation reason is mandatory.');
      return;
    }

    try {
      setRevoking(true);
      const res = await api.patch(`/certificates/${selectedCertToRevoke.id}/revoke`, {
        revocationReason: revocationReason.trim()
      });

      if (res.data?.success) {
        setSuccessMsg(`Certificate ${selectedCertToRevoke.certificate_number} has been revoked.`);
        setSelectedCertToRevoke(null);
        setRevocationReason('');
        fetchCertificates();
      }
    } catch (err) {
      console.error('Revoke error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to revoke certificate.');
    } finally {
      setRevoking(false);
    }
  };

  // 7. Download Certificate PDF
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

  // Copy Public Verification URL
  const copyPublicVerificationLink = (vCode) => {
    const url = `${window.location.origin}/verify/certificate/${vCode}`;
    navigator.clipboard.writeText(url);
    setSuccessMsg(`Verification URL copied to clipboard: ${url}`);
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
            <h1 className="text-2xl font-bold text-white tracking-tight">Certificates & Institutional Credentials</h1>
            <p className="text-sm text-slate-400">
              Institutional eligibility engine, PDF-1.4 certificate generation, and cryptographic public registry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === 'registry') fetchCertificates();
              if (activeTab === 'issuance') fetchInternsAndTypes();
              if (activeTab === 'types') fetchCertificateTypes();
            }}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/60"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
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

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
            activeTab === 'registry'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Award className="w-4 h-4" /> Credential Registry
        </button>

        <button
          onClick={() => setActiveTab('issuance')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
            activeTab === 'issuance'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Eligibility & Issuance Desk
        </button>

        <button
          onClick={() => setActiveTab('types')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
            activeTab === 'types'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" /> Certificate Types & Signatories
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CREDENTIAL REGISTRY */}
      {/* ========================================================================= */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCertificates()}
                placeholder="Search cert #, code, recipient..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">All Statuses</option>
                <option value="issued">Issued (Active)</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>

            <div className="flex justify-end items-center">
              <span className="text-xs text-slate-400 font-medium">
                Showing {certificates.length} of {pagination.total} credentials
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Certificate Identifier</th>
                    <th className="px-5 py-3.5">Recipient</th>
                    <th className="px-5 py-3.5">Credential Type</th>
                    <th className="px-5 py-3.5">Issue Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-normal">
                  {loading && certificates.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Loading credential registry...</span>
                        </div>
                      </td>
                    </tr>
                  ) : certificates.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                        No certificates found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    certificates.map((cert) => (
                      <tr key={cert.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-mono font-bold text-amber-400">
                            {cert.certificate_number}
                          </div>
                          <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span>{cert.verification_code}</span>
                            <button
                              onClick={() => copyPublicVerificationLink(cert.verification_code)}
                              className="text-slate-500 hover:text-amber-400 transition-colors"
                              title="Copy Public Verification Link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {cert.intern_first} {cert.intern_last}
                          </div>
                          <div className="text-xs text-slate-500">{cert.track_name} • {cert.cohort_name}</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-200">{cert.certificate_title || 'Internship Completion Certificate'}</div>
                          <div className="text-[11px] text-slate-500">Signatory: {cert.signatory_name}</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-xs text-slate-300">
                            {cert.issue_date}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Completed: {cert.completion_date || cert.issue_date}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {cert.status === 'issued' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Active Credential
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <Ban className="w-3.5 h-3.5" /> Formally Revoked
                              </span>
                              {cert.revocation_reason && (
                                <p className="text-[11px] text-rose-400 mt-1 max-w-xs line-clamp-1" title={cert.revocation_reason}>
                                  Reason: {cert.revocation_reason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right space-x-2">
                          {/* Download PDF */}
                          <button
                            onClick={() => handleDownloadPDF(cert.id, cert.certificate_number)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Public View */}
                          <a
                            href={`/verify/certificate/${cert.verification_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors border border-slate-700"
                            title="Open Public Verification Portal"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          {/* Revoke Button (Admin only) */}
                          {isAdmin && cert.status === 'issued' && (
                            <button
                              onClick={() => {
                                setSelectedCertToRevoke(cert);
                                setRevocationReason('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-medium transition-all border border-rose-500/30"
                              title="Revoke Certificate"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
                <span>Page {pagination.page} of {pagination.pages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ELIGIBILITY & ISSUANCE DESK */}
      {/* ========================================================================= */}
      {activeTab === 'issuance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration & Selection */}
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" /> Candidate Selection
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Select Candidate *
              </label>
              <select
                value={selectedInternId}
                onChange={(e) => setSelectedInternId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Choose Candidate --</option>
                {interns.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.first_name} {i.last_name} ({i.intern_code}) — {i.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                Certificate Credential Type *
              </label>
              <select
                value={selectedCertTypeId}
                onChange={(e) => setSelectedCertTypeId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {certTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase">Signatory Credentials</h4>
              <div>
                <label className="block text-[11px] text-slate-500 uppercase">Signatory Name</label>
                <input
                  type="text"
                  value={customSignatory.name}
                  onChange={(e) => setCustomSignatory({ ...customSignatory, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 uppercase">Signatory Title</label>
                <input
                  type="text"
                  value={customSignatory.title}
                  onChange={(e) => setCustomSignatory({ ...customSignatory, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Right: Live Eligibility Assessment & Issuance Action */}
          <div className="lg:col-span-2 space-y-5">
            {!selectedInternId ? (
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-12 text-center text-slate-500">
                <Award className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h4 className="text-base font-medium text-slate-300">No Candidate Selected</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Select an intern from the left panel to trigger the 4-gate institutional eligibility engine.
                </p>
              </div>
            ) : evaluatingEligibility ? (
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-12 text-center text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                <span>Evaluating candidate against institutional standards...</span>
              </div>
            ) : eligibilityData ? (
              <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-6">
                {/* Result Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Eligibility Assessment: {eligibilityData.intern.name}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {eligibilityData.intern.trackName} • {eligibilityData.intern.cohortName} • Code: {eligibilityData.intern.internCode}
                    </div>
                  </div>

                  <div>
                    <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center gap-2 ${
                      eligibilityData.isEligible
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {eligibilityData.isEligible ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Eligible for Issuance
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4" /> Ineligible Candidate
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* 4 Criteria Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gate 1: Lifecycle */}
                  <div className={`p-4 rounded-xl border ${
                    eligibilityData.criteria.lifecycle.passed
                      ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-300'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">Gate 1: Program Lifecycle</span>
                      {eligibilityData.criteria.lifecycle.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white mt-2">
                      Status: <span className="capitalize">{eligibilityData.criteria.lifecycle.currentStatus}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Must be formally transitioned to "completed".
                    </p>
                  </div>

                  {/* Gate 2: Tasks */}
                  <div className={`p-4 rounded-xl border ${
                    eligibilityData.criteria.tasks.passed
                      ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-300'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">Gate 2: Curriculum Tasks</span>
                      {eligibilityData.criteria.tasks.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white mt-2">
                      {eligibilityData.criteria.tasks.completedTasks} of {eligibilityData.criteria.tasks.totalTasks} Completed ({eligibilityData.criteria.tasks.completionRate}%)
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pending tasks remaining: {eligibilityData.criteria.tasks.pendingTasks}
                    </p>
                  </div>

                  {/* Gate 3: Performance */}
                  <div className={`p-4 rounded-xl border ${
                    eligibilityData.criteria.performance.passed
                      ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-300'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">Gate 3: Evaluation Score</span>
                      {eligibilityData.criteria.performance.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white mt-2">
                      Average: {eligibilityData.criteria.performance.averageScore.toFixed(1)}% ({eligibilityData.criteria.performance.finalizedEvaluations} Finalized)
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Minimum required: {eligibilityData.criteria.performance.minScoreRequired.toFixed(1)}%
                    </p>
                  </div>

                  {/* Gate 4: Documents */}
                  <div className={`p-4 rounded-xl border ${
                    eligibilityData.criteria.documents.passed
                      ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-300'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">Gate 4: Required Documents</span>
                      {eligibilityData.criteria.documents.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-white mt-2">
                      {eligibilityData.criteria.documents.verifiedCount} of {eligibilityData.criteria.documents.requiredCount} Verified
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      All mandatory documents must be verified and unexpired.
                    </p>
                  </div>
                </div>

                {/* Roadblocks list if ineligible */}
                {!eligibilityData.isEligible && eligibilityData.reasons.length > 0 && (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">Outstanding Roadblocks</h4>
                    <ul className="space-y-1 text-xs text-rose-400 list-disc list-inside">
                      {eligibilityData.reasons.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Issuance Action Footer */}
                <div className="flex justify-end pt-4 border-t border-slate-800">
                  <button
                    onClick={handleIssueCertificate}
                    disabled={!eligibilityData.isEligible || issuing}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {issuing ? 'Generating Credential...' : 'Issue Official Certificate'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CERTIFICATE TYPES */}
      {/* ========================================================================= */}
      {activeTab === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {certTypes.map((ct) => (
            <div
              key={ct.id}
              className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 flex flex-col justify-between space-y-4 shadow-lg"
            >
              <div>
                <span className="px-2.5 py-1 rounded font-mono text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {ct.code}
                </span>
                <h3 className="text-lg font-bold text-white mt-3">{ct.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{ct.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Signatory:</span>
                  <span className="text-white font-medium">{ct.signatory_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Title:</span>
                  <span className="text-slate-300">{ct.signatory_title}</span>
                </div>
                <div className="flex justify-between">
                  <span>Layout Template:</span>
                  <span className="font-mono text-indigo-400 uppercase">{ct.template_layout || 'standard'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVOCATION MODAL */}
      {/* ========================================================================= */}
      {selectedCertToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleRevokeCertificate} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <Ban className="w-5 h-5" /> Revoke Official Certificate
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCertToRevoke(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="font-mono font-bold text-white">{selectedCertToRevoke.certificate_number}</div>
              <div className="text-slate-400">Recipient: {selectedCertToRevoke.intern_first} {selectedCertToRevoke.intern_last}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-rose-300 mb-1">
                Formal Revocation Reason (Mandatory) *
              </label>
              <textarea
                required
                rows="3"
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
                placeholder="State the institutional reason for revoking this certificate (e.g., fraudulent submission, academic disciplinary decision)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCertToRevoke(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={revoking}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                {revoking ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
