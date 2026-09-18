import React from 'react';

export const Badge = ({ status, text, size = 'md' }) => {
  const normalized = (status || text || '').toUpperCase();

  let styles = 'bg-slate-800 text-slate-300 border-slate-700';

  if (['PRESENT', 'ACTIVE', 'COMPLETED', 'ACCEPTED', 'GRADED', 'FINALIZED', 'OUTSTANDING'].includes(normalized)) {
    styles = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
  } else if (['EXCEEDS_EXPECTATIONS', 'EXCEEDS EXPECTATIONS'].includes(normalized)) {
    styles = 'bg-brand-950/80 text-brand-300 border-brand-800/60';
  } else if (['RETURNED', 'REVISION_REQUESTED'].includes(normalized)) {
    styles = 'bg-orange-950/80 text-orange-300 border-orange-800/60';
  } else if (['LATE', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'REVIEWED', 'SCREENING', 'ONBOARDING', 'NEEDS_IMPROVEMENT', 'NEEDS IMPROVEMENT'].includes(normalized)) {
    styles = 'bg-amber-950/80 text-amber-300 border-amber-800/60';
  } else if (['ABSENT', 'DROPPED', 'SUSPENDED', 'OVERDUE', 'REJECTED', 'UNSATISFACTORY'].includes(normalized)) {
    styles = 'bg-rose-950/80 text-rose-300 border-rose-800/60';
  } else if (['EXCUSED', 'UPCOMING', 'APPLIED', 'NEW', 'ASSIGNED', 'MEETS_EXPECTATIONS', 'MEETS EXPECTATIONS'].includes(normalized)) {
    styles = 'bg-sky-950/80 text-sky-300 border-sky-800/60';
  } else if (['ALUMNI', 'ARCHIVED', 'CLOSED'].includes(normalized)) {
    styles = 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60';
  } else if (['DRAFT'].includes(normalized)) {
    styles = 'bg-slate-800 text-slate-400 border-slate-700';
  }

  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs font-semibold px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses} ${styles}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      <span className="capitalize">{text || status?.replace('_', ' ')}</span>
    </span>
  );
};
