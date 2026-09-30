import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  Calendar,
  Clock,
  BookOpen,
  CheckSquare,
  Award,
  FileText,
  Upload,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  LogOut,
  Lock,
  ArrowRight,
  UserCheck,
  Sparkles,
  AlertTriangle,
  Briefcase,
  GraduationCap,
  MapPin,
  Phone,
  HelpCircle,
  Check,
  ChevronRight,
  Shield
} from 'lucide-react';

export const FirstLoginModal = () => {
  const { user, mustChangePassword, clearPasswordChangeRequirement, updateUserState, refreshUser, logout } = useAuth();

  // Determine if onboarding modal should be displayed
  const isIntern = user?.role === 'intern';
  const isMentor = user?.role === 'mentor';
  const isAdminOrSuper = user?.role === 'admin' || user?.role === 'super_admin';

  // Intern requires: schedule locked + password changed + onboarding completed
  const internNeedsOnboarding = isIntern && (mustChangePassword || !user?.scheduleLocked || !user?.onboardingCompleted);
  // Mentor requires: mentor profile completed + password changed + onboarding completed
  const mentorNeedsOnboarding = isMentor && (mustChangePassword || !user?.onboardingCompleted);
  // Admin requires password change if mustChangePassword
  const adminNeedsOnboarding = isAdminOrSuper && mustChangePassword;

  const [dismissed, setDismissed] = useState(false);

  const shouldShowModal = !dismissed && (internNeedsOnboarding || mentorNeedsOnboarding || adminNeedsOnboarding);

  // Wizard Step State
  // Step 1: Initial Task (Schedule for Intern, Details for Mentor, Password for Admin)
  // Step 2: Password Change (or System Guide if Admin)
  // Step 3: System Orientation & Guide
  const [currentStep, setCurrentStep] = useState(1);

  // Common UI State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // -------------------------------------------------------------
  // INTERN TASK 1: WORK DAYS SCHEDULE (3 Days, Compulsory Monday)
  // -------------------------------------------------------------
  const [selectedDays, setSelectedDays] = useState(['monday', 'tuesday', 'thursday']);
  const [scheduleLocked, setScheduleLocked] = useState(Boolean(user?.scheduleLocked));
  const availableWeekdays = [
    { id: 'monday', label: 'Monday', compulsory: true, desc: 'Institutional Standup & Cohort Brief' },
    { id: 'tuesday', label: 'Tuesday', compulsory: false, desc: 'Track Technical Lab & Mentorship' },
    { id: 'wednesday', label: 'Wednesday', compulsory: false, desc: 'Project Sprint & Review Day' },
    { id: 'thursday', label: 'Thursday', compulsory: false, desc: 'Architecture & Code Review' },
    { id: 'friday', label: 'Friday', compulsory: false, desc: 'Demo Day & Retrospective' }
  ];

  useEffect(() => {
    if (user?.scheduleDays && Array.isArray(user.scheduleDays)) {
      setSelectedDays(user.scheduleDays);
    }
    if (user?.scheduleLocked) {
      setScheduleLocked(true);
      if (isIntern && mustChangePassword) {
        setCurrentStep(2);
      }
    }
  }, [user, isIntern, mustChangePassword]);

  const toggleInternDay = (dayId) => {
    if (dayId === 'monday') return; // Compulsory
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      if (selectedDays.length >= 3) {
        setErrorMsg('Every intern must agree to exactly 3 working days per week. Uncheck a day first.');
        return;
      }
      setErrorMsg('');
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (selectedDays.length !== 3 || !selectedDays.includes('monday')) {
      setErrorMsg('You must agree to exactly 3 working days, including compulsory Monday.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post('/attendance/schedule', { 
        days: selectedDays,
        scheduleDays: selectedDays 
      });
      if (res.data?.success) {
        setScheduleLocked(true);
        updateUserState({ scheduleDays: selectedDays, scheduleLocked: true });
        setSuccessMsg('Your 3-day work schedule has been confirmed and locked.');
      }
      setCurrentStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('locked') || err.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
        setScheduleLocked(true);
        updateUserState({ scheduleDays: selectedDays, scheduleLocked: true });
        setCurrentStep(2);
      } else {
        setErrorMsg(msg || 'Failed to lock work schedule. Please try again.');
        setCurrentStep(2);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // MENTOR TASK 1: PROFILE & TEACHING QUALIFICATIONS
  // -------------------------------------------------------------
  const [mentorForm, setMentorForm] = useState({
    phone: user?.phone || '',
    address: '',
    specialization: user?.mentorSpecialization || 'Full-Stack Software Engineering',
    teachingSubjects: '',
    qualifications: '',
    bio: '',
    credentialsUrl: ''
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setUploadingFile(true);
    setErrorMsg('');

    try {
      const res = await api.post('/auth/upload-credential', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setMentorForm(prev => ({ ...prev, credentialsUrl: res.data.fileUrl }));
        setUploadedFileName(file.name);
        setSuccessMsg(`Credentials file "${file.name}" uploaded successfully.`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to upload credential document.');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSaveMentorProfile = async (e) => {
    e.preventDefault();
    if (!mentorForm.phone || !mentorForm.address || !mentorForm.specialization || !mentorForm.teachingSubjects || !mentorForm.qualifications) {
      setErrorMsg('Please complete all required mentor profile and teaching fields.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post('/auth/mentor-onboarding', mentorForm);
      if (res.data.success) {
        updateUserState({ phone: mentorForm.phone, mentorSpecialization: mentorForm.specialization });
        setSuccessMsg('Mentor profile and teaching curriculum saved successfully.');
        setCurrentStep(2); // Advance to Password Change
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save mentor profile.');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TASK 2: PASSWORD SECURITY & CHANGE TEMPORARY PASSWORD
  // -------------------------------------------------------------
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>_+\-=\\[\]]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword
  };

  const isPasswordValid =
    checks.length &&
    checks.upper &&
    checks.lower &&
    checks.number &&
    checks.special &&
    checks.match;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setErrorMsg('Please ensure all password security requirements are fulfilled.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post('/auth/change-password', {
        newPassword: newPassword.trim()
      });

      if (res.data?.success) {
        clearPasswordChangeRequirement();
        setSuccessMsg('Your permanent password has been set successfully!');
        setCurrentStep(3); // Advance to System Guide
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TASK 3: SYSTEM ORIENTATION & GUIDE (COMPLETION)
  // -------------------------------------------------------------
  const handleCompleteOnboarding = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      if (isIntern) {
        await api.post('/auth/intern-onboarding');
      } else if (isMentor) {
        await api.post('/auth/mentor-onboarding', mentorForm);
      }
      updateUserState({
        onboardingCompleted: true,
        scheduleLocked: true,
        mustChangePassword: false
      });
      clearPasswordChangeRequirement();
      setDismissed(true);
      await refreshUser();
    } catch (err) {
      console.error('Onboarding completion error:', err);
      // Fallback: clear local requirement so user always enters workspace
      updateUserState({
        onboardingCompleted: true,
        scheduleLocked: true,
        mustChangePassword: false
      });
      clearPasswordChangeRequirement();
      setDismissed(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!shouldShowModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="erp-card max-w-2xl w-full p-5 sm:p-7 border-brand-500/40 shadow-2xl shadow-brand-500/10 animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Institutional Onboarding Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-brand-400">
                  Mandatory Institutional Setup
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Welcome, {user?.firstName} {user?.lastName}!
              </h2>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-[11px] font-mono font-semibold text-slate-400">
              Step {currentStep} of 3
            </span>
          </div>
        </div>

        {/* Step Progress Bar - Interactive Slide Tabs */}
        <div className="grid grid-cols-3 gap-2 my-4">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <div className={`h-1.5 rounded-full transition-all duration-300 mb-1 ${currentStep >= 1 ? 'bg-brand-500 shadow-sm shadow-brand-500/50' : 'bg-slate-800'}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${currentStep === 1 ? 'text-brand-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}>
              1. {isIntern ? 'Schedule' : 'Profile'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <div className={`h-1.5 rounded-full transition-all duration-300 mb-1 ${currentStep >= 2 ? 'bg-brand-500 shadow-sm shadow-brand-500/50' : 'bg-slate-800'}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${currentStep === 2 ? 'text-brand-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}>
              2. Security
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className="text-left group cursor-pointer focus:outline-none"
          >
            <div className={`h-1.5 rounded-full transition-all duration-300 mb-1 ${currentStep >= 3 ? 'bg-brand-500 shadow-sm shadow-brand-500/50' : 'bg-slate-800'}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider block ${currentStep === 3 ? 'text-brand-400 font-bold' : 'text-slate-500 hover:text-slate-300'}`}>
              3. Orientation
            </span>
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: ROLE SPECIFIC INITIAL MANDATORY TASK                              */}
        {/* ========================================================================= */}
        {currentStep === 1 && isIntern && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 text-brand-300 font-bold text-xs uppercase mb-1">
                <Calendar className="w-4 h-4" />
                <span>Task 1 of 2: Select Your Agreed 3-Day Work Schedule</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                As part of your Jowis Studio internship agreement, you must specify exactly <strong>3 scheduled working days</strong> per week. <strong>Monday is compulsory</strong> for all technology tracks for institutional standup and briefings.
              </p>
            </div>

            {scheduleLocked ? (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Your 3-Day Work Schedule is Confirmed & Locked</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDays.map(d => (
                    <span key={d} className="px-3 py-1 rounded-lg bg-emerald-900/60 border border-emerald-700 text-emerald-200 font-semibold text-xs capitalize">
                      {d}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full mt-2 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30"
                >
                  <span>Continue to Password Security</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveSchedule} className="space-y-3">
                <div className="space-y-2">
                  {availableWeekdays.map((day) => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <div
                        key={day.id}
                        onClick={() => toggleInternDay(day.id)}
                        className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-brand-950/40 border-brand-500/60 text-white shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        } ${day.compulsory ? 'cursor-not-allowed opacity-90' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={day.compulsory}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-brand-600 border-slate-700 focus:ring-0 focus:ring-offset-0 bg-slate-800"
                          />
                          <div>
                            <span className="font-semibold text-xs text-white block">
                              {day.label}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {day.desc}
                            </span>
                          </div>
                        </div>

                        {day.compulsory && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Compulsory Standup Day
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">
                      Days Selected: <strong className="text-brand-300">{selectedDays.length} / 3</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-slate-400 hover:text-brand-300 underline cursor-pointer"
                    >
                      Skip to Next Step &rarr;
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={selectedDays.length !== 3 || submitting}
                    className="px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30"
                  >
                    <span>{submitting ? 'Locking Schedule...' : 'Lock 3-Day Schedule & Proceed'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {currentStep === 1 && isMentor && (
          <form onSubmit={handleSaveMentorProfile} className="space-y-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 text-brand-300 font-bold text-xs uppercase mb-1">
                <Briefcase className="w-4 h-4" />
                <span>Task 1 of 2: Complete Mentor Profile & Teaching Curriculum</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Please provide your verified instructional profile, contact address, areas of specialization, course teaching subjects, and upload your professional credentials.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Contact Phone Number *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08012345678"
                    value={mentorForm.phone}
                    onChange={(e) => setMentorForm({ ...mentorForm, phone: e.target.value })}
                    className="erp-input w-full pl-8 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Area of Specialization *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud & DevOps Engineering, Full-Stack"
                  value={mentorForm.specialization}
                  onChange={(e) => setMentorForm({ ...mentorForm, specialization: e.target.value })}
                  className="erp-input w-full py-2"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Office / Physical Address *</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Jowis Studio Hub, Floor 3, Victoria Island, Lagos"
                  value={mentorForm.address}
                  onChange={(e) => setMentorForm({ ...mentorForm, address: e.target.value })}
                  className="erp-input w-full pl-8 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">What You Will Be Teaching / Subjects *</label>
              <input
                type="text"
                required
                placeholder="e.g. Kubernetes, Docker, Microservices, CI/CD Pipelines, React Architecture"
                value={mentorForm.teachingSubjects}
                onChange={(e) => setMentorForm({ ...mentorForm, teachingSubjects: e.target.value })}
                className="erp-input w-full py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Professional Qualifications & Certifications *</label>
              <textarea
                required
                rows={2}
                placeholder="e.g. M.Sc Computer Science, AWS Certified Solutions Architect Professional, CKA"
                value={mentorForm.qualifications}
                onChange={(e) => setMentorForm({ ...mentorForm, qualifications: e.target.value })}
                className="erp-input w-full py-2"
              />
            </div>

            {/* Document Upload */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <label className="block font-semibold text-slate-300">Upload Credentials / CV Document (PDF/Docx)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="credential-upload"
                  accept=".pdf,.docx,.doc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="credential-upload"
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer border border-slate-700 flex items-center gap-2 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingFile ? 'Uploading...' : 'Choose File'}</span>
                </label>
                <span className="text-[11px] text-slate-400 truncate max-w-xs">
                  {uploadedFileName || mentorForm.credentialsUrl ? (uploadedFileName || 'Document uploaded') : 'No file chosen yet'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30"
              >
                <span>{submitting ? 'Saving Profile...' : 'Save Profile & Proceed to Security'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: PASSWORD CHANGE (MANDATORY FOR ALL FRESH ACCOUNTS)                */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 text-brand-300 font-bold text-xs uppercase mb-1">
                <Lock className="w-4 h-4" />
                <span>Task 2: Set Your Permanent Private Password</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your account was provisioned with a one-time temporary password. You must establish your confidential permanent password before accessing enterprise workspaces.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Permanent Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter permanent password"
                    className="w-full erp-input text-xs py-2 px-3 pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password *</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter to confirm"
                    className="w-full erp-input text-xs py-2 px-3 pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Security Requirements Checklist:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div className={`flex items-center gap-1.5 ${checks.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.length ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.upper ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.upper ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Uppercase (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.lower ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.lower ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Lowercase (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.number ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.number ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.special ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.special ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Special character</span>
                </div>
                <div className={`flex items-center gap-1.5 ${checks.match ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {checks.match ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                &larr; Back to Schedule
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-slate-400 hover:text-brand-300 underline cursor-pointer"
                >
                  Skip to Orientation &rarr;
                </button>
                <button
                  type="submit"
                  disabled={!isPasswordValid || submitting}
                  className="px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30"
                >
                  <span>{submitting ? 'Updating Password...' : 'Save Password & Continue to Guide'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: SYSTEM GUIDE & ORIENTATION CARDS                                  */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2 text-brand-300 font-bold text-xs uppercase mb-1">
                <BookOpen className="w-4 h-4" />
                <span>System Guide & Institutional Guidelines</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Welcome to Jowis Studio Enterprise Internship ERP. Here is your quick operational guide to maximize your success in the program.
              </p>
            </div>

            {isIntern ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-brand-400 font-semibold">
                    <Clock className="w-4 h-4" />
                    <span>09:00 AM Attendance Cutoff</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Check in every scheduled day before 09:00 AM Africa/Lagos. Arrivals after 09:00 AM are logged as Late.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <Calendar className="w-4 h-4" />
                    <span>Agreed 3-Day Compliance</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Attendance is monitored on your 3 agreed days. Official company holidays are automatically marked Excused.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                    <CheckSquare className="w-4 h-4" />
                    <span>Task Submissions & Reviews</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Submit code repositories and work deliverables for your track modules. Mentors evaluate and score all submissions.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold">
                    <Award className="w-4 h-4" />
                    <span>Digital ID & Certificate</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    View and print your official institutional ID card at any time from your Profile page. Eligible interns receive verified completion certificates.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-brand-400 font-semibold">
                    <UserCheck className="w-4 h-4" />
                    <span>Cohort & Intern Oversight</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Supervise assigned interns across technical tracks, review daily check-ins, and guide their career progression.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <FileText className="w-4 h-4" />
                    <span>Permission Requests</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Review intern leave applications. Recommend or reject requests with notes before administrative approval.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                    <CheckSquare className="w-4 h-4" />
                    <span>Grading & Task Feedback</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Assess submitted assignments, assign ratings, and provide constructive technical code review notes.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold">
                    <Shield className="w-4 h-4" />
                    <span>Staff ID & Verification</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Access your printable mentor badge and faculty profile at any time from your Profile page.
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>All mandatory setup requirements are fulfilled! Click below to enter your workspace.</span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                &larr; Back to Security
              </button>
              <button
                type="button"
                onClick={handleCompleteOnboarding}
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
              >
                <span>{submitting ? 'Entering Workspace...' : 'Complete Onboarding & Enter Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Footer: Sign Out fallback */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Jowis Studio Enterprise ERP Security Portal</span>
          <button
            type="button"
            onClick={logout}
            className="text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstLoginModal;
