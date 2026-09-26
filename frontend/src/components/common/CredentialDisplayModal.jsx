import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Key
} from 'lucide-react';

export const CredentialDisplayModal = ({ isOpen, onClose, credentials, title = 'User Account Provisioned Successfully' }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !credentials) return null;

  const {
    firstName = '',
    lastName = '',
    email = '',
    username = '',
    roleName = '',
    temporaryPassword = '',
    internCode = ''
  } = credentials;

  const fullName = `${firstName} ${lastName}`.trim();
  const loginIdentifier = email || username;

  const copyText = `Jowis Studio ERP — User Account Credentials
---------------------------------------------
Name: ${fullName}
Role: ${roleName.replace('_', ' ').toUpperCase()}
${internCode ? `Intern Code: ${internCode}\n` : ''}Login Username: ${loginIdentifier}
Temporary Password: ${temporaryPassword}

IMPORTANT: This is a secure temporary password. The user must set their permanent password upon their first login.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="erp-card max-w-md w-full p-6 border-emerald-500/40 shadow-2xl shadow-emerald-500/10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">One-time initial credential issuance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-3.5 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Full Name:</span>
              <span className="text-white font-semibold">{fullName || 'Institutional Staff'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Assigned Role:</span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {roleName.replace('_', ' ')}
              </span>
            </div>

            {internCode && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Intern Code:</span>
                <span className="text-brand-400 font-mono font-bold">{internCode}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Login Identifier:</span>
              <span className="text-white font-mono font-bold">{loginIdentifier}</span>
            </div>
          </div>

          {/* Temporary Password Highlight Box */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase tracking-wider">
              <Key className="w-3.5 h-3.5" />
              <span>Generated Temporary Password</span>
            </div>
            <div className="flex items-center justify-between bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <code className="text-sm font-mono font-bold text-amber-300 tracking-wider select-all">
                {temporaryPassword}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy temporary password"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Security Alert Notice */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 block font-semibold">Important Security Notice:</strong>
              This temporary password is only displayed right now. The user will be automatically prompted to set their private password upon first login.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Credentials Copied!' : 'Copy Full Credentials'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialDisplayModal;
