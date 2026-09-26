import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  ShieldCheck,
  Calendar,
  Layers,
  FileCheck,
  User,
  Users,
  GraduationCap
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportUtil';

export const DocumentsPage = () => {
  const { role } = useAuth();
  const isAdmin = role === 'super_admin' || role === 'admin';

  // Tabs: 'queue' | 'completeness' | 'types'
  const [activeTab, setActiveTab] = useState('queue');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tab 1: Verification Queue State
  const [documents, setDocuments] = useState([]);
  const [queueStatusFilter, setQueueStatusFilter] = useState('pending_verification');
  const [searchQuery, setSearchQuery] = useState('');
  const [queuePagination, setQueuePagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Verification / Rejection Modal State
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [verifyModalAction, setVerifyModalAction] = useState(null); // 'verify' | 'reject'
  const [rejectionReason, setRejectionReason] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [expiryDateInput, setExpiryDateInput] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Version History Modal State
  const [versionHistoryDoc, setVersionHistoryDoc] = useState(null);
  const [versionHistoryList, setVersionHistoryList] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Tab 2: Completeness Matrix State
  const [internsList, setInternsList] = useState([]);
  const [selectedInternCompleteness, setSelectedInternCompleteness] = useState(null);
  const [loadingCompleteness, setLoadingCompleteness] = useState(false);
  const [completenessSearch, setCompletenessSearch] = useState('');

  // Tab 3: Document Types Configurator State
  const [docTypes, setDocTypes] = useState([]);
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [newTypeForm, setNewTypeForm] = useState({
    name: '',
    code: '',
    description: '',
    category: 'identification',
    is_required: true,
    allowed_file_types: 'pdf,jpg,jpeg,png',
    max_file_size: 10485760
  });
  const [creatingType, setCreatingType] = useState(false);

  // Clear notifications after 5s
  useEffect(() => {
    if (successMsg || errorMsg) {
      const t = setTimeout(() => {
        setSuccessMsg('');
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg, errorMsg]);

  // Initial tab fetch
  useEffect(() => {
    if (activeTab === 'queue') {
      fetchDocuments();
    } else if (activeTab === 'completeness') {
      fetchInternsForCompleteness();
    } else if (activeTab === 'types') {
      fetchDocTypes();
    }
  }, [activeTab, queueStatusFilter, queuePagination.page]);

  // 1. Fetch Documents Queue
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = {
        page: queuePagination.page,
        limit: queuePagination.limit
      };
      if (queueStatusFilter) params.status = queueStatusFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/documents', { params });
      if (res.data?.success) {
        const records = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.records || []);
        setDocuments(records);
        const pagination = res.data.pagination || (res.data.data?.page ? {
          page: res.data.data.page,
          limit: res.data.data.limit,
          total: res.data.data.total,
          pages: Math.ceil((res.data.data.total || 0) / (res.data.data.limit || 15)) || 1
        } : null);
        if (pagination) {
          setQueuePagination(pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load document verification queue.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Document Types
  const fetchDocTypes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/documents/types');
      if (res.data?.success) {
        setDocTypes(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load document types:', err);
      setErrorMsg('Failed to load document types.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Interns for Completeness Matrix
  const fetchInternsForCompleteness = async () => {
    try {
      setLoading(true);
      const res = await api.get('/interns', { params: { limit: 50 } });
      if (res.data?.success) {
        setInternsList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load interns:', err);
      setErrorMsg('Failed to load interns for completeness matrix.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch completeness for specific intern
  const inspectInternCompleteness = async (internId) => {
    try {
      setLoadingCompleteness(true);
      const res = await api.get(`/documents/completeness/${internId}`);
      if (res.data?.success) {
        setSelectedInternCompleteness(res.data.data);
      }
    } catch (err) {
      console.error('Completeness error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to evaluate intern document completeness.');
    } finally {
      setLoadingCompleteness(false);
    }
  };

  // View Version History
  const inspectVersionHistory = async (doc) => {
    try {
      setSelectedDoc(doc);
      setVersionHistoryDoc(doc);
      setLoadingVersions(true);
      const res = await api.get(`/documents/${doc.id}/versions`);
      if (res.data?.success) {
        setVersionHistoryList(res.data.data || []);
      }
    } catch (err) {
      console.error('Versions error:', err);
      setErrorMsg('Failed to load version history for this document.');
    } finally {
      setLoadingVersions(false);
    }
  };

  // Execute Verify or Reject
  const handleVerifyOrReject = async (e) => {
    e.preventDefault();
    if (!selectedDoc || !verifyModalAction) return;

    if (verifyModalAction === 'reject' && !rejectionReason.trim()) {
      setErrorMsg('A rejection reason is mandatory when rejecting institutional documents.');
      return;
    }

    try {
      setSubmittingAction(true);
      const payload = {
        status: verifyModalAction === 'verify' ? 'verified' : 'rejected',
        notes: verificationNotes.trim() || undefined,
        rejectionReason: verifyModalAction === 'reject' ? rejectionReason.trim() : undefined,
        expiryDate: expiryDateInput || undefined
      };

      const res = await api.patch(`/documents/${selectedDoc.id}/verify`, payload);
      if (res.data?.success) {
        setSuccessMsg(`Document has been successfully ${verifyModalAction === 'verify' ? 'verified' : 'rejected'}.`);
        setVerifyModalAction(null);
        setSelectedDoc(null);
        setRejectionReason('');
        setVerificationNotes('');
        setExpiryDateInput('');
        fetchDocuments();
      }
    } catch (err) {
      console.error('Verify error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to update document verification status.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Secure Authenticated Download
  const handleDownloadDocument = async (docId, filename) => {
    try {
      const res = await api.get(`/documents/${docId}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      setErrorMsg('Failed to download document file. Verification of security permissions required.');
    }
  };

  // Create Document Type Handler
  const handleCreateDocumentType = async (e) => {
    e.preventDefault();
    if (!newTypeForm.name.trim() || !newTypeForm.code.trim()) {
      setErrorMsg('Type name and unique code are required.');
      return;
    }

    try {
      setCreatingType(true);
      const res = await api.post('/documents/types', {
        name: newTypeForm.name.trim(),
        code: newTypeForm.code.trim().toUpperCase(),
        description: newTypeForm.description.trim() || undefined,
        category: newTypeForm.category,
        is_required: newTypeForm.is_required,
        allowed_file_types: newTypeForm.allowed_file_types,
        max_file_size: parseInt(newTypeForm.max_file_size, 10)
      });

      if (res.data?.success) {
        setSuccessMsg(`Document type "${newTypeForm.name}" created successfully.`);
        setShowCreateTypeModal(false);
        setNewTypeForm({
          name: '',
          code: '',
          description: '',
          category: 'identification',
          is_required: true,
          allowed_file_types: 'pdf,jpg,jpeg,png',
          max_file_size: 10485760
        });
        fetchDocTypes();
      }
    } catch (err) {
      console.error('Create type error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to create document type.');
    } finally {
      setCreatingType(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired
          </span>
        );
      case 'pending_verification':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Institutional Documents & Verification</h1>
              <p className="text-sm text-slate-400">
                Audited document verification queue, multi-version compliance tracking, and completeness enforcement.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await downloadCSV('/reports/export/documents', `jowis-documents-registry-${new Date().toISOString().split('T')[0]}.csv`, {
                  status: queueStatusFilter !== 'all' ? queueStatusFilter : undefined,
                  search: searchQuery.trim() || undefined
                });
              } catch (err) {
                setErrorMsg(err.message || 'Failed to export documents CSV.');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Export Registry CSV</span>
          </button>
          {activeTab === 'types' && isAdmin && (
            <button
              onClick={() => setShowCreateTypeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Document Type
            </button>
          )}
          <button
            onClick={() => {
              if (activeTab === 'queue') fetchDocuments();
              if (activeTab === 'completeness') fetchInternsForCompleteness();
              if (activeTab === 'types') fetchDocTypes();
            }}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/60"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
            activeTab === 'queue'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" /> Verification Queue
        </button>

        <button
          onClick={() => setActiveTab('completeness')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
            activeTab === 'completeness'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Completeness Matrix
        </button>

        <button
          onClick={() => setActiveTab('types')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition-all ${
            activeTab === 'types'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" /> Document Types Configurator
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VERIFICATION QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchDocuments()}
                placeholder="Search intern, doc title, code..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={queueStatusFilter}
                onChange={(e) => setQueueStatusFilter(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="pending_verification">Pending Review Only</option>
                <option value="verified">Verified Documents</option>
                <option value="rejected">Rejected Documents</option>
                <option value="expired">Expired Documents</option>
              </select>
            </div>

            <div className="flex justify-end items-center">
              <span className="text-xs text-slate-400 font-medium">
                Showing {documents.length} of {queuePagination.total} documents
              </span>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Intern & Track</th>
                    <th className="px-5 py-3.5">Document Details</th>
                    <th className="px-5 py-3.5">Version</th>
                    <th className="px-5 py-3.5">Submitted</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-normal">
                  {loading && documents.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                          <span>Loading document queue...</span>
                        </div>
                      </td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                        No documents found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {doc.intern_first} {doc.intern_last}
                          </div>
                          <div className="text-xs text-indigo-400 font-mono">{doc.intern_code}</div>
                          <div className="text-[11px] text-slate-500">{doc.track_name} • {doc.cohort_name}</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-200">{doc.title}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] text-slate-500">{doc.type_code}</span>
                            {doc.is_required === 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                                Required
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{doc.original_filename}</div>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => inspectVersionHistory(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-xs font-mono font-medium text-indigo-300 hover:bg-slate-700 transition-colors border border-slate-700"
                            title="Inspect Version History"
                          >
                            <Layers className="w-3 h-3" /> v{doc.current_version || 1}
                          </button>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-xs text-slate-300">
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {new Date(doc.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {renderStatusBadge(doc.status)}
                          {doc.rejection_reason && (
                            <p className="text-[11px] text-rose-400 mt-1 line-clamp-1 max-w-xs" title={doc.rejection_reason}>
                              Reason: {doc.rejection_reason}
                            </p>
                          )}
                          {doc.expiry_date && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Exp: {doc.expiry_date}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right space-x-2">
                          {/* Download Button */}
                          <button
                            onClick={() => handleDownloadDocument(doc.id, doc.original_filename)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                            title="Download & Inspect"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Verify Action */}
                          {doc.status !== 'verified' && (
                            <button
                              onClick={() => {
                                setSelectedDoc(doc);
                                setVerifyModalAction('verify');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-medium transition-all border border-emerald-500/30"
                            >
                              Verify
                            </button>
                          )}

                          {/* Reject Action */}
                          {doc.status !== 'rejected' && (
                            <button
                              onClick={() => {
                                setSelectedDoc(doc);
                                setVerifyModalAction('reject');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-medium transition-all border border-rose-500/30"
                            >
                              Reject
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
            {queuePagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 bg-slate-950/60 border-t border-slate-800 text-xs text-slate-400">
                <span>Page {queuePagination.page} of {queuePagination.pages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={queuePagination.page <= 1}
                    onClick={() => setQueuePagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
                  >
                    Previous
                  </button>
                  <button
                    disabled={queuePagination.page >= queuePagination.pages}
                    onClick={() => setQueuePagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200"
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
      {/* TAB 2: COMPLETENESS MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'completeness' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Interns List Sidebar */}
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Intern Directory
            </h3>

            <input
              type="text"
              value={completenessSearch}
              onChange={(e) => setCompletenessSearch(e.target.value)}
              placeholder="Filter by name or code..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <div className="divide-y divide-slate-800 max-h-[550px] overflow-y-auto pr-1">
              {internsList
                .filter(i => {
                  const match = `${i.first_name} ${i.last_name} ${i.intern_code}`.toLowerCase();
                  return match.includes(completenessSearch.toLowerCase());
                })
                .map((intern) => (
                  <button
                    key={intern.id}
                    onClick={() => inspectInternCompleteness(intern.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
                      selectedInternCompleteness?.internId === intern.id
                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{intern.first_name} {intern.last_name}</div>
                      <div className="text-xs text-indigo-400 font-mono">{intern.intern_code}</div>
                      <div className="text-[11px] text-slate-500">{intern.track_name}</div>
                    </div>
                    <Eye className="w-4 h-4 text-slate-500" />
                  </button>
                ))}
            </div>
          </div>

          {/* Completeness Breakdown Area */}
          <div className="lg:col-span-2 space-y-4">
            {loadingCompleteness ? (
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-12 text-center text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                <span>Evaluating institutional document completeness...</span>
              </div>
            ) : !selectedInternCompleteness ? (
              <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-12 text-center text-slate-500">
                <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <h4 className="text-base font-medium text-slate-300">Select an Intern</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click on an intern from the left panel to inspect their required document compliance and checklist status.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-6">
                {/* Scorecard Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <h3 className="text-lg font-bold text-white">Compliance Checklist</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Required institutional records mandated before certificate issuance.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                      selectedInternCompleteness.isComplete
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {selectedInternCompleteness.isComplete ? '100% Fully Compliant' : 'Requirements Incomplete'}
                    </span>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs text-slate-400 uppercase font-medium">Required Documents</span>
                    <p className="text-2xl font-bold text-white mt-1">{selectedInternCompleteness.totalRequired}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                    <span className="text-xs text-emerald-400 uppercase font-medium">Verified Valid</span>
                    <p className="text-2xl font-bold text-emerald-300 mt-1">{selectedInternCompleteness.verifiedCount}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40">
                    <span className="text-xs text-blue-400 uppercase font-medium">Pending Review</span>
                    <p className="text-2xl font-bold text-blue-300 mt-1">{selectedInternCompleteness.pendingCount}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40">
                    <span className="text-xs text-rose-400 uppercase font-medium">Missing / Expired</span>
                    <p className="text-2xl font-bold text-rose-300 mt-1">
                      {selectedInternCompleteness.missingCount + selectedInternCompleteness.expiredCount}
                    </p>
                  </div>
                </div>

                {/* Checklist Items */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Institutional Checklist</h4>
                  <div className="space-y-2">
                    {selectedInternCompleteness.checklist?.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {item.verified ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          ) : item.status === 'expired' ? (
                            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                          ) : item.status === 'rejected' ? (
                            <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                          ) : (
                            <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
                          )}
                          <div>
                            <div className="text-sm font-semibold text-white">{item.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{item.code} • {item.category}</div>
                            {item.rejectionReason && (
                              <p className="text-xs text-rose-400 mt-1">Rejection note: {item.rejectionReason}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          {renderStatusBadge(item.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DOCUMENT TYPES CONFIGURATOR */}
      {/* ========================================================================= */}
      {activeTab === 'types' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {docTypes.map((type) => (
              <div
                key={type.id}
                className="bg-slate-900/60 rounded-xl border border-slate-800 p-5 space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {type.code}
                    </span>
                    {type.is_required === 1 ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Optional</span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-white mt-2">{type.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{type.description || 'No description provided.'}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="capitalize text-slate-200">{type.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Allowed formats:</span>
                    <span className="font-mono text-[11px] text-slate-300">{type.allowed_file_types}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Size:</span>
                    <span className="text-slate-300">{(type.max_file_size / (1024 * 1024)).toFixed(0)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Uploads:</span>
                    <span className="font-bold text-indigo-400">{type.total_documents || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VERIFY / REJECT ACTION MODAL */}
      {/* ========================================================================= */}
      {verifyModalAction && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {verifyModalAction === 'verify' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Verify Document
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400" /> Reject Document
                  </>
                )}
              </h3>
              <button
                onClick={() => setVerifyModalAction(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <div className="font-semibold text-white">{selectedDoc.title}</div>
                <div className="text-xs text-indigo-400 font-mono">{selectedDoc.intern_first} {selectedDoc.intern_last} ({selectedDoc.intern_code})</div>
                <div className="text-xs text-slate-400">File: {selectedDoc.original_filename}</div>
              </div>

              {verifyModalAction === 'reject' ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase text-rose-300">
                    Rejection Reason (Mandatory) *
                  </label>
                  <textarea
                    required
                    rows="3"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide clear instructions on why this document is rejected (e.g., blurry scan, expired card, incorrect page)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase text-slate-400">
                      Verification Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="e.g. Validated against official national database registry"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Expiry Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={expiryDateInput}
                      onChange={(e) => setExpiryDateInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVerifyModalAction(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOrReject}
                disabled={submittingAction}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all ${
                  verifyModalAction === 'verify'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20'
                } disabled:opacity-50`}
              >
                {submittingAction ? 'Processing...' : verifyModalAction === 'verify' ? 'Confirm Verification' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VERSION HISTORY MODAL */}
      {/* ========================================================================= */}
      {versionHistoryDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Version History</h3>
              </div>
              <button
                onClick={() => setVersionHistoryDoc(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Document: <span className="text-white font-semibold">{versionHistoryDoc.title}</span> ({versionHistoryDoc.original_filename})
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {loadingVersions ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Loading version logs...</span>
                </div>
              ) : versionHistoryList.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">No prior versions recorded.</div>
              ) : (
                versionHistoryList.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          v{ver.version_number}
                        </span>
                        <span className="text-slate-200 font-medium">{ver.original_filename}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Uploaded by {ver.uploader_first} {ver.uploader_last} on {new Date(ver.uploaded_at).toLocaleString()}
                      </div>
                      {ver.rejection_reason && (
                        <div className="text-[11px] text-rose-400 mt-1">Rejection: {ver.rejection_reason}</div>
                      )}
                    </div>
                    <div>
                      {renderStatusBadge(ver.status)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setVersionHistoryDoc(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE DOCUMENT TYPE MODAL */}
      {/* ========================================================================= */}
      {showCreateTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateDocumentType} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Create Document Type
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateTypeModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">Type Name *</label>
                <input
                  type="text"
                  required
                  value={newTypeForm.name}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, name: e.target.value })}
                  placeholder="e.g. Professional NDA Agreement"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">Unique Code *</label>
                <input
                  type="text"
                  required
                  value={newTypeForm.code}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, code: e.target.value })}
                  placeholder="e.g. NDA_AGREEMENT"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={newTypeForm.description}
                  onChange={(e) => setNewTypeForm({ ...newTypeForm, description: e.target.value })}
                  placeholder="Institutional context for this document type..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-400 mb-1">Category</label>
                  <select
                    value={newTypeForm.category}
                    onChange={(e) => setNewTypeForm({ ...newTypeForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="identification">Identification</option>
                    <option value="academic">Academic</option>
                    <option value="agreement">Agreement</option>
                    <option value="assessment">Assessment</option>
                    <option value="completion">Completion</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTypeForm.is_required}
                      onChange={(e) => setNewTypeForm({ ...newTypeForm, is_required: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-white">Mandatory Requirement</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateTypeModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingType}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                {creatingType ? 'Creating...' : 'Create Type'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
