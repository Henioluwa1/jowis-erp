import React from 'react';
import { FileSpreadsheet, Download, Clock, Users, Award, BookOpen } from 'lucide-react';

export const ReportsPage = () => {
  const reports = [
    {
      title: 'Official Attendance Register Report',
      description: 'Complete daily attendance records including timestamps, status, and calculated late minutes.',
      endpoint: '/api/reports/attendance/csv',
      icon: Clock,
      color: 'emerald'
    },
    {
      title: 'Intern Roster & Lifecycle Report',
      description: 'Active and completed intern directory with cohort, track, contact, and enrollment information.',
      endpoint: '/api/reports/interns/csv',
      icon: Users,
      color: 'brand'
    }
  ];

  const handleDownload = (endpoint) => {
    window.open(endpoint, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-brand-400" />
          <span>Organizational Reports & CSV Export</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Generate audit-ready datasets directly from the relational database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className="erp-card p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-brand-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">{r.title}</h3>
                </div>
                <p className="text-xs text-slate-400">{r.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">Format: UTF-8 CSV</span>
                <button
                  onClick={() => handleDownload(r.endpoint)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-brand-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Report</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
