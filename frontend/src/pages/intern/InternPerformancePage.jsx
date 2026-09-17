import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Award, TrendingUp, CheckCircle, MessageSquare } from 'lucide-react';
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

  useEffect(() => {
    const fetchPerf = async () => {
      try {
        const res = await api.get('/performance/me');
        if (res.data.success) setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPerf();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading performance evaluations...</div>;
  }

  const latest = data?.latest;
  const radarData = data?.radarData || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Award className="w-6 h-6 text-brand-400" />
          <span>My Performance Evaluation & Skill Radar</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Objective multi-category assessments conducted by your lead mentors and instructors.
        </p>
      </div>

      {latest ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score Overview Card */}
            <div className="erp-card p-6 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluation Period: {latest.evaluation_period}</span>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-white">{latest.overall_score}%</span>
                  <span className="text-xs font-semibold text-emerald-400">Overall Rating</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Calculated from 8 core organizational evaluation pillars.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <MessageSquare className="w-4 h-4 text-brand-400" />
                  <span>Lead Evaluator Feedback:</span>
                </div>
                <p className="text-xs text-slate-300 italic">"{latest.summary_feedback}"</p>
                <p className="text-[10px] text-slate-500 font-mono pt-1">
                  Evaluated by: {latest.evaluator_first} {latest.evaluator_last}
                </p>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="erp-card p-6 lg:col-span-2">
              <h3 className="text-sm font-bold text-white mb-1">Competency Radar (100% Scale)</h3>
              <p className="text-xs text-slate-400 mb-4">Multi-factor capability distribution</p>
              <div className="h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="category" stroke="#94a3b8" fontSize={11} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={9} />
                    <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Individual Category Breakdown */}
          <div className="erp-card p-6">
            <h3 className="text-sm font-bold text-white mb-4">Category Ratings (1 to 5 Scale)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Technical Skills</span>
                <span className="text-lg font-bold text-brand-300">{latest.technical_skills} / 5</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Task Completion</span>
                <span className="text-lg font-bold text-emerald-400">{latest.task_completion} / 5</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Problem Solving</span>
                <span className="text-lg font-bold text-cyan-400">{latest.problem_solving} / 5</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Communication</span>
                <span className="text-lg font-bold text-amber-400">{latest.communication} / 5</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Teamwork</span>
                <span className="text-lg font-bold text-white">{latest.teamwork} / 5</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Professionalism</span>
                <span className="text-lg font-bold text-indigo-400">{latest.professionalism} / 5</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Learning Progress</span>
                <span className="text-lg font-bold text-emerald-400">{latest.learning_progress} / 5</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase">Attendance Rating</span>
                <span className="text-lg font-bold text-amber-300">{latest.attendance_rating} / 5</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="erp-card p-12 text-center text-slate-500 text-xs">
          No formal evaluations have been published for your profile yet.
        </div>
      )}
    </div>
  );
};
