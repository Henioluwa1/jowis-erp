import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Badge } from '../../components/common/Badge';
import {
  User,
  Shield,
  Award,
  Printer,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  GraduationCap,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  QrCode,
  Sparkles,
  Building2,
  Key,
  RefreshCw,
  Edit2,
  Save,
  Check,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Users,
  Camera,
  Upload,
  Image as ImageIcon,
  CheckSquare,
  CreditCard,
  Palette
} from 'lucide-react';
import { InstitutionalIDCard, DEFAULT_ID_CARD_CONFIGS } from '../../components/common/InstitutionalIDCard';
import { AdminIDCardStudioModal } from '../../components/common/AdminIDCardStudioModal';

export const UniversalProfilePage = () => {
  const { user, refreshUser, updateUserState } = useAuth();

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('id_card');
  const [cardPreviewRole, setCardPreviewRole] = useState(null);
  const [idCardSide, setIdCardSide] = useState('both'); // 'both', 'front', 'back'
  const [idCardConfigs, setIdCardConfigs] = useState(DEFAULT_ID_CARD_CONFIGS);
  const [studioModalOpen, setStudioModalOpen] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Contact Edit Form State
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bio: '',
    specialization: '',
    teachingSubjects: '',
    qualifications: '',
    skills: ''
  });
  const [savingContact, setSavingContact] = useState(false);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Notification / Feedback State
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/profile');
      if (res.data?.success) {
        const d = res.data.data;
        setProfileData(d);
        const rd = d.roleDetails || {};
        setContactForm({
          firstName: d.first_name || '',
          lastName: d.last_name || '',
          phone: d.phone || rd.phone || '',
          address: rd.address || '',
          emergencyContactName: rd.emergency_contact_name || '',
          emergencyContactPhone: rd.emergency_contact_phone || '',
          bio: rd.bio || '',
          specialization: rd.specialization || '',
          teachingSubjects: rd.teaching_subjects || '',
          qualifications: rd.qualifications || '',
          skills: rd.skills || ''
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCardConfigs = async () => {
    try {
      const res = await api.get('/system/id-card-config');
      if (res.data?.success && res.data?.data && Object.keys(res.data.data).length > 0) {
        const saved = res.data.data;
        setIdCardConfigs({
          intern: { ...DEFAULT_ID_CARD_CONFIGS.intern, ...(saved.intern || {}) },
          mentor: { ...DEFAULT_ID_CARD_CONFIGS.mentor, ...(saved.mentor || {}) },
          admin: { ...DEFAULT_ID_CARD_CONFIGS.admin, ...(saved.admin || {}) },
          super_admin: { ...DEFAULT_ID_CARD_CONFIGS.super_admin, ...(saved.super_admin || {}) }
        });
      }
    } catch (err) {
      console.error('Failed to load card configs:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchCardConfigs();
  }, []);

  // Universal profile photo upload handler
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image file size must be less than 5MB.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setUploadingAvatar(true);
      setSuccessMessage('');
      setErrorMessage('');

      const res = await api.post('/auth/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const timestampedUrl = `${res.data.avatarUrl}?t=${Date.now()}`;
        setProfileData((prev) => (prev ? { ...prev, avatar_url: timestampedUrl } : prev));
        updateUserState({ avatarUrl: timestampedUrl, avatar_url: timestampedUrl });
        await refreshUser();
        setSuccessMessage('Profile photo updated successfully! It is now reflected on your ID card, chat, and portal header.');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to upload profile photo.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateContact = async (e) => {
    e.preventDefault();
    setSavingContact(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await api.put('/auth/profile', contactForm);
      if (res.data.success) {
        setSuccessMessage('Profile information updated successfully.');
        setEditingContact(false);
        await refreshUser();
        fetchProfile();
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingContact(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setSavingPassword(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      if (res.data.success) {
        setSuccessMessage('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePrintIDCard = () => {
    document.body.classList.add('printing-id-card');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-id-card');
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <span className="text-xs font-medium">Loading institutional profile records...</span>
      </div>
    );
  }

  const role = profileData?.role_name || user?.role || 'User';
  const roleDetails = profileData?.roleDetails || {};
  const isIntern = role === 'intern';
  const isMentor = role === 'mentor';
  const isAdmin = role === 'admin' || role === 'super_admin';

  // Current active avatar URL (from profileData or user)
  const currentAvatarUrl = profileData?.avatar_url || user?.avatarUrl;

  // Construct institutional ID code
  const institutionalId = isIntern
    ? (roleDetails.intern_code || user?.internCode || 'JOWIS-INT-2026')
    : isMentor
    ? `JOWIS-MTR-${String(roleDetails.id || user?.id || 1).padStart(3, '0')}`
    : `JOWIS-ADM-${String(profileData?.id || user?.id || 1).padStart(3, '0')}`;

  const roleDisplayTitle = isIntern
    ? 'TECHNOLOGY INTERN'
    : isMentor
    ? 'INSTRUCTIONAL FACULTY / MENTOR'
    : role === 'super_admin'
    ? 'SUPER ADMINISTRATOR'
    : 'OPERATIONS ADMINISTRATOR';

  const departmentTrack = isIntern
    ? (roleDetails.track_name || 'Software Engineering Track')
    : isMentor
    ? (roleDetails.specialization || 'Instructional Faculty')
    : 'Institutional Governance & Operations';

  const issueDate = profileData?.created_at ? profileData.created_at.split('T')[0] : '2026-03-01';
  const expiryDate = isIntern
    ? (roleDetails.expected_end_date ? roleDetails.expected_end_date.split('T')[0] : '2027-03-31')
    : '2028-12-31';

  return (
    <div className="space-y-6">
      {/* Hidden file input for universal profile picture upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarUpload}
        accept="image/png, image/jpeg, image/webp, image/gif"
        className="hidden"
      />

      {/* Print-specific style tag for standard CR80 wallet dimensions */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-id-card-section, #printable-id-card-section * {
            visibility: visible;
          }
          #printable-id-card-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .id-card-print-grid {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 50px !important;
            max-width: 100% !important;
          }
          .id-card-wrapper {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 50px !important;
            width: 100% !important;
            max-width: 440px !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* 1. PROFILE IDENTITY HERO BANNER                                           */}
      {/* ========================================================================= */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            {/* Interactive Profile Photo Container */}
            <div className="relative group flex-shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 p-1 shadow-2xl shadow-brand-500/25">
                <div className="w-full h-full bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center relative">
                  {currentAvatarUrl ? (
                    <img
                      src={currentAvatarUrl}
                      alt={`${profileData?.first_name} ${profileData?.last_name}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}

                  {/* Fallback Monogram */}
                  <div
                    className={`w-full h-full bg-slate-950 flex items-center justify-center text-white font-extrabold text-2xl sm:text-3xl ${
                      currentAvatarUrl ? 'hidden' : 'flex'
                    }`}
                  >
                    {profileData?.first_name?.[0] || 'U'}{profileData?.last_name?.[0] || 'P'}
                  </div>

                  {/* Upload Overlay */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 cursor-pointer"
                    title="Click to upload profile picture"
                  >
                    {uploadingAvatar ? (
                      <RefreshCw className="w-6 h-6 animate-spin text-brand-400" />
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-brand-300" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Floating Camera Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/40 border-2 border-slate-900 cursor-pointer transition-transform hover:scale-110"
                title="Upload Profile Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Identity Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {profileData?.first_name} {profileData?.last_name}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                  {role.replace('_', ' ')}
                </span>
                <span className="font-mono text-xs text-brand-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  {institutionalId}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap justify-center sm:justify-start pt-1">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-400" />
                  {profileData?.email}
                </span>
                {(profileData?.phone || roleDetails?.phone) && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-brand-400" />
                    {profileData?.phone || roleDetails?.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-brand-400" />
                  {departmentTrack}
                </span>
              </div>

              {/* Status & Security Indicators */}
              <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 justify-center sm:justify-start flex-wrap">
                <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Institutional Active</span>
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>10m Inactivity Security Active</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3 self-center sm:self-end md:self-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-600/30 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
            </button>
            <button
              onClick={handlePrintIDCard}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all border border-slate-700 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-brand-400" />
              <span className="hidden sm:inline">Print Official ID</span>
            </button>
            <button
              onClick={fetchProfile}
              title="Refresh Profile"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Feedback Toasts */}
        {successMessage && (
          <div className="mt-5 p-3.5 bg-emerald-950/70 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-5 p-3.5 bg-rose-950/70 border border-rose-700/80 rounded-xl text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('id_card')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'id_card'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Digital ID Card</span>
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal & Institutional Info</span>
          </button>

          <button
            onClick={() => setActiveTab('academic_role')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'academic_role'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isIntern ? (
              <GraduationCap className="w-4 h-4" />
            ) : isMentor ? (
              <Briefcase className="w-4 h-4" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>
              {isIntern
                ? 'Track & Work Schedule'
                : isMentor
                ? 'Faculty & Curriculum'
                : 'Governance Scope'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security & Password</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INSTITUTIONAL DIGITAL ID CARD (PRINTABLE CR80 BADGE)               */}
      {/* ========================================================================= */}
      {activeTab === 'id_card' && (() => {
        // Perspective selector: only Admins and Super Admins can preview other roles
        const effectiveCardRole = (isAdmin && cardPreviewRole) ? cardPreviewRole : role;
        const currentCustomConfig = idCardConfigs[effectiveCardRole] || DEFAULT_ID_CARD_CONFIGS[effectiveCardRole] || DEFAULT_ID_CARD_CONFIGS.intern;

        return (
          <div id="printable-id-card-section" className="space-y-6">
            {/* Top Toolbar */}
            <div className="no-print space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-brand-400" />
                    <span>Official Institutional Digital ID Card</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Colors dynamically match institutional templates with crisp white cardstock surfaces, security microchip, and printable CR80 wallet standard.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 cursor-pointer border border-slate-700 transition-all"
                  >
                    <Camera className="w-4 h-4 text-brand-400" />
                    <span>Change Photo</span>
                  </button>
                  <button
                    onClick={handlePrintIDCard}
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30 transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Official Badge</span>
                  </button>
                </div>
              </div>

              {/* ADMIN ONLY: Portal Theme & Card Style Switcher */}
              {isAdmin && (
                <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-slate-300">Active Card Style:</span>
                    <span
                      className="px-2.5 py-0.5 rounded-full font-bold text-[11px] text-white shadow-sm"
                      style={{ backgroundColor: currentCustomConfig.portalAccent || '#3b82f6' }}
                    >
                      {currentCustomConfig.portalLabel || 'Portal'} ({currentCustomConfig.title || effectiveCardRole.toUpperCase()})
                    </span>
                  </div>

                  {/* Perspective selector for Admins & testing */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-medium mr-1">Preview Theme:</span>
                      <button
                        type="button"
                        onClick={() => setCardPreviewRole(null)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          cardPreviewRole === null
                            ? 'bg-white text-slate-900 shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        My Official ({role})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardPreviewRole('super_admin')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          cardPreviewRole === 'super_admin'
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                            : 'bg-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-700'
                        }`}
                      >
                        Super Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardPreviewRole('admin')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          cardPreviewRole === 'admin'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'bg-slate-800 text-slate-300 hover:text-blue-300 hover:bg-slate-700'
                        }`}
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardPreviewRole('mentor')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          cardPreviewRole === 'mentor'
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                            : 'bg-slate-800 text-slate-300 hover:text-purple-300 hover:bg-slate-700'
                        }`}
                      >
                        Mentor
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardPreviewRole('intern')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          cardPreviewRole === 'intern'
                            ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                            : 'bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-700'
                        }`}
                      >
                        Intern
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStudioModalOpen(true)}
                      className="px-3 py-1 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-md shadow-brand-600/30 transition-all ml-1"
                      title="Open ID Card Studio to edit designs universally and print user badges"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      <span>Edit Card Designs</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Reusable CR80 Institutional Card with Scannable Vector QR Code */}
            <InstitutionalIDCard
              user={{
                ...profileData,
                first_name: profileData?.first_name,
                last_name: profileData?.last_name,
                role: effectiveCardRole,
                role_name: effectiveCardRole,
                intern_code: institutionalId,
                track_name: departmentTrack,
                start_date: issueDate,
                expected_end_date: expiryDate,
                avatar_url: currentAvatarUrl
              }}
              customConfig={currentCustomConfig}
              cardRole={effectiveCardRole}
              side={idCardSide}
              onSideChange={setIdCardSide}
              showControls={true}
              onChangePhoto={() => fileInputRef.current?.click()}
              onPrint={handlePrintIDCard}
            />

            {/* Admin ID Card Studio Modal */}
            {isAdmin && (
              <AdminIDCardStudioModal
                isOpen={studioModalOpen}
                onClose={() => setStudioModalOpen(false)}
                initialRole={cardPreviewRole || 'intern'}
                onConfigSaved={(updatedConfigs) => {
                  setIdCardConfigs(updatedConfigs);
                }}
              />
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 2: PERSONAL & INSTITUTIONAL INFORMATION (ENHANCED DISPLAY)             */}
      {/* ========================================================================= */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-brand-400" />
                <span>Comprehensive Personal & Institutional Records</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Official personal profile, institutional placement, contact directory, and emergency channels.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditingContact(!editingContact)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all border ${
                  editingContact
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800 hover:bg-rose-900/80'
                    : 'bg-brand-600 hover:bg-brand-500 text-white border-transparent shadow-lg shadow-brand-600/30'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{editingContact ? 'Cancel Editing' : 'Edit Information'}</span>
              </button>
            </div>
          </div>

          {/* EDIT FORM (When editing mode is active) */}
          {editingContact ? (
            <div className="erp-card p-6 border-slate-800 space-y-6 bg-slate-900/90 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-brand-400" />
                  <span>Update Profile Information</span>
                </h4>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Live Synchronization</span>
              </div>

              <form onSubmit={handleUpdateContact} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">First Name *</label>
                    <input
                      type="text"
                      required
                      value={contactForm.firstName}
                      onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                      className="erp-input w-full"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={contactForm.lastName}
                      onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                      className="erp-input w-full"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Official Email (Read-Only)</label>
                    <input
                      type="email"
                      disabled
                      value={profileData?.email || ''}
                      className="erp-input w-full opacity-60 cursor-not-allowed bg-slate-950"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Primary Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 08012345678"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      className="erp-input w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Residential Street Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 15 Admiralty Way, Lekki Phase 1, Lagos"
                    value={contactForm.address}
                    onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                    className="erp-input w-full"
                  />
                </div>

                {/* Intern-specific emergency contact & skills */}
                {isIntern && (
                  <div className="space-y-4 pt-3 border-t border-slate-800">
                    <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                      Intern Emergency & Technical Records
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Emergency Contact Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Samuel Adeleke (Parent / Guardian)"
                          value={contactForm.emergencyContactName}
                          onChange={(e) => setContactForm({ ...contactForm, emergencyContactName: e.target.value })}
                          className="erp-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Emergency Contact Phone</label>
                        <input
                          type="tel"
                          placeholder="e.g. 08098765432"
                          value={contactForm.emergencyContactPhone}
                          onChange={(e) => setContactForm({ ...contactForm, emergencyContactPhone: e.target.value })}
                          className="erp-input w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Technical Skills (Comma Separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. React, Node.js, TypeScript, PostgreSQL, Docker"
                        value={contactForm.skills}
                        onChange={(e) => setContactForm({ ...contactForm, skills: e.target.value })}
                        className="erp-input w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Mentor-specific specialization & subjects */}
                {isMentor && (
                  <div className="space-y-4 pt-3 border-t border-slate-800">
                    <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
                      Faculty Credentials & Curriculum Records
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Core Specialization</label>
                        <input
                          type="text"
                          value={contactForm.specialization}
                          onChange={(e) => setContactForm({ ...contactForm, specialization: e.target.value })}
                          className="erp-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">Teaching Subjects / Modules</label>
                        <input
                          type="text"
                          value={contactForm.teachingSubjects}
                          onChange={(e) => setContactForm({ ...contactForm, teachingSubjects: e.target.value })}
                          className="erp-input w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Qualifications & Degrees</label>
                      <textarea
                        rows={2}
                        value={contactForm.qualifications}
                        onChange={(e) => setContactForm({ ...contactForm, qualifications: e.target.value })}
                        className="erp-input w-full"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Professional Biography / Statement</label>
                  <textarea
                    rows={3}
                    placeholder="Brief career or academic biography..."
                    value={contactForm.bio}
                    onChange={(e) => setContactForm({ ...contactForm, bio: e.target.value })}
                    className="erp-input w-full"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingContact(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingContact}
                    className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingContact ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* HIGH-CLARITY DISPLAY CARDS (UI/UX PRO MAX STANDARD) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* CARD 1: OFFICIAL INSTITUTIONAL IDENTITY */}
              <div className="erp-card p-6 border-slate-800 space-y-5 bg-slate-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Institutional Identity</h4>
                        <p className="text-[10px] text-slate-400">System credentials & governance</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Staff / Intern ID</span>
                      <p className="font-mono font-bold text-brand-300 mt-0.5">{institutionalId}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Portal Role</span>
                      <p className="font-semibold text-white mt-0.5 capitalize">{role.replace('_', ' ')}</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Program Track</span>
                      <p className="font-semibold text-slate-200 mt-0.5">{departmentTrack}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Cohort Code</span>
                      <p className="font-mono text-slate-300 mt-0.5">
                        {roleDetails.cohort_code || roleDetails.cohort_name || 'COHORT-2026-A'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Enrolled Date</span>
                      <p className="text-slate-300 mt-0.5 font-medium">{issueDate}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Tenancy Expiry</span>
                      <p className="text-slate-300 mt-0.5 font-medium">{expiryDate}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Mandatory First-Task:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed & Validated
                  </span>
                </div>
              </div>

              {/* CARD 2: CONTACT & RESIDENTIAL DIRECTORY */}
              <div className="erp-card p-6 border-slate-800 space-y-5 bg-slate-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Contact & Location Directory</h4>
                        <p className="text-[10px] text-slate-400">Communication channels & residence</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-4 text-xs">
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Official Email</span>
                        <p className="font-semibold text-white truncate">{profileData?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Direct Phone</span>
                        <p className="font-semibold text-white">
                          {profileData?.phone || roleDetails?.phone || (
                            <span className="text-slate-500 italic">No phone recorded</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Residential Address</span>
                        <p className="text-slate-300">
                          {roleDetails?.address || contactForm.address || (
                            <span className="text-slate-500 italic">No physical address specified</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Sub-section */}
                <div className="pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-6 -mb-6 p-4 rounded-b-2xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                    Emergency Contact Channel
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      {roleDetails?.emergency_contact_name || contactForm.emergencyContactName || 'None Listed'}
                    </span>
                    <span className="font-mono text-brand-300">
                      {roleDetails?.emergency_contact_phone || contactForm.emergencyContactPhone || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 3: PROFESSIONAL & ACADEMIC PORTFOLIO */}
              <div className="erp-card p-6 border-slate-800 space-y-4 bg-slate-900/60">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      {isIntern ? (
                        <GraduationCap className="w-4 h-4" />
                      ) : isMentor ? (
                        <Briefcase className="w-4 h-4" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {isIntern ? 'Intern Technical Profile' : isMentor ? 'Faculty Portfolio' : 'Governance Clearance'}
                      </h4>
                      <p className="text-[10px] text-slate-400">Academic & domain competency</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  {isIntern && (
                    <>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">
                          Core Technical Skills
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(roleDetails.skills || contactForm.skills || 'JavaScript, React, Node.js, Git')
                            .split(',')
                            .map((s, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-lg bg-brand-950/80 border border-brand-800/60 text-brand-300 text-[11px] font-semibold"
                              >
                                {s.trim()}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Assigned Lead Faculty Mentor
                        </span>
                        <p className="font-semibold text-white mt-0.5">
                          {roleDetails.mentor_first ? `${roleDetails.mentor_first} ${roleDetails.mentor_last}` : 'Jowis Faculty Lead'}
                        </p>
                        <p className="text-[10px] text-brand-400">{roleDetails.mentor_email || 'faculty@jowis.com'}</p>
                      </div>
                    </>
                  )}

                  {isMentor && (
                    <>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Area of Specialization
                        </span>
                        <p className="font-semibold text-white mt-0.5">
                          {roleDetails.specialization || contactForm.specialization || 'Enterprise Architecture'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Instructional Modules
                        </span>
                        <p className="text-slate-300 mt-0.5">
                          {roleDetails.teaching_subjects || contactForm.teachingSubjects || 'Full-Stack Software Engineering'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Qualifications & Accreditation
                        </span>
                        <p className="text-slate-300 mt-0.5">
                          {roleDetails.qualifications || contactForm.qualifications || 'B.Sc / M.Sc Computer Science'}
                        </p>
                      </div>
                    </>
                  )}

                  {isAdmin && (
                    <>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Security Clearance Scope
                        </span>
                        <p className="font-semibold text-white mt-0.5">
                          Level-4 Enterprise Governance & Full System Control
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                          Administrative Jurisdiction
                        </span>
                        <p className="text-slate-300 mt-0.5">
                          Internship Lifecycles, Attendance Verification, Certificate Sign-off, Audit Logs & System Parameters
                        </p>
                      </div>
                    </>
                  )}

                  {/* Biography */}
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                      Professional Statement
                    </span>
                    <p className="text-slate-300 mt-1 italic leading-relaxed">
                      "{roleDetails.bio || contactForm.bio || 'Dedicated technology practitioner committed to engineering excellence at Jowis Studio.'}"
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 4: SYSTEM AUDIT & SECURITY COMPLIANCE */}
              <div className="erp-card p-6 border-slate-800 space-y-4 bg-slate-900/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">System & Audit Telemetry</h4>
                        <p className="text-[10px] text-slate-400">Security compliance & session parameters</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400">Inactivity Timeout:</span>
                      <span className="font-mono font-bold text-amber-400">10 Minutes (600s)</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400">Account Created:</span>
                      <span className="font-mono text-slate-200">
                        {profileData?.created_at ? profileData.created_at.substring(0, 10) : '2026-03-01'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400">Last Active Login:</span>
                      <span className="font-mono text-slate-200">
                        {profileData?.last_login ? profileData.last_login.replace('T', ' ').substring(0, 19) : 'Active Now'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400">Password Policy Status:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Compliant
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Unique User ID:</span>
                  <span className="font-mono text-slate-400">#UID-{String(profileData?.id || 1).padStart(4, '0')}</span>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ACADEMIC & ROLE DETAILS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'academic_role' && (
        <div className="erp-card p-6 border-slate-800 space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-brand-400" />
              <span>
                {isIntern
                  ? 'Track Enrollment & 3-Day Work Schedule'
                  : isMentor
                  ? 'Mentorship Faculty & Assigned Cohorts'
                  : 'Governance & System Administration Overview'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Official institutional parameters, placement records, and schedule compliance.
            </p>
          </div>

          {isIntern && (
            <div className="space-y-6 text-xs">
              {/* 3-Day Schedule Box */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-brand-300 font-bold text-xs uppercase">
                    <Calendar className="w-4 h-4" />
                    <span>Agreed 3-Day Work Schedule</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {roleDetails.schedule_locked ? 'Locked & Active' : 'Flexible'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => {
                    const isScheduled =
                      Array.isArray(roleDetails.schedule_days) && roleDetails.schedule_days.includes(day);
                    return (
                      <div
                        key={day}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          isScheduled
                            ? 'bg-brand-950/60 border-brand-500/60 text-brand-300 font-bold'
                            : 'bg-slate-950/50 border-slate-800 text-slate-500 font-medium'
                        }`}
                      >
                        <span className="capitalize block">{day}</span>
                        <span className="text-[10px] block mt-0.5">
                          {isScheduled ? (day === 'monday' ? 'Compulsory' : 'Agreed Work Day') : 'Off Duty'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Program Track & Cohort Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">Program Track</span>
                  <p className="text-sm font-bold text-white">{roleDetails.track_name || 'Not Enrolled'}</p>
                  <p className="text-[10px] text-brand-400 font-mono">{roleDetails.track_code}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">Assigned Cohort</span>
                  <p className="text-sm font-bold text-white">{roleDetails.cohort_name || 'Not Assigned'}</p>
                  <p className="text-[10px] text-brand-400 font-mono">{roleDetails.cohort_code}</p>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">Lead Mentor</span>
                  <p className="text-sm font-bold text-white">
                    {roleDetails.mentor_first ? `${roleDetails.mentor_first} ${roleDetails.mentor_last}` : 'Unassigned'}
                  </p>
                  <p className="text-[10px] text-slate-400">{roleDetails.mentor_email || 'Jowis Faculty'}</p>
                </div>
              </div>

              {/* Attendance & Tasks KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Days Recorded</span>
                  <p className="text-xl font-black text-white mt-1">{roleDetails.attendance?.total_days || 0}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Present Sessions</span>
                  <p className="text-xl font-black text-emerald-400 mt-1">{roleDetails.attendance?.present_days || 0}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Completed Tasks</span>
                  <p className="text-xl font-black text-brand-400 mt-1">{roleDetails.tasks?.completed_tasks || 0}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Track Tasks</span>
                  <p className="text-xl font-black text-indigo-400 mt-1">{roleDetails.tasks?.total_tasks || 0}</p>
                </div>
              </div>
            </div>
          )}

          {isMentor && (
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">Instructional Domain</span>
                  <p className="text-sm font-bold text-white">{roleDetails.specialization || 'General Mentor'}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">Assigned Interns</span>
                  <p className="text-xl font-black text-brand-400">{roleDetails.assigned_interns_count || 0}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">Verification Status</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Faculty Certified
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Curriculum Teaching Subjects</h4>
                <p className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  {roleDetails.teaching_subjects || 'Microservices, CI/CD, Containerization, Full-Stack Architecture'}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Professional Qualifications</h4>
                <p className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  {roleDetails.qualifications || 'M.Sc Software Engineering, Industry Certified Architect'}
                </p>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total System Users</span>
                  <p className="text-xl font-black text-white mt-1">{roleDetails.total_users || 0}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Active Interns</span>
                  <p className="text-xl font-black text-emerald-400 mt-1">{roleDetails.active_interns || 0}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Faculty Mentors</span>
                  <p className="text-xl font-black text-brand-400 mt-1">{roleDetails.total_mentors || 0}</p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">My Audit Actions</span>
                  <p className="text-xl font-black text-indigo-400 mt-1">{roleDetails.my_actions_count || 0}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <h4 className="font-bold text-white mb-1">Administrative Privileges & Policy Scope</h4>
                <p className="text-slate-400 leading-relaxed">
                  You possess full institutional authority to manage intern lifecycle progressions, cohort assignments, authoritative daily attendance registers, certificate approvals, audit log traceability, and system automations.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY & PASSWORD CHANGE                                         */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="erp-card p-6 border-slate-800 space-y-6">
          <div className="pb-4 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-brand-400" />
              <span>Authentication & Security Credentials</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Change your account password and review session security controls.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Current Password *</label>
              <input
                type="password"
                required
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="erp-input w-full"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">New Permanent Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter new strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="erp-input w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="erp-input w-full"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Password Guidelines:</span>
              <p>• Must be at least 8 characters in length</p>
              <p>• Must contain uppercase (A-Z), lowercase (a-z), number (0-9), and special symbol</p>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-600/30 transition-all"
            >
              <Lock className="w-4 h-4" />
              <span>{savingPassword ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </form>

          {/* Session Overview */}
          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-white">Institutional Session Controls</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-400">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">Account Established</span>
                <p className="text-white font-medium mt-0.5">
                  {profileData?.created_at ? profileData.created_at.replace('T', ' ').substring(0, 19) : 'Active'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block">Inactivity Auto-Logout</span>
                <p className="text-emerald-400 font-medium mt-0.5">10-Minute Security Window Active</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default UniversalProfilePage;
