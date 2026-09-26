import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  Award,
  PlusCircle,
  CheckCircle2,
  BarChart3,
  Calendar,
  Sliders,
  Users,
  Search,
  Filter,
  Eye,
  Edit3,
  RotateCcw,
  Lock,
  Unlock,
  AlertTriangle,
  FileText,
  TrendingUp,
  Clock,
  Sparkles,
  Info,
  Check,
  Send,
  Trash2,
  FileDown
} from 'lucide-react';
import { downloadCSV } from '../../utils/exportUtil';

export const PerformancePage = () => {
  const { role } = useAuth();
  const isMentor = role === 'mentor';
  const isAdmin = role === 'super_admin' || role === 'admin';

  // Navigation Tabs: 'overview' | 'evaluations' | 'periods' | 'criteria' | 'bands'
  const [activeTab, setActiveTab] = useState(isMentor ? 'evaluations' : 'overview');

  // Loading & Global State
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Overview Data
  const [overviewData, setOverviewData] = useState(null);

  // Evaluations Desk Data & Filters
  const [evaluations, setEvaluations] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [interns, setInterns] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [weightSummary, setWeightSummary] = useState({ totalActiveWeight: 100, isBalanced: true });
  const [ratingBands, setRatingBands] = useState([]);

  // Filters State
  const [filterPeriod, setFilterPeriod] = useState('ALL');
  const [filterTrack, setFilterTrack] = useState('ALL');
  const [filterCohort, setFilterCohort] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [amendModalOpen, setAmendModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [criterionModalOpen, setCriterionModalOpen] = useState(false);

  // Selected Evaluation for Scoring / Details
  const [selectedEval, setSelectedEval] = useState(null);
  const [evalDetailData, setEvalDetailData] = useState(null);

  // Assign Form
  const [assignForm, setAssignForm] = useState({
    targetType: 'intern', // 'intern' | 'cohort'
    internId: '',
    cohortId: '',
    periodId: ''
  });

  // Scoring Form
  const [scoringForm, setScoringForm] = useState({
    scores: {}, // { [criterionId]: { score: number, comments: string } }
    strengths: '',
    areasForImprovement: '',
    reviewerComments: ''
  });
  const [savingScore, setSavingScore] = useState(false);

  // Amendment Form
  const [amendReason, setAmendReason] = useState('');

  // Period Form
  const [periodForm, setPeriodForm] = useState({
    id: null,
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'draft'
  });

  // Criterion Form
  const [criterionForm, setCriterionForm] = useState({
    id: null,
    name: '',
    description: '',
    category: 'technical',
    weight: 20,
    maxScore: 100,
    status: 'active'
  });

  // Fetch Master Data
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const promises = [
        api.get('/performance/overview'),
        api.get('/performance/evaluations'),
        api.get('/performance/periods'),
        api.get('/performance/criteria'),
        api.get('/performance/rating-bands'),
        api.get('/training/tracks'),
        api.get('/training/cohorts')
      ];

      if (isAdmin) {
        promises.push(api.get('/interns?limit=200'));
      }

      const results = await Promise.all(promises);

      if (results[0].data.success) setOverviewData(results[0].data.data);
      if (results[1].data.success) setEvaluations(results[1].data.data);
      if (results[2].data.success) setPeriods(results[2].data.data);
      if (results[3].data.success) {
        setCriteria(results[3].data.data.criteria);
        setWeightSummary({
          totalActiveWeight: results[3].data.data.totalActiveWeight,
          isBalanced: results[3].data.data.isBalanced
        });
      }
      if (results[4].data.success) setRatingBands(results[4].data.data);
      if (results[5].data.success) setTracks(results[5].data.data);
      if (results[6].data.success) setCohorts(results[6].data.data);
      if (isAdmin && results[7]?.data.success) setInterns(results[7].data.data);

    } catch (err) {
      console.error('Performance fetch error:', err);
      setErrorMsg('Failed to load performance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Live Evaluation Scoring Modal
  const openScoringModal = async (ev) => {
    setSelectedEval(ev);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await api.get(`/performance/evaluations/${ev.id}`);
      if (res.data.success) {
        const detail = res.data.data;
        setEvalDetailData(detail);

        // Pre-populate scores map
        const scoreMap = {};
        detail.scores.forEach(s => {
          scoreMap[s.criterion_id] = {
            score: s.score || 0,
            maxScore: s.max_score,
            weight: s.weight,
            comments: s.comments || ''
          };
        });

        setScoringForm({
          scores: scoreMap,
          strengths: detail.evaluation.strengths || '',
          areasForImprovement: detail.evaluation.areas_for_improvement || '',
          reviewerComments: detail.evaluation.reviewer_comments || ''
        });

        setScoreModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to open scoring workspace:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to open scoring workspace.');
    }
  };

  // Open Read-Only Details Modal
  const openDetailsModal = async (ev) => {
    setSelectedEval(ev);
    try {
      const res = await api.get(`/performance/evaluations/${ev.id}`);
      if (res.data.success) {
        setEvalDetailData(res.data.data);
        setDetailsModalOpen(true);
      }
    } catch (err) {
      setErrorMsg('Failed to load evaluation details.');
    }
  };

  // Open Reopen / Amend Modal
  const openAmendModal = (ev) => {
    setSelectedEval(ev);
    setAmendReason('');
    setAmendModalOpen(true);
  };

  // Live Calculated Total Score inside Scoring Modal
  const calculateLiveScore = () => {
    if (!evalDetailData?.scores) return 0;
    let sum = 0;
    evalDetailData.scores.forEach(s => {
      const item = scoringForm.scores[s.criterion_id];
      if (item) {
        const scoreVal = parseFloat(item.score || 0);
        const maxScoreVal = parseFloat(s.max_score || 100);
        const weightVal = parseFloat(s.weight || 0);
        sum += (scoreVal / maxScoreVal) * weightVal;
      }
    });
    return Math.round(sum * 100) / 100;
  };

  // Resolve rating band name from calculated score
  const resolveLiveRating = (score) => {
    for (const b of ratingBands) {
      if (score >= b.min_score && score <= b.max_score + 0.01) {
        return b.name;
      }
    }
    return 'Meets Expectations';
  };

  // Save Draft Evaluation
  const handleSaveEvaluationDraft = async (e) => {
    e?.preventDefault();
    setSavingScore(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const scoresPayload = Object.entries(scoringForm.scores).map(([critId, data]) => ({
        criterionId: parseInt(critId, 10),
        score: parseFloat(data.score),
        comments: data.comments
      }));

      const res = await api.put(`/performance/evaluations/${selectedEval.id}`, {
        scores: scoresPayload,
        strengths: scoringForm.strengths,
        areasForImprovement: scoringForm.areasForImprovement,
        reviewerComments: scoringForm.reviewerComments
      });

      if (res.data.success) {
        setSuccessMsg('Draft evaluation saved successfully.');
        fetchData();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save evaluation draft.');
    } finally {
      setSavingScore(false);
    }
  };

  // Finalize Evaluation
  const handleFinalizeEvaluation = async () => {
    if (!window.confirm('Are you sure you want to finalize this performance evaluation? Once finalized, the record is locked against regular edits.')) {
      return;
    }
    setSavingScore(true);
    setErrorMsg('');
    try {
      // First save draft scores
      await handleSaveEvaluationDraft();

      // Call finalize endpoint
      const res = await api.post(`/performance/evaluations/${selectedEval.id}/finalize`);
      if (res.data.success) {
        setSuccessMsg(res.data.message || 'Evaluation successfully finalized and locked.');
        setScoreModalOpen(false);
        fetchData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to finalize evaluation.');
    } finally {
      setSavingScore(false);
    }
  };

  // Handle Amend / Reopen
  const handleAmendSubmit = async (e) => {
    e.preventDefault();
    if (!amendReason.trim() || amendReason.trim().length < 10) {
      setErrorMsg('Mandatory reason must be at least 10 characters.');
      return;
    }
    try {
      const res = await api.post(`/performance/evaluations/${selectedEval.id}/amend`, {
        amendmentReason: amendReason
      });
      if (res.data.success) {
        setAmendModalOpen(false);
        fetchData();
        openScoringModal(selectedEval);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to reopen evaluation.');
    }
  };

  // Assign Evaluation Submit
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        periodId: assignForm.periodId
      };
      if (assignForm.targetType === 'intern') {
        payload.internId = assignForm.internId;
      } else {
        payload.cohortId = assignForm.cohortId;
      }

      const res = await api.post('/performance/evaluations', payload);
      if (res.data.success) {
        setAssignModalOpen(false);
        fetchData();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to assign evaluation.');
    }
  };

  // Period Save
  const handlePeriodSubmit = async (e) => {
    e.preventDefault();
    try {
      if (periodForm.id) {
        await api.put(`/performance/periods/${periodForm.id}`, periodForm);
      } else {
        await api.post('/performance/periods', periodForm);
      }
      setPeriodModalOpen(false);
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save period.');
    }
  };

  // Period Status Transition
  const handlePeriodTransition = async (p, nextStatus) => {
    try {
      await api.patch(`/performance/periods/${p.id}/status`, { status: nextStatus });
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to transition period status.');
    }
  };

  // Criterion Save
  const handleCriterionSubmit = async (e) => {
    e.preventDefault();
    try {
      if (criterionForm.id) {
        await api.put(`/performance/criteria/${criterionForm.id}`, criterionForm);
      } else {
        await api.post('/performance/criteria', criterionForm);
      }
      setCriterionModalOpen(false);
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save criterion.');
    }
  };

  // Toggle Criterion Status
  const handleToggleCriterion = async (c) => {
    try {
      await api.patch(`/performance/criteria/${c.id}/status`);
      fetchData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to toggle criterion status.');
    }
  };

  // Filtered evaluations
  const filteredEvaluations = evaluations.filter(ev => {
    if (filterPeriod !== 'ALL' && String(ev.period_id) !== String(filterPeriod)) return false;
    if (filterTrack !== 'ALL' && String(ev.track_id) !== String(filterTrack)) return false;
    if (filterCohort !== 'ALL' && String(ev.cohort_id) !== String(filterCohort)) return false;
    if (filterStatus !== 'ALL' && ev.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${ev.intern_first} ${ev.intern_last}`.toLowerCase().includes(q);
      const matchCode = ev.intern_code?.toLowerCase().includes(q);
      const matchTrack = ev.track_name?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchTrack) return false;
    }
    return true;
  });

  const activePeriod = periods.find(p => p.status === 'active') || periods[0];
  const liveScore = calculateLiveScore();
  const liveRating = resolveLiveRating(liveScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-brand-400" />
            <span>{isMentor ? 'Mentor Performance Evaluation Desk' : 'Performance Management & Evaluation Engine'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative multi-factor competencies, server-calculated weighted scoring, and historical evaluation locking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setAssignForm({
                    targetType: 'intern',
                    internId: interns[0]?.id || '',
                    cohortId: cohorts[0]?.id || '',
                    periodId: activePeriod?.id || ''
                  });
                  setAssignModalOpen(true);
                }}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Initiate Evaluation</span>
              </button>

              <button
                onClick={() => {
                  setPeriodForm({
                    id: null,
                    name: '',
                    description: '',
                    startDate: new Date().toISOString().substring(0, 10),
                    endDate: '',
                    status: 'draft'
                  });
                  setPeriodModalOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>New Period</span>
              </button>
            </>
          )}

          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={async () => {
              try {
                await downloadCSV('/reports/export/performance', `jowis-performance-report-${new Date().toISOString().split('T')[0]}.csv`, {
                  periodId: filterPeriod !== 'ALL' ? filterPeriod : undefined,
                  trackId: filterTrack !== 'ALL' ? filterTrack : undefined,
                  cohortId: filterCohort !== 'ALL' ? filterCohort : undefined,
                  status: filterStatus !== 'ALL' ? filterStatus : undefined,
                  search: searchQuery.trim() || undefined
                });
              } catch (err) {
                setErrorMsg(err.message || 'Failed to export performance evaluations.');
              }
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-brand-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Global Alert Banners */}
      {errorMsg && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white font-bold">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white font-bold">×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-2 text-xs">
        {isAdmin && (
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview & Analytics</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('evaluations')}
          className={`px-4 py-2.5 font-medium border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'evaluations'
              ? 'border-brand-500 text-brand-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Evaluations Desk ({filteredEvaluations.length})</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('periods')}
              className={`px-4 py-2.5 font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'periods'
                  ? 'border-brand-500 text-brand-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Evaluation Periods ({periods.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('criteria')}
              className={`px-4 py-2.5 font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'criteria'
                  ? 'border-brand-500 text-brand-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Evaluation Criteria ({criteria.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('bands')}
              className={`px-4 py-2.5 font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'bands'
                  ? 'border-brand-500 text-brand-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Rating Bands</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && overviewData && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="erp-card p-3.5">
              <span className="text-[11px] text-slate-400 uppercase">Active Period</span>
              <p className="text-base font-bold text-white mt-1 truncate">{overviewData.stats.activePeriod?.name || 'None'}</p>
              <p className="text-[10px] text-brand-400 mt-0.5">Current Evaluation Cycle</p>
            </div>

            <div className="erp-card p-3.5">
              <span className="text-[11px] text-slate-400 uppercase">Total Evals</span>
              <p className="text-2xl font-bold text-white mt-1">{overviewData.stats.total}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Initiated records</p>
            </div>

            <div className="erp-card p-3.5">
              <span className="text-[11px] text-slate-400 uppercase">Pending / Draft</span>
              <p className="text-2xl font-bold text-amber-300 mt-1">
                {(overviewData.stats.draft || 0) + (overviewData.stats.submitted || 0)}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">In review queue</p>
            </div>

            <div className="erp-card p-3.5">
              <span className="text-[11px] text-slate-400 uppercase">Finalized</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{overviewData.stats.finalized}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Completed & locked</p>
            </div>

            <div className="erp-card p-3.5">
              <span className="text-[11px] text-slate-400 uppercase">Average Score</span>
              <p className="text-2xl font-bold text-indigo-300 mt-1">
                {overviewData.stats.average !== null ? `${overviewData.stats.average}%` : '—'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Weighted cohort avg</p>
            </div>

            <div className="erp-card p-3.5">
              <span className="text-[11px] text-slate-400 uppercase">Completion Rate</span>
              <p className="text-2xl font-bold text-sky-300 mt-1">{overviewData.stats.completionRate}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Active interns evaluated</p>
            </div>
          </div>

          {/* Rating Band Distribution */}
          <div className="erp-card p-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-brand-400" />
              <span>Performance Outcome Distribution</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {overviewData.ratingDistribution.map((r, idx) => (
                <div key={idx} className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400 truncate">{r.ratingBand}</div>
                  <div className="text-xl font-bold text-white mt-1">{r.count}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {r.avgBandScore !== null ? `Avg: ${r.avgBandScore}%` : 'No score'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Track Breakdown Table */}
          <div className="erp-card overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Track-by-Track Performance Execution
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Track Program</th>
                  <th className="px-5 py-3">Total Active Interns</th>
                  <th className="px-5 py-3">Initiated Evals</th>
                  <th className="px-5 py-3">Finalized Evals</th>
                  <th className="px-5 py-3">Average Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {overviewData.trackBreakdown.map(tb => (
                  <tr key={tb.trackId} className="hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-medium text-white">{tb.trackName}</td>
                    <td className="px-5 py-3 font-mono text-slate-300">{tb.totalInterns}</td>
                    <td className="px-5 py-3 font-mono text-slate-400">{tb.totalEvaluations}</td>
                    <td className="px-5 py-3 font-mono text-emerald-400 font-bold">{tb.finalizedEvaluations}</td>
                    <td className="px-5 py-3 font-mono font-bold">
                      {tb.avgScore !== null ? (
                        <span className="text-brand-300">{tb.avgScore}%</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EVALUATIONS DESK */}
      {activeTab === 'evaluations' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="erp-card p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Period filter */}
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                className="erp-input py-1 px-2 text-xs bg-slate-900 border-slate-700"
              >
                <option value="ALL">All Periods</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                ))}
              </select>

              {/* Track filter */}
              <select
                value={filterTrack}
                onChange={(e) => setFilterTrack(e.target.value)}
                className="erp-input py-1 px-2 text-xs bg-slate-900 border-slate-700"
              >
                <option value="ALL">All Tracks</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="erp-input py-1 px-2 text-xs bg-slate-900 border-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="finalized">Finalized</option>
              </select>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search intern or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="erp-input w-full pl-8 py-1 text-xs bg-slate-900 border-slate-700"
              />
            </div>
          </div>

          {/* Evaluations Table */}
          <div className="erp-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading performance evaluations...</div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No evaluations found matching the selected filters.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Intern</th>
                    <th className="px-5 py-3.5">Track / Cohort</th>
                    <th className="px-5 py-3.5">Evaluation Period</th>
                    <th className="px-5 py-3.5">Calculated Score</th>
                    <th className="px-5 py-3.5">Rating Band</th>
                    <th className="px-5 py-3.5">Status / Lock</th>
                    <th className="px-5 py-3.5">Reviewer</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredEvaluations.map(ev => (
                    <tr key={ev.id} className="hover:bg-slate-800/30">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-white">{ev.intern_first} {ev.intern_last}</div>
                        <div className="font-mono text-slate-500 text-[10px]">{ev.intern_code}</div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        <div>{ev.track_name}</div>
                        <div className="text-slate-500 text-[10px]">{ev.cohort_name}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">
                        {ev.period_name || ev.evaluation_period}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold">
                        {ev.overall_score !== null ? (
                          <span className="text-brand-300 text-sm">{ev.overall_score}%</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {ev.overall_rating ? (
                          <Badge status={ev.overall_rating} text={ev.overall_rating} />
                        ) : (
                          <span className="text-slate-500 text-[11px]">Unrated</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Badge status={ev.status} />
                          {ev.is_locked ? (
                            <Lock className="w-3.5 h-3.5 text-emerald-400" title="Locked against direct edits" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-amber-400" title="Open for scoring / edits" />
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {ev.reviewer_first} {ev.reviewer_last}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Scoring / Edit button */}
                          {!ev.is_locked && (
                            <button
                              onClick={() => openScoringModal(ev)}
                              className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-colors"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Score</span>
                            </button>
                          )}

                          {/* View details */}
                          <button
                            onClick={() => openDetailsModal(ev)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium border border-slate-700 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>

                          {/* Admin Reopen / Amend */}
                          {isAdmin && ev.is_locked && (
                            <button
                              onClick={() => openAmendModal(ev)}
                              className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 rounded text-[11px] font-medium border border-amber-800/80 flex items-center gap-1"
                              title="Controlled Reopen/Amendment"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Amend</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PERIODS MANAGEMENT */}
      {activeTab === 'periods' && isAdmin && (
        <div className="erp-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Period Name</th>
                <th className="px-5 py-3.5">Schedule</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Evaluations</th>
                <th className="px-5 py-3.5">Finalized</th>
                <th className="px-5 py-3.5">Avg Score</th>
                <th className="px-5 py-3.5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {periods.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-white">{p.name}</div>
                    <div className="text-slate-500 text-[10px]">{p.description}</div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-300">
                    {p.start_date} &rarr; {p.end_date}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-400">{p.total_evaluations || 0}</td>
                  <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">{p.finalized_count || 0}</td>
                  <td className="px-5 py-3.5 font-mono font-bold">
                    {p.avg_score !== null ? `${p.avg_score}%` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === 'draft' && (
                        <button
                          onClick={() => handlePeriodTransition(p, 'active')}
                          className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-semibold text-[11px]"
                        >
                          Activate
                        </button>
                      )}
                      {p.status === 'active' && (
                        <button
                          onClick={() => handlePeriodTransition(p, 'closed')}
                          className="px-2.5 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded font-semibold text-[11px]"
                        >
                          Close Period
                        </button>
                      )}
                      {p.status === 'closed' && (
                        <button
                          onClick={() => handlePeriodTransition(p, 'archived')}
                          className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold text-[11px]"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: CRITERIA MANAGEMENT */}
      {activeTab === 'criteria' && isAdmin && (
        <div className="space-y-4">
          {/* Weight Balance Header */}
          <div className="erp-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sliders className="w-5 h-5 text-brand-400" />
              <div>
                <div className="text-xs font-bold text-white">Curriculum Competency Weights Configuration</div>
                <div className="text-[11px] text-slate-400">Active evaluation criteria must sum to exactly 100.00% weight.</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${
                weightSummary.isBalanced
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950/80 text-rose-300 border-rose-800 animate-pulse'
              }`}>
                Active Weight: {weightSummary.totalActiveWeight}% ({weightSummary.isBalanced ? 'Balanced' : 'Imbalanced'})
              </span>

              <button
                onClick={() => {
                  setCriterionForm({
                    id: null,
                    name: '',
                    description: '',
                    category: 'technical',
                    weight: 20,
                    maxScore: 100,
                    status: 'active'
                  });
                  setCriterionModalOpen(true);
                }}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Criterion</span>
              </button>
            </div>
          </div>

          <div className="erp-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-5 py-3.5">Criterion Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Weight (%)</th>
                  <th className="px-5 py-3.5">Max Score</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Historical Usages</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {criteria.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/30">
                    <td className="px-5 py-3.5 font-mono text-slate-400">#{c.order_index}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white">{c.name}</div>
                      <div className="text-slate-500 text-[10px] max-w-md line-clamp-1">{c.description}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-300 uppercase text-[10px]">{c.category}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-brand-300">{c.weight}%</td>
                    <td className="px-5 py-3.5 font-mono text-slate-300">{c.max_score} pts</td>
                    <td className="px-5 py-3.5">
                      <Badge status={c.status} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-400">{c.usage_count || 0}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleCriterion(c)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                        >
                          {c.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RATING BANDS */}
      {activeTab === 'bands' && isAdmin && (
        <div className="erp-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Outcome Classification</th>
                <th className="px-5 py-3.5">Score Range (%)</th>
                <th className="px-5 py-3.5">Descriptor</th>
                <th className="px-5 py-3.5">Visual Badge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {ratingBands.map(b => (
                <tr key={b.id} className="hover:bg-slate-800/30">
                  <td className="px-5 py-3.5 font-bold text-white">{b.name}</td>
                  <td className="px-5 py-3.5 font-mono text-brand-300 font-bold">
                    {b.min_score}% &rarr; {b.max_score}%
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 max-w-md">{b.description}</td>
                  <td className="px-5 py-3.5">
                    <Badge status={b.name} text={b.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: LIVE REVIEWER SCORING WORKSPACE (Gate 5 & 6) */}
      <Modal
        isOpen={scoreModalOpen}
        onClose={() => setScoreModalOpen(false)}
        title={`Evaluation Workspace: ${evalDetailData?.evaluation?.intern_first} ${evalDetailData?.evaluation?.intern_last} (${evalDetailData?.evaluation?.intern_code})`}
      >
        <form onSubmit={handleSaveEvaluationDraft} className="space-y-4 text-xs">
          {/* Header Banner with Real-time Calculated Score */}
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Server-Calculated Live Overall Score</div>
              <div className="text-2xl font-extrabold text-white flex items-baseline gap-2 mt-0.5">
                <span>{liveScore}%</span>
                <span className="text-xs font-semibold text-brand-400">{liveRating}</span>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              <div>Period: <strong className="text-slate-200">{evalDetailData?.evaluation?.period_name}</strong></div>
              <div>Track: <strong className="text-slate-200">{evalDetailData?.evaluation?.track_name}</strong></div>
            </div>
          </div>

          {/* Supporting Background Context Card (Gate 13) */}
          {evalDetailData?.supportingContext && (
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                <Info className="w-3.5 h-3.5 text-brand-400" />
                <span>Supporting Operational Context (Read-Only Reference):</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 pt-1">
                <div>Attendance Rate: <strong className="text-emerald-400">{evalDetailData.supportingContext.attendance?.attendanceRate}</strong></div>
                <div>Completed Tasks: <strong className="text-white">{evalDetailData.supportingContext.tasks?.completed}</strong></div>
                <div>Overdue Tasks: <strong className="text-rose-400">{evalDetailData.supportingContext.tasks?.overdue}</strong></div>
                <div>Completed Modules: <strong className="text-brand-300">{evalDetailData.supportingContext.curriculum?.completedModules}</strong></div>
              </div>
              <p className="text-[9px] text-slate-500 italic mt-1">{evalDetailData.supportingContext.disclaimer}</p>
            </div>
          )}

          {/* Configured Criteria Scoring Table */}
          <div className="space-y-3">
            <h4 className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">
              Evaluation Criteria & Weighted Contribution
            </h4>

            {evalDetailData?.scores?.map((s) => {
              const currentScore = scoringForm.scores[s.criterion_id]?.score ?? s.score ?? 0;
              const maxScore = parseFloat(s.max_score || 100);
              const weight = parseFloat(s.weight || 20);
              const weightedContribution = ((parseFloat(currentScore) || 0) / maxScore) * weight;

              return (
                <div key={s.criterion_id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-white text-xs">{s.criterion_name}</span>
                      <span className="text-[10px] text-slate-400 ml-2 uppercase font-mono">
                        Weight: {weight}% • Max: {maxScore} pts
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-brand-300 text-xs">
                        +{weightedContribution.toFixed(2)}% pts
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">{s.criterion_description}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                        Score (0 - {maxScore})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={maxScore}
                        step="0.5"
                        value={currentScore}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScoringForm({
                            ...scoringForm,
                            scores: {
                              ...scoringForm.scores,
                              [s.criterion_id]: {
                                ...scoringForm.scores[s.criterion_id],
                                score: val
                              }
                            }
                          });
                        }}
                        className="erp-input w-full py-1 text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-0.5">
                        Criterion Comments & Observations
                      </label>
                      <input
                        type="text"
                        placeholder="Specific feedback on this competency..."
                        value={scoringForm.scores[s.criterion_id]?.comments || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScoringForm({
                            ...scoringForm,
                            scores: {
                              ...scoringForm.scores,
                              [s.criterion_id]: {
                                ...scoringForm.scores[s.criterion_id],
                                comments: val
                              }
                            }
                          });
                        }}
                        className="erp-input w-full py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Qualitative Feedback Sections */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">
                Demonstrated Key Strengths
              </label>
              <textarea
                rows={2}
                placeholder="Highlight notable technical mastery, problem-solving wins, or teamwork contributions..."
                value={scoringForm.strengths}
                onChange={(e) => setScoringForm({ ...scoringForm, strengths: e.target.value })}
                className="erp-input w-full"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">
                Targeted Areas for Growth & Improvement
              </label>
              <textarea
                rows={2}
                placeholder="Actionable focus points for the intern in upcoming milestones..."
                value={scoringForm.areasForImprovement}
                onChange={(e) => setScoringForm({ ...scoringForm, areasForImprovement: e.target.value })}
                className="erp-input w-full"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">
                Reviewer Summary Comments & Recommendation
              </label>
              <textarea
                rows={2}
                placeholder="Overall evaluation summary and progression recommendation..."
                value={scoringForm.reviewerComments}
                onChange={(e) => setScoringForm({ ...scoringForm, reviewerComments: e.target.value })}
                className="erp-input w-full"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
            <div className="text-[11px] text-slate-400">
              Live Total: <strong className="text-white">{liveScore}%</strong> ({liveRating})
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScoreModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingScore}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={handleFinalizeEvaluation}
                disabled={savingScore}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Finalize & Lock Evaluation</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: READ-ONLY DETAILS MODAL */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`Performance Evaluation: ${evalDetailData?.evaluation?.intern_first} ${evalDetailData?.evaluation?.intern_last}`}
      >
        {evalDetailData && (
          <div className="space-y-4 text-xs">
            {/* Score Banner */}
            <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Finalized Overall Score</div>
                <div className="text-2xl font-bold text-white mt-0.5">
                  {evalDetailData.evaluation.overall_score}%
                </div>
              </div>
              <Badge status={evalDetailData.evaluation.overall_rating} text={evalDetailData.evaluation.overall_rating} />
            </div>

            {/* Criteria Breakdown */}
            <div className="space-y-2">
              <h4 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Criteria Breakdown</h4>
              {evalDetailData.scores?.map(s => (
                <div key={s.criterion_id} className="p-2.5 bg-slate-950/70 rounded border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{s.criterion_name}</div>
                    <div className="text-[10px] text-slate-400">{s.comments || 'No comment provided.'}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-emerald-400 font-bold">{s.score} / {s.max_score}</div>
                    <div className="text-[10px] text-slate-500">Weight: {s.weight}%</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-emerald-950/20 border border-emerald-800/50 rounded-lg">
                <div className="text-[10px] text-emerald-300 uppercase font-bold mb-1">Key Strengths</div>
                <p className="text-slate-300 leading-relaxed">{evalDetailData.evaluation.strengths || 'None recorded.'}</p>
              </div>
              <div className="p-3 bg-amber-950/20 border border-amber-800/50 rounded-lg">
                <div className="text-[10px] text-amber-300 uppercase font-bold mb-1">Areas for Growth</div>
                <p className="text-slate-300 leading-relaxed">{evalDetailData.evaluation.areas_for_improvement || 'None recorded.'}</p>
              </div>
            </div>

            {/* Reviewer Comments */}
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Reviewer Summary Feedback</div>
              <p className="text-slate-200 italic">&ldquo;{evalDetailData.evaluation.reviewer_comments}&rdquo;</p>
              <div className="text-[10px] text-slate-500 font-mono mt-2">
                Evaluator: {evalDetailData.evaluation.reviewer_first} {evalDetailData.evaluation.reviewer_last} • Status: {evalDetailData.evaluation.status}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: CONTROLLED ADMIN AMEND / REOPEN MODAL */}
      <Modal
        isOpen={amendModalOpen}
        onClose={() => setAmendModalOpen(false)}
        title={`Reopen / Amend Evaluation: ${selectedEval?.intern_first} ${selectedEval?.intern_last}`}
      >
        <form onSubmit={handleAmendSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-amber-950/40 border border-amber-800/80 text-amber-300 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Audit Alert: Unlocking a finalized evaluation is a controlled administrative action. All modifications and justifications are permanently recorded in the audit trail.</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">
              Mandatory Amendment Justification * (Min 10 characters)
            </label>
            <textarea
              rows={3}
              required
              placeholder="State the formal justification for reopening this finalized evaluation (e.g., academic board review, grade dispute resolution)..."
              value={amendReason}
              onChange={(e) => setAmendReason(e.target.value)}
              className="erp-input w-full"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAmendModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Confirm & Unlock for Editing</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: INITIATE / ASSIGN EVALUATION MODAL */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Initiate Performance Evaluation"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Select Active Performance Period *</label>
            <select
              required
              value={assignForm.periodId}
              onChange={(e) => setAssignForm({ ...assignForm, periodId: e.target.value })}
              className="erp-input w-full"
            >
              <option value="">Choose evaluation period...</option>
              {periods.filter(p => p.status === 'active').map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Assignment Scope *</label>
            <div className="flex items-center gap-4 py-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  value="intern"
                  checked={assignForm.targetType === 'intern'}
                  onChange={() => setAssignForm({ ...assignForm, targetType: 'intern' })}
                />
                <span>Individual Intern</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  value="cohort"
                  checked={assignForm.targetType === 'cohort'}
                  onChange={() => setAssignForm({ ...assignForm, targetType: 'cohort' })}
                />
                <span>Entire Cohort</span>
              </label>
            </div>
          </div>

          {assignForm.targetType === 'intern' ? (
            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Select Intern *</label>
              <select
                required
                value={assignForm.internId}
                onChange={(e) => setAssignForm({ ...assignForm, internId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Choose intern...</option>
                {interns.map(i => (
                  <option key={i.id} value={i.id}>{i.first_name} {i.last_name} ({i.intern_code})</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Select Cohort *</label>
              <select
                required
                value={assignForm.cohortId}
                onChange={(e) => setAssignForm({ ...assignForm, cohortId: e.target.value })}
                className="erp-input w-full"
              >
                <option value="">Choose cohort...</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.cohort_code})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg"
            >
              Initiate Evaluation
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: NEW / EDIT PERIOD MODAL */}
      <Modal
        isOpen={periodModalOpen}
        onClose={() => setPeriodModalOpen(false)}
        title={periodForm.id ? 'Edit Performance Period' : 'New Performance Period'}
      >
        <form onSubmit={handlePeriodSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Period Cycle Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 2026 Comprehensive Evaluation Cycle"
              value={periodForm.name}
              onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Objectives and scope of this evaluation cycle..."
              value={periodForm.description}
              onChange={(e) => setPeriodForm({ ...periodForm, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={periodForm.startDate}
                onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">End Date *</label>
              <input
                type="date"
                required
                value={periodForm.endDate}
                onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                className="erp-input w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setPeriodModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg"
            >
              Save Period
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 6: NEW / EDIT CRITERION MODAL */}
      <Modal
        isOpen={criterionModalOpen}
        onClose={() => setCriterionModalOpen(false)}
        title={criterionForm.id ? 'Edit Evaluation Criterion' : 'New Evaluation Criterion'}
      >
        <form onSubmit={handleCriterionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Criterion Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. System Design & Code Maintainability"
              value={criterionForm.name}
              onChange={(e) => setCriterionForm({ ...criterionForm, name: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Explain expectations for this competency..."
              value={criterionForm.description}
              onChange={(e) => setCriterionForm({ ...criterionForm, description: e.target.value })}
              className="erp-input w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Category</label>
              <select
                value={criterionForm.category}
                onChange={(e) => setCriterionForm({ ...criterionForm, category: e.target.value })}
                className="erp-input w-full"
              >
                <option value="technical">Technical</option>
                <option value="delivery">Delivery</option>
                <option value="behavioral">Behavioral</option>
                <option value="communication">Communication</option>
                <option value="leadership">Leadership</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Weight (%) *</label>
              <input
                type="number"
                required
                min="1"
                max="100"
                step="0.5"
                value={criterionForm.weight}
                onChange={(e) => setCriterionForm({ ...criterionForm, weight: e.target.value })}
                className="erp-input w-full font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 uppercase text-[10px] mb-1">Max Score *</label>
              <input
                type="number"
                required
                min="1"
                value={criterionForm.maxScore}
                onChange={(e) => setCriterionForm({ ...criterionForm, maxScore: e.target.value })}
                className="erp-input w-full font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCriterionModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg"
            >
              Save Criterion
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
