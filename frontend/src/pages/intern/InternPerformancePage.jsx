import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import {
  Award,
  TrendingUp,
  CheckCircle2,
  MessageSquare,
  Calendar,
  Info,
  Clock,
  CheckSquare,
  Sparkles,
  AlertCircle,
  Download,
  Printer
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportUtil';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip
} from 'recharts';

export const InternPerformancePage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  const fetchPerformance = async (periodId = '') => {
    try {
      setLoading(true);
      const url = periodId ? `/performance/me?periodId=${periodId}` : '/performance/me';
      const res = await api.get(url);
      if (res.data.success) {
        setData(res.data.data);
        if (!periodId && res.data.data.latest?.period_id) {
          setSelectedPeriodId(res.data.data.latest.period_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch intern performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const handlePeriodChange = (periodId) => {
    setSelectedPeriodId(periodId);
    fetchPerformance(periodId);
  };

  if (loading && !data) {
    return (
      <div className="erp-card p-12 text-center text-slate-500 text-xs">
        Loading authoritative performance evaluations and skill radar...
      </div>
    );
  }

  const latest = data?.latest;
  const scores = data?.scores || [];
  const radarData = data?.radarData || [];
  const periods = data?.periods || [];
  const supportingContext = data?.supportingContext;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-brand-400" />
            <span>My Performance & Competency Radar</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative, multi-factor evaluations conducted by your designated mentors and program leads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg transition-all cursor-pointer"
            title="Print / Save PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={async () => {
              try {
                await downloadCSV('/reports/export/performance', `jowis-my-performance-${new Date().toISOString().split('T')[0]}.csv`, {
                  periodId: selectedPeriodId || undefined
                });
              } catch (err) {
                alert(err.message || 'Failed to export performance CSV');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          {/* Period Selector */}
          {periods.length > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={selectedPeriodId}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="erp-input py-1.5 px-3 text-xs bg-slate-900 border-slate-700"
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.overall_score}%)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {latest ? (
        <>
          {/* Main Grid: Score Overview + Radar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Overview Card */}
            <div className="erp-card p-6 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span>Cycle: {latest.period_name || latest.evaluation_period}</span>
                  <Badge status={latest.overall_rating} text={latest.overall_rating} />
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white">{latest.overall_score}%</span>
                  <span className="text-xs font-semibold text-emerald-400">Finalized Score</span>
                </div>

                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Server-calculated weighted composite across {scores.length} core technical and operational pillars.
                </p>
              </div>

              {/* Reviewer Feedback Box */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <MessageSquare className="w-4 h-4 text-brand-400" />
                  <span>Lead Evaluator Observations:</span>
                </div>
                <p className="text-xs text-slate-300 italic leading-relaxed">
                  &ldquo;{latest.reviewer_comments || latest.summary_feedback || 'Solid performance across core milestones.'}&rdquo;
                </p>
                <div className="text-[10px] text-slate-500 font-mono pt-1">
                  Evaluated by: {latest.reviewer_first} {latest.reviewer_last}
                </div>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="erp-card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Competency Radar (100% Normalized)</h3>
                  <p className="text-xs text-slate-400">Relative performance distribution across curriculum dimensions</p>
                </div>
                <Sparkles className="w-4 h-4 text-brand-400" />
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="category" stroke="#94a3b8" fontSize={10} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={9} />
                    <Radar name="Performance" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Strengths & Growth Areas Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="erp-card p-5 border-l-4 border-l-emerald-500">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Key Demonstrated Strengths</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {latest.strengths || 'Consistent technical performance and proactive collaboration with instructors.'}
              </p>
            </div>

            <div className="erp-card p-5 border-l-4 border-l-amber-500">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Targeted Growth & Improvement Areas</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {latest.areas_for_improvement || 'Continue advancing independent architectural problem solving and test coverage.'}
              </p>
            </div>
          </div>

          {/* Individual Criteria Breakdown */}
          <div className="erp-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Curriculum Criteria Score Breakdown</h3>
                <p className="text-xs text-slate-400">Detailed points and weighted contributions toward final grade</p>
              </div>
              <span className="text-xs font-mono font-bold text-brand-400">
                Composite: {latest.overall_score}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {scores.map(s => (
                <div key={s.criterion_id} className="p-3.5 bg-slate-900/70 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{s.criterion_name}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {s.category}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {s.score} <span className="text-xs text-slate-500 font-normal">/ {s.max_score} pts</span>
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-brand-300">
                      Weight: {s.weight}% (+{s.weighted_score}%)
                    </span>
                  </div>

                  {s.comments && (
                    <div className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800/80">
                      &ldquo;{s.comments}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Supporting Operational Context (Gate 13: Read-Only Background Reference) */}
          {supportingContext && (
            <div className="erp-card p-4 bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Info className="w-4 h-4 text-brand-400" />
                <span>Supporting Operational Context (Career Profile Reference)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400 pt-1">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Attendance Rate</span>
                  <span className="text-sm font-bold text-emerald-400">{supportingContext.attendance?.attendanceRate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Completed Tasks</span>
                  <span className="text-sm font-bold text-white">{supportingContext.tasks?.completed}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Completed Modules</span>
                  <span className="text-sm font-bold text-brand-300">{supportingContext.curriculum?.completedModules}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block">Evaluation Status</span>
                  <span className="text-sm font-bold text-emerald-300">Finalized & Locked</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800/60">
                Notice: Operational metrics are displayed for your comprehensive internship portfolio. Performance evaluations are independently scored by mentors based on technical and behavioral criteria.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="erp-card p-12 text-center text-slate-500 text-xs">
          <Award className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-400">No finalized performance evaluations found for your profile yet.</p>
          <p className="text-[11px] text-slate-500 mt-1">Once your lead mentors review and finalize your evaluation for the active cycle, your scores and skill radar will appear here.</p>
        </div>
      )}
    </div>
  );
};
