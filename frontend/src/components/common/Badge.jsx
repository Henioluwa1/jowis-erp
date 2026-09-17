import React from 'react';

export const Badge = ({ status, text, size = 'md' }) => {
  const normalized = (status || text || '').toUpperCase();

  let styles = 'bg-slate-800 text-slate-300 border-slate-700';

  if (normalized === 'PRESENT' || normalized === 'ACTIVE' || normalized === 'COMPLETED' || normalized === 'GRADED') {
    styles = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
  } else if (normalized === 'LATE' || normalized === 'IN_PROGRESS' || normalized === 'SUBMITTED' || normalized === 'UNDER_REVIEW') {
    styles = 'bg-amber-950/80 text-amber-300 border-amber-800/60';
  } else if (normalized === 'ABSENT' || normalized === 'DROPPED' || normalized === 'SUSPENDED' || normalized === 'OVERDUE') {
    styles = 'bg-rose-950/80 text-rose-300 border-rose-800/60';
  } else if (normalized === 'EXCUSED' || normalized === 'UPCOMING') {
    styles = 'bg-sky-950/80 text-sky-300 border-sky-800/60';
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs font-semibold px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses} ${styles}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {text || status}
    </span>
  );
};
