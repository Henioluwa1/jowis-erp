import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Layers,
  FileUp,
  AlertCircle
} from 'lucide-react';

export const InternDocumentsPage = () => {
  const [loading, setLoading] = useState(true);
  const [completenessData, setCompletenessData] = useState(null);
  const [myDocuments, setMyDocuments] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTypeId, setUploadTypeId] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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

  useEffect(() => {
    loadAllInternDocumentData();
  }, []);

  const loadAllInternDocumentData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const [compRes, docsRes, typesRes] = await Promise.all([
        api.get('/documents/completeness'),
        api.get('/documents'),
        api.get('/documents/types')
      ]);

      if (compRes.data?.success) {
        setCompletenessData(compRes.data.data);
      }
      if (docsRes.data?.success) {
        setMyDocuments(docsRes.data.data || []);
      }
      if (typesRes.data?.success) {
        setDocTypes(typesRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load documents data:', err);
      setErrorMsg('Failed to load your institutional document portal.');
    } finally {
      setLoading(false);
    }
  };

  // Open upload modal with pre-selected type
  const openUploadForType = (typeId, defaultName) => {
    setUploadTypeId(typeId);
    setUploadTitle(defaultName || '');
    setSelectedFile(null);
    setUploadNotes('');
    setShowUploadModal(true);
  };

  // Submit Document Upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadTypeId) {
      setErrorMsg('Please select a document type.');
      return;
    }
    if (!selectedFile) {
      setErrorMsg('Please select a file to upload.');
      return;
    }

    // Client-side size validation (max 20MB)
    if (selectedFile.size > 20 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 20MB institutional limit.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('document_type_id', uploadTypeId);
      if (uploadTitle.trim()) {
        formData.append('title', uploadTitle.trim());
      }
      if (uploadNotes.trim()) {
        formData.append('notes', uploadNotes.trim());
      }

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Document uploaded successfully! Pending verification.');
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadTitle('');
        setUploadNotes('');
        loadAllInternDocumentData();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  // Authenticated Download
  const handleDownload = async (docId, filename) => {
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
      setErrorMsg('Failed to download document.');
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Expired
          </span>
        );
      case 'pending_verification':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Under Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Institutional Documents</h1>
            <p className="text-sm text-slate-400">
              Submit mandated identity and compliance documentation required for institutional certification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setUploadTypeId('');
              setUploadTitle('');
              setSelectedFile(null);
              setUploadNotes('');
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
          <button
            onClick={loadAllInternDocumentData}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700/60"
            title="Refresh"
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

      {/* Compliance Overview Card */}
      {completenessData && (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Institutional Status</span>
              <h2 className="text-xl font-bold text-white mt-0.5">Mandatory Compliance Scorecard</h2>
            </div>
            <div>
              <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center gap-2 ${
                completenessData.isComplete
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {completenessData.isComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> 100% Fully Verified & Compliant
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" /> Action Required: Missing Mandated Documents
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-medium">Mandatory Types</span>
              <p className="text-2xl font-bold text-white mt-1">{completenessData.totalRequired}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
              <span className="text-xs text-emerald-400 uppercase font-medium">Verified Valid</span>
              <p className="text-2xl font-bold text-emerald-300 mt-1">{completenessData.verifiedCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40">
              <span className="text-xs text-blue-400 uppercase font-medium">Under Review</span>
              <p className="text-2xl font-bold text-blue-300 mt-1">{completenessData.pendingCount}</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40">
              <span className="text-xs text-rose-400 uppercase font-medium">Missing / Rejected</span>
              <p className="text-2xl font-bold text-rose-300 mt-1">
                {completenessData.missingCount + completenessData.rejectedCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Required Documents Checklist */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" /> Mandatory Institutional Checklist
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {completenessData?.checklist?.map((item) => (
            <div
              key={item.documentTypeId}
              className={`p-5 rounded-xl border transition-all flex flex-col justify-between space-y-4 shadow-lg ${
                item.verified
                  ? 'bg-slate-900/60 border-emerald-500/30 hover:border-emerald-500/50'
                  : item.status === 'rejected'
                  ? 'bg-slate-900/60 border-rose-500/40 hover:border-rose-500/60'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {item.code}
                  </span>
                  {renderStatusBadge(item.status)}
                </div>

                <h4 className="text-base font-bold text-white mt-2.5">{item.name}</h4>
                <p className="text-xs text-slate-400 mt-1 capitalize">Category: {item.category}</p>

                {item.rejectionReason && (
                  <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                    <div>
                      <span className="font-semibold">Reviewer Note:</span> {item.rejectionReason}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  {item.verified ? 'Verified on file' : 'Action required'}
                </span>
                <button
                  onClick={() => openUploadForType(item.documentTypeId, item.name)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-all border border-indigo-500/30"
                >
                  {item.status === 'missing' ? 'Upload Copy' : 'Re-upload Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uploaded Documents Table */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" /> My Document Submissions
        </h3>

        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Document Title</th>
                  <th className="px-5 py-3.5">Type & Category</th>
                  <th className="px-5 py-3.5">Version</th>
                  <th className="px-5 py-3.5">Uploaded</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-normal">
                {myDocuments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-10 text-center text-slate-500 text-xs">
                      No documents uploaded yet. Click "Upload Document" to begin.
                    </td>
                  </tr>
                ) : (
                  myDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{doc.title}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{doc.original_filename}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-xs text-slate-300">{doc.type_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{doc.type_code}</div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                          v{doc.current_version || 1}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-400">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4">
                        {renderStatusBadge(doc.status)}
                        {doc.rejection_reason && (
                          <p className="text-[11px] text-rose-400 mt-1 line-clamp-1 max-w-xs" title={doc.rejection_reason}>
                            Note: {doc.rejection_reason}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleDownload(doc.id, doc.original_filename)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
                          title="Download Copy"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* UPLOAD DOCUMENT MODAL */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleUploadSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileUp className="w-5 h-5 text-indigo-400" /> Upload Institutional Document
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">
                  Document Type *
                </label>
                <select
                  required
                  value={uploadTypeId}
                  onChange={(e) => setUploadTypeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Select Required Type --</option>
                  {docTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} ({dt.code}) {dt.is_required ? '• Required' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. David Adeleke Passport Scan"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">
                  Select File (PDF, JPG, PNG - Max 20MB) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-[11px] text-indigo-400 mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-400 mb-1">
                  Submission Notes (Optional)
                </label>
                <textarea
                  rows="2"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Any additional context for the verifying reviewer..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Submit Document'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
