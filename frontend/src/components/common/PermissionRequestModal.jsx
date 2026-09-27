import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  CalendarOff, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Send, 
  X, 
  ShieldAlert 
} from 'lucide-react';

export const PermissionRequestModal = ({ isOpen, onClose, onSuccess, scheduleDays = [] }) => {
  const [formData, setFormData] = useState({
    requestType: 'absence',
    startDate: '',
    endDate: '',
    reason: '',
    message: ''
  });

  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setFormData({
        requestType: 'absence',
        startDate: '',
        endDate: '',
        reason: '',
        message: ''
      });
      setCalculation(null);
      setCalcError('');
      setSubmitError('');
    }
  }, [isOpen]);

  // Recalculate affected days whenever start or end date changes
  useEffect(() => {
    if (!formData.startDate || !formData.endDate) {
      setCalculation(null);
      setCalcError('');
      return;
    }

    if (formData.startDate > formData.endDate) {
      setCalculation(null);
      setCalcError('End date cannot be earlier than start date.');
      return;
    }

    let isMounted = true;
    const calcTimer = setTimeout(async () => {
      try {
        setCalculating(true);
        setCalcError('');
        const res = await api.post('/permissions/calculate-days', {
          startDate: formData.startDate,
          endDate: formData.endDate
        });
        if (isMounted && res.data?.success) {
          setCalculation(res.data.data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Calculation error:', err);
          setCalculation(null);
          setCalcError(err.response?.data?.message || 'Failed to calculate scheduled working days.');
        }
      } finally {
        if (isMounted) setCalculating(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(calcTimer);
    };
  }, [formData.startDate, formData.endDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!formData.startDate || !formData.endDate) {
      setSubmitError('Please select both start and end dates.');
      return;
    }

    if (formData.startDate > formData.endDate) {
      setSubmitError('End date cannot be earlier than start date.');
      return;
    }

    if (!formData.reason.trim()) {
      setSubmitError('Please enter a reason for the permission request.');
      return;
    }

    if (calculation && calculation.affectedDaysCount === 0) {
      setSubmitError('The selected dates do not include any of your scheduled working days.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/permissions', {
        requestType: formData.requestType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason.trim(),
        message: formData.message.trim() || undefined
      });

      if (res.data?.success) {
        if (onSuccess) onSuccess(res.data.data);
        if (onClose) onClose();
      }
    } catch (err) {
      console.error('Submit permission request error:', err);
      setSubmitError(err.response?.data?.message || 'Failed to submit permission request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <CalendarOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Request Permission / Leave</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Submit an absence request for mentor and administrative review.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Schedule Badge Info */}
        {scheduleDays && scheduleDays.length > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-brand-400" />
              <span>Your Locked 3-Day Schedule:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {scheduleDays.map((d) => (
                <span
                  key={d}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-brand-500/15 text-brand-300 border border-brand-500/30 uppercase"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Request Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Request Type <span className="text-rose-400">*</span>
            </label>
            <select
              value={formData.requestType}
              onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition-colors"
            >
              <option value="absence">General Absence</option>
              <option value="sick_leave">Sick / Medical Leave</option>
              <option value="academic">Academic / Exam Leave</option>
              <option value="emergency">Emergency / Personal</option>
              <option value="official_duty">Official Duty / School Event</option>
            </select>
          </div>

          {/* Dates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Start Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                End Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                min={formData.startDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition-colors"
                required
              />
            </div>
          </div>

          {/* Dynamic Calculation Feedback Banner */}
          {calculating && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-brand-400" />
              <span>Calculating affected scheduled working days...</span>
            </div>
          )}

          {calcError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{calcError}</span>
            </div>
          )}

          {calculation && !calculating && (
            <div className={`p-3.5 rounded-xl border space-y-2 ${
              calculation.affectedDaysCount > 0
                ? 'bg-brand-950/30 border-brand-800/50 text-slate-200'
                : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {calculation.affectedDaysCount > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Scheduled Working Days Affected:</span>
                </span>
                <span className={`text-base font-extrabold px-2.5 py-0.5 rounded-lg border ${
                  calculation.affectedDaysCount > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {calculation.affectedDaysCount} {calculation.affectedDaysCount === 1 ? 'Day' : 'Days'}
                </span>
              </div>

              {calculation.affectedDates && calculation.affectedDates.length > 0 ? (
                <div className="text-[11px] text-slate-400 flex flex-wrap gap-1.5 pt-1">
                  <span className="text-slate-500">Affected dates:</span>
                  {calculation.affectedDates.map(date => (
                    <span key={date} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-slate-300">
                      {date}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-amber-300/90 pt-1">
                  None of the dates in this range fall on your scheduled work days ({scheduleDays.join(', ')}). No working day attendance is impacted.
                </p>
              )}

              <p className="text-[10px] text-slate-500 italic">
                * Note: Under institutional rules, only scheduled working days are counted. Non-scheduled weekdays, weekends, and official company holidays are excluded.
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason / Summary <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. University Semester Exams, High Fever & Medical Rest"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>

          {/* Detailed Message / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Detailed Explanation / Additional Information
            </label>
            <textarea
              rows={3}
              placeholder="Provide any relevant details, exam timetable references, or handover information..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors resize-none"
            />
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || calculating || (calculation && calculation.affectedDaysCount === 0)}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-lg shadow-brand-900/30"
            >
              {submitting ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Permission Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermissionRequestModal;
