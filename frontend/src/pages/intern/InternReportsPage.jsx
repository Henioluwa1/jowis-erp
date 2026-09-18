import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Info,
  RefreshCw,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

export const InternReportsPage = () => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [scorecard, setScorecard] = useState(null);

  const fetchScorecard = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get('/reports/me');
      if (res.data?.success) {
        setScorecard(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load scorecard:', err);
      setErrorMsg('Failed to load your personal career scorecard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScorecard();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-brand-400" />
            <span>My Career Scorecard & Performance Analytics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative progress record across attendance, training execution, and formal evaluations.
          </p>
        </div>

        <button
          onClick={fetchScorecard}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-all self-start cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Scorecard</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="erp-card p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-xs font-medium">Loading personal career scorecard...</p>
        </div>
      ) : scorecard ? (
        <div className="space-y-6">
          {/* Top 3 Domain KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Attendance Scorecard */}
            <div className="erp-card p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Attendance Register</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-3xl font-black text-emerald-400">
                  {scorecard.attendance?.attendanceRate || '0%'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Authoritative Rate</div>
              </div>
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recorded Days:</span>
                  <span className="font-bold text-white">{scorecard.attendance?.totalDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Late Days:</span>
                  <span className="font-bold text-amber-400">{scorecard.attendance?.lateDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Absent Days:</span>
                  <span className="font-bold text-rose-400">{scorecard.attendance?.absentDays}</span>
                </div>
              </div>
            </div>

            {/* Task Execution Scorecard */}
            <div className="erp-card p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Curriculum Tasks</span>
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-3xl font-black text-blue-400">
                  {scorecard.tasks?.totalAssigned > 0
                    ? `${Math.round((scorecard.tasks.completed / scorecard.tasks.totalAssigned) * 100)}%`
                    : '100%'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Curriculum Completion Rate</div>
              </div>
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Completed Tasks:</span>
                  <span className="font-bold text-emerald-400">{scorecard.tasks?.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">In Progress:</span>
                  <span className="font-bold text-blue-300">{scorecard.tasks?.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Overdue Tasks:</span>
                  <span className="font-bold text-rose-400">{scorecard.tasks?.overdue}</span>
                </div>
              </div>
            </div>

            {/* Formal Performance Scorecard */}
            <div className="erp-card p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Formal Performance</span>
                <Award className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-3xl font-black text-purple-400">
                  {scorecard.performance?.overallScore !== undefined
                    ? `${scorecard.performance.overallScore}%`
                    : 'Pending'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {scorecard.performance?.periodName || 'Formal Period Evaluation'}
                </div>
              </div>
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Rating Band:</span>
                  {scorecard.performance?.rating ? (
                    <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      {scorecard.performance.rating}
                    </span>
                  ) : (
                    <span className="text-slate-500">In Progress</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-400">
                    {scorecard.performance ? 'Finalized' : 'Awaiting Review'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Methodology & Integrity Notice */}
          <div className="erp-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-brand-400" />
              <span>Scorecard Methodology & Evaluation Standard</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your career scorecard is calculated directly from verified operational records. Attendance is evaluated with an authoritative 09:00:00 AM cutoff. Tasks are reviewed and graded against established curriculum criteria. Formal evaluations are conducted by assigned mentors and finalized under strict institutional standards.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
