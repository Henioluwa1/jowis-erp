import React, { useState } from 'react';
import api from '../../services/api';
import { Calendar, Lock, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export const ScheduleSetupModal = ({ isOpen, onClose, onScheduleSaved }) => {
  const [selectedOptional, setSelectedOptional] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const optionalDays = [
    { id: 'tuesday', label: 'Tuesday' },
    { id: 'wednesday', label: 'Wednesday' },
    { id: 'thursday', label: 'Thursday' },
    { id: 'friday', label: 'Friday' }
  ];

  const handleToggleDay = (dayId) => {
    setErrorMsg('');
    if (selectedOptional.includes(dayId)) {
      setSelectedOptional(selectedOptional.filter(d => d !== dayId));
    } else {
      if (selectedOptional.length >= 2) {
        setErrorMsg('You can only select exactly two optional days (3 total working days including Monday).');
        return;
      }
      setSelectedOptional([...selectedOptional, dayId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedOptional.length !== 2) {
      setErrorMsg('Please select exactly two additional days to complete your 3-day schedule.');
      return;
    }

    if (!confirmed) {
      setErrorMsg('Please confirm that you understand this schedule cannot be changed once submitted.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const fullSchedule = ['monday', ...selectedOptional];
      const res = await api.post('/attendance/schedule', { days: fullSchedule });
      if (res.data?.success) {
        if (onScheduleSaved) onScheduleSaved(res.data.data?.scheduleDays || fullSchedule);
        if (onClose) onClose();
      }
    } catch (err) {
      console.error('Save schedule error:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to save attendance schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const isComplete = selectedOptional.length === 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Attendance Schedule Setup</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                3 Days / Week
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official institutional attendance configuration for Jowis Studio.
            </p>
          </div>
        </div>

        {/* Notice Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs text-slate-300">
          <p className="font-semibold text-white flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Important Institutional Attendance Rules:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 text-[11px]">
            <li><strong className="text-slate-200">Monday is compulsory</strong> for all technology interns.</li>
            <li>Select <strong className="text-slate-200">exactly two additional days</strong> from Tuesday to Friday.</li>
            <li>Once submitted, your attendance schedule is <strong className="text-amber-300">permanently locked</strong> and cannot be modified.</li>
            <li>Non-scheduled days are <strong className="text-emerald-300">not counted as absences</strong>.</li>
          </ul>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Your 3 Working Days:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Compulsory Monday */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-slate-200 cursor-not-allowed">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled={true}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-700 bg-slate-800 focus:ring-0 cursor-not-allowed"
                  />
                  <span className="text-xs font-bold text-white">Monday</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Compulsory
                </span>
              </div>

              {/* Optional Days */}
              {optionalDays.map((day) => {
                const isSelected = selectedOptional.includes(day.id);
                return (
                  <div
                    key={day.id}
                    onClick={() => handleToggleDay(day.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-brand-600/20 border-brand-500/50 text-white shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-brand-600 border-slate-700 bg-slate-800 focus:ring-brand-500"
                      />
                      <span className="text-xs font-medium">{day.label}</span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs px-1 pt-1">
              <span className="text-slate-400">
                Selected: <strong className="text-white">{selectedOptional.length + 1}</strong> / 3 working days
              </span>
              <span className={`font-medium ${isComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isComplete ? '✓ Valid 3-Day Schedule' : `Select ${2 - selectedOptional.length} more optional day(s)`}
              </span>
            </div>
          </div>

          {/* Permanent Lock Confirmation */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-brand-600 border-slate-700 bg-slate-800 focus:ring-brand-500"
              />
              <span>
                I confirm that <strong className="text-white">Monday, {selectedOptional.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' and ') || '...'}</strong> will be my permanent 3-day weekly attendance schedule for the duration of my internship.
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all"
              >
                Dismiss For Now
              </button>
            )}
            <button
              type="submit"
              disabled={!isComplete || !confirmed || submitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white shadow-lg transition-all ${
                isComplete && confirmed && !submitting
                  ? 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{submitting ? 'Confirming & Locking...' : 'Lock Attendance Schedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleSetupModal;
