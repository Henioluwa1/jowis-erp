import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Camera,
  ExternalLink,
  Lock,
  QrCode,
  Sparkles
} from 'lucide-react';

export const DEFAULT_ID_CARD_CONFIGS = {
  intern: {
    roleKey: 'intern',
    title: 'ENGINEERING INTERN',
    badgeTitle: 'INNOVATION FELLOW',
    division: 'Technology & Product Engineering Track',
    themePreset: 'cyber_teal',
    frontCardBg: 'bg-gradient-to-br from-[#061824] via-[#0c2c3e] to-[#040e16] border-2 border-cyan-400/90 shadow-2xl shadow-cyan-500/20 ring-2 ring-cyan-400/40 text-slate-100',
    topBanner: 'bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-700 text-white border-b-2 border-cyan-400/80 shadow-md',
    crestBadge: 'bg-white/20 text-white border-white/40',
    rolePillBg: 'bg-white text-teal-950 font-black shadow-md border border-white/90',
    statusIndicator: 'bg-cyan-400',
    plaqueBg: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 border border-white/90 shadow-xl',
    photoRing: 'bg-gradient-to-tr from-cyan-400 via-teal-300 to-blue-600 shadow-lg shadow-cyan-500/30',
    fallbackAvatar: 'bg-cyan-100 text-cyan-950',
    idBadgeColor: 'bg-cyan-950 text-cyan-200 border-cyan-800 font-mono font-bold',
    statusBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
    deptTextColor: 'text-slate-800 font-semibold',
    chipGrade: 'from-amber-300 via-amber-400 to-yellow-500 text-amber-950 border-amber-400 shadow-sm',
    chipLabel: 'CR80-INTERN-AES256',
    footerBar: 'bg-teal-950/95 border-t border-cyan-500/40 text-slate-300',
    footerHighlight: 'text-cyan-300 font-bold',
    accessLabel: 'FELLOW ACCESS AUTHORIZED',
    accessIconColor: 'text-cyan-400',
    backCardBg: 'bg-gradient-to-br from-[#061824] via-[#0c2c3e] to-[#040e16] border-2 border-cyan-400/90 shadow-2xl shadow-cyan-500/20 ring-2 ring-cyan-400/40 text-slate-100',
    magneticStripe: 'bg-slate-950 border-b border-cyan-500/40',
    magneticText: 'text-cyan-400',
    backPlaque: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-800 border border-white/90 shadow-md',
    hotlineBox: 'bg-cyan-50 border-cyan-200 text-slate-800',
    hotlineWeb: 'text-cyan-700',
    signatureBorder: 'border-cyan-400',
    signatureTitle: 'Director of Internships',
    signatureName: 'Dr. J. Owis',
    barcodeColor: 'text-cyan-300',
    portalAccent: '#06b6d4',
    portalLabel: 'Intern Portal',
    disclaimerText: 'This card is the official property of Jowis Studio. It must be presented upon request at institutional premises, physical standup locations, and technical evaluations.',
    returnAddress: 'Jowis Studio Hub, Lagos, Nigeria',
    supportHotline: '+234 (0) 800-JOWIS-ERP',
    supportWeb: 'https://erp.jowis.com'
  },
  mentor: {
    roleKey: 'mentor',
    title: 'FACULTY MENTOR',
    badgeTitle: 'ACADEMIC FACULTY',
    division: 'Instructional Faculty & Product Mentorship',
    themePreset: 'amethyst_purple',
    frontCardBg: 'bg-gradient-to-br from-[#130b2b] via-[#211149] to-[#0a0618] border-2 border-purple-400/90 shadow-2xl shadow-purple-500/20 ring-2 ring-purple-400/40 text-slate-100',
    topBanner: 'bg-gradient-to-r from-purple-600 via-violet-700 to-indigo-900 text-white border-b-2 border-purple-400/80 shadow-md',
    crestBadge: 'bg-white/20 text-white border-white/40',
    rolePillBg: 'bg-white text-purple-950 font-black shadow-md border border-white/90',
    statusIndicator: 'bg-purple-400',
    plaqueBg: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 border border-white/90 shadow-xl',
    photoRing: 'bg-gradient-to-tr from-purple-400 via-pink-400 to-indigo-600 shadow-lg shadow-purple-500/30',
    fallbackAvatar: 'bg-purple-100 text-purple-950',
    idBadgeColor: 'bg-purple-950 text-purple-200 border-purple-800 font-mono font-bold',
    statusBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
    deptTextColor: 'text-slate-800 font-semibold',
    chipGrade: 'from-amber-300 via-amber-400 to-yellow-500 text-amber-950 border-amber-400 shadow-sm',
    chipLabel: 'CR80-FACULTY-AES256',
    footerBar: 'bg-purple-950/95 border-t border-purple-500/40 text-slate-300',
    footerHighlight: 'text-purple-300 font-bold',
    accessLabel: 'FACULTY ACCESS AUTHORIZED',
    accessIconColor: 'text-purple-400',
    backCardBg: 'bg-gradient-to-br from-[#130b2b] via-[#211149] to-[#0a0618] border-2 border-purple-400/90 shadow-2xl shadow-purple-500/20 ring-2 ring-purple-400/40 text-slate-100',
    magneticStripe: 'bg-slate-950 border-b border-purple-500/40',
    magneticText: 'text-purple-400',
    backPlaque: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-800 border border-white/90 shadow-md',
    hotlineBox: 'bg-purple-50 border-purple-200 text-slate-800',
    hotlineWeb: 'text-purple-700',
    signatureBorder: 'border-purple-400',
    signatureTitle: 'Dean of Faculty',
    signatureName: 'Academic Directorate',
    barcodeColor: 'text-purple-300',
    portalAccent: '#8b5cf6',
    portalLabel: 'Mentor Portal',
    disclaimerText: 'This credential certifies authorized faculty status and mentorship jurisdiction within Jowis Studio systems and training cohorts.',
    returnAddress: 'Jowis Studio Hub, Lagos, Nigeria',
    supportHotline: '+234 (0) 800-JOWIS-ERP',
    supportWeb: 'https://erp.jowis.com'
  },
  admin: {
    roleKey: 'admin',
    title: 'ADMINISTRATOR',
    badgeTitle: 'INSTITUTIONAL ADMIN',
    division: 'Operations & Academic Administration',
    themePreset: 'royal_blue',
    frontCardBg: 'bg-gradient-to-br from-[#09142b] via-[#102246] to-[#060e1e] border-2 border-blue-400/90 shadow-2xl shadow-blue-500/20 ring-2 ring-blue-400/40 text-slate-100',
    topBanner: 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-900 text-white border-b-2 border-blue-400/80 shadow-md',
    crestBadge: 'bg-white/20 text-white border-white/40',
    rolePillBg: 'bg-white text-blue-950 font-black shadow-md border border-white/90',
    statusIndicator: 'bg-blue-400',
    plaqueBg: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 border border-white/90 shadow-xl',
    photoRing: 'bg-gradient-to-tr from-blue-400 via-cyan-300 to-indigo-600 shadow-lg shadow-blue-500/30',
    fallbackAvatar: 'bg-blue-100 text-blue-950',
    idBadgeColor: 'bg-blue-950 text-blue-200 border-blue-800 font-mono font-bold',
    statusBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
    deptTextColor: 'text-slate-800 font-semibold',
    chipGrade: 'from-amber-300 via-amber-400 to-yellow-500 text-amber-950 border-amber-400 shadow-sm',
    chipLabel: 'CR80-ADMIN-AES256',
    footerBar: 'bg-blue-950/95 border-t border-blue-500/40 text-slate-300',
    footerHighlight: 'text-blue-300 font-bold',
    accessLabel: 'OPERATIONS ACCESS AUTHORIZED',
    accessIconColor: 'text-blue-400',
    backCardBg: 'bg-gradient-to-br from-[#09142b] via-[#102246] to-[#060e1e] border-2 border-blue-400/90 shadow-2xl shadow-blue-500/20 ring-2 ring-blue-400/40 text-slate-100',
    magneticStripe: 'bg-slate-950 border-b border-blue-500/40',
    magneticText: 'text-blue-400',
    backPlaque: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-800 border border-white/90 shadow-md',
    hotlineBox: 'bg-blue-50 border-blue-200 text-slate-800',
    hotlineWeb: 'text-blue-700',
    signatureBorder: 'border-blue-400',
    signatureTitle: 'Operations Director',
    signatureName: 'Executive Bureau',
    barcodeColor: 'text-blue-300',
    portalAccent: '#3b82f6',
    portalLabel: 'Admin Portal',
    disclaimerText: 'Institutional Operations credential granting administrative clearance and operational facility access.',
    returnAddress: 'Jowis Studio Hub, Lagos, Nigeria',
    supportHotline: '+234 (0) 800-JOWIS-ERP',
    supportWeb: 'https://erp.jowis.com'
  },
  super_admin: {
    roleKey: 'super_admin',
    title: 'SUPER ADMIN',
    badgeTitle: 'SUPREME GOVERNANCE',
    division: 'Executive Governance & System Security',
    themePreset: 'imperial_gold',
    frontCardBg: 'bg-gradient-to-br from-[#0c0f1c] via-[#141d33] to-[#080b14] border-2 border-amber-400/90 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400/40 text-slate-100',
    topBanner: 'bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-950 text-white border-b-2 border-amber-400/80 shadow-md',
    crestBadge: 'bg-amber-400/25 text-amber-200 border-amber-300/50',
    rolePillBg: 'bg-white text-slate-950 font-black shadow-md border border-white/90',
    statusIndicator: 'bg-amber-400',
    plaqueBg: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 border border-white/90 shadow-xl',
    photoRing: 'bg-gradient-to-tr from-amber-400 via-yellow-300 to-indigo-500 shadow-lg shadow-amber-500/30',
    fallbackAvatar: 'bg-amber-100 text-amber-950',
    idBadgeColor: 'bg-slate-950 text-amber-300 border-amber-500/40 font-mono font-bold',
    statusBadgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
    deptTextColor: 'text-slate-800 font-semibold',
    chipGrade: 'from-amber-300 via-amber-400 to-yellow-500 text-amber-950 border-amber-400 shadow-sm',
    chipLabel: 'CR80-SUPER-AES256',
    footerBar: 'bg-slate-950/95 border-t border-amber-500/40 text-slate-400',
    footerHighlight: 'text-amber-300 font-bold',
    accessLabel: 'SUPREME GOVERNANCE AUTHORIZED',
    accessIconColor: 'text-amber-400',
    backCardBg: 'bg-gradient-to-br from-[#0c0f1c] via-[#141d33] to-[#080b14] border-2 border-amber-400/90 shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400/40 text-slate-100',
    magneticStripe: 'bg-slate-950 border-b border-amber-500/40',
    magneticText: 'text-amber-400',
    backPlaque: 'bg-gradient-to-b from-white via-slate-50 to-white text-slate-800 border border-white/90 shadow-md',
    hotlineBox: 'bg-amber-50 border-amber-200 text-slate-800',
    hotlineWeb: 'text-amber-700',
    signatureBorder: 'border-amber-400',
    signatureTitle: 'Supreme Governance Director',
    signatureName: 'Supreme Council',
    barcodeColor: 'text-amber-300',
    portalAccent: '#f59e0b',
    portalLabel: 'Super Admin Portal',
    disclaimerText: 'Supreme governance access credential granting unrestricted audit, security governance, and cryptographic administration rights.',
    returnAddress: 'Jowis Studio Hub, Lagos, Nigeria',
    supportHotline: '+234 (0) 800-JOWIS-ERP',
    supportWeb: 'https://erp.jowis.com'
  }
};

export const InstitutionalIDCard = ({
  user,
  customConfig,
  cardRole,
  side = 'both', // 'both', 'stacked', 'front', 'back'
  onSideChange,
  showControls = true,
  onChangePhoto,
  onPrint
}) => {
  const [internalSide, setInternalSide] = useState(side);
  const activeSide = onSideChange ? side : internalSide;
  const setActiveSide = onSideChange || setInternalSide;

  // Resolve role
  const resolvedRole = (cardRole || user?.role || user?.role_name || 'intern').toLowerCase();
  const roleKey = ['super_admin', 'admin', 'mentor', 'intern'].includes(resolvedRole)
    ? resolvedRole
    : resolvedRole.includes('admin')
    ? 'admin'
    : resolvedRole.includes('mentor')
    ? 'mentor'
    : 'intern';

  // Merge default config with any custom configuration provided by admin
  const baseConfig = DEFAULT_ID_CARD_CONFIGS[roleKey] || DEFAULT_ID_CARD_CONFIGS.intern;
  const cardConfig = {
    ...baseConfig,
    ...(customConfig || {})
  };

  // User details
  const firstName = user?.first_name || user?.firstName || 'Authorized';
  const lastName = user?.last_name || user?.lastName || 'Member';
  const fullName = `${firstName} ${lastName}`.trim();
  const avatarUrl = user?.avatar_url || user?.avatarUrl;

  const institutionalId =
    user?.intern_code ||
    user?.internCode ||
    (roleKey === 'intern'
      ? 'JOWIS-INT-2026-001'
      : roleKey === 'mentor'
      ? `JOWIS-MTR-${String(user?.id || 1).padStart(3, '0')}`
      : `JOWIS-ADM-${String(user?.id || 1).padStart(3, '0')}`);

  const departmentTrack =
    user?.track_name ||
    user?.trackName ||
    user?.specialization ||
    cardConfig.division ||
    'Technology & Product Engineering Track';

  const issueDate = user?.start_date || user?.startDate || '2026-01-15';
  const expiryDate = user?.expected_end_date || user?.expectedEndDate || '2026-12-31';

  // Verification URL encoded inside the QR Code
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://erp.jowis.com';
  const verificationUrl = `${origin}/verify/id/${encodeURIComponent(institutionalId)}`;

  const handlePrint = (printSide = activeSide) => {
    if (onPrint) {
      onPrint(printSide);
      return;
    }
    document.body.classList.add('printing-id-card');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-id-card');
    }, 1000);
  };

  return (
    <div className="w-full space-y-4">
      {/* Presentation Controls (Layout Mode & Print Buttons) */}
      {showControls && (
        <div className="flex items-center justify-between flex-wrap gap-3 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs no-print shadow-lg">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-400" />
            <span className="font-bold text-slate-200">Card Layout Presentation:</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              (Front & Back isolated in distinct pedestal frames)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSide('both')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSide === 'both' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="View both sides side-by-side"
              >
                Both Sides
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('stacked')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSide === 'stacked' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="View both sides stacked vertically"
              >
                Stacked
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('front')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSide === 'front' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="View front badge only"
              >
                Front Only
              </button>
              <button
                type="button"
                onClick={() => setActiveSide('back')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeSide === 'back' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="View back badge only"
              >
                Back Only
              </button>
            </div>

            <button
              type="button"
              onClick={() => handlePrint(activeSide)}
              className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-brand-600/30 transition-all"
              title="Print official CR80 badge"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Badge</span>
            </button>
          </div>
        </div>
      )}

      {/* ID Card Display Grid */}
      <div
        className={`id-card-print-grid grid gap-8 xl:gap-12 w-full mx-auto py-2 items-start justify-items-center ${
          activeSide === 'both' ? 'grid-cols-1 xl:grid-cols-2 max-w-5xl' : 'grid-cols-1 max-w-xl'
        }`}
      >
        {/* ----------------- ID CARD FRONT ----------------- */}
        {(activeSide === 'both' || activeSide === 'stacked' || activeSide === 'front') && (
          <div className="id-card-wrapper w-full max-w-[460px] flex flex-col items-center bg-slate-900/70 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-sm transition-all hover:border-slate-700/80">
            <div className="w-full flex items-center justify-between text-xs font-bold text-slate-300 mb-4 px-1 no-print">
              <span className="flex items-center gap-2 text-brand-400 font-mono tracking-wider">
                <CreditCard className="w-4 h-4" /> FRONT SIDE (OBVERSE BADGE)
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-mono px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                CR80 • PHOTO BADGE
              </span>
            </div>

            <div
              className={`id-card-render-box w-full rounded-2xl sm:rounded-3xl ${cardConfig.frontCardBg} p-0 relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all`}
              style={{ minHeight: '300px' }}
            >
              {/* Top Banner (Signature color bar mixed with crisp styling) */}
              <div className={`p-3.5 ${cardConfig.topBanner} flex items-center justify-between relative`}>
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg ${cardConfig.crestBadge} backdrop-blur-md flex items-center justify-center font-black text-sm shadow-md`}
                  >
                    J
                  </div>
                  <div>
                    <h4 className="text-xs font-black tracking-wider text-white">JOWIS STUDIO</h4>
                    <p className="text-[8px] uppercase tracking-widest text-white/90 font-bold">{cardConfig.division}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${cardConfig.rolePillBg}`}
                  >
                    {cardConfig.title}
                  </span>
                </div>
              </div>

              {/* Card Body: Luminous Clean White Cardstock Plaque embedded into Portal Background */}
              <div className="px-4 py-2 my-auto relative z-10">
                <div className={`p-3.5 sm:p-4 rounded-2xl ${cardConfig.plaqueBg} flex items-center gap-4`}>
                  {/* Photo Frame with Portal Ring */}
                  <div className="relative group/cardphoto flex-shrink-0">
                    <div className={`w-20 h-24 sm:w-24 sm:h-28 rounded-2xl p-0.5 ${cardConfig.photoRing} overflow-hidden`}>
                      <div className="w-full h-full bg-white rounded-[14px] overflow-hidden flex flex-col items-center justify-center text-center relative">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Badge Photo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}

                        {/* Fallback Initials */}
                        <div
                          className={`w-full h-full flex flex-col items-center justify-center p-1 ${cardConfig.fallbackAvatar} ${
                            avatarUrl ? 'hidden' : 'flex'
                          }`}
                        >
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/80 shadow-inner flex items-center justify-center text-slate-900 font-black text-sm sm:text-base mb-0.5">
                            {firstName?.[0]}
                            {lastName?.[0]}
                          </div>
                          <span className="text-[7px] font-mono font-bold uppercase">OFFICIAL</span>
                          <span className="text-[7px] text-emerald-600 font-bold">VERIFIED</span>
                        </div>

                        {/* Quick upload trigger on hover if handler provided */}
                        {onChangePhoto && (
                          <button
                            type="button"
                            onClick={onChangePhoto}
                            className="no-print absolute inset-0 bg-slate-950/80 opacity-0 group-hover/cardphoto:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                            title="Upload/change ID badge photo"
                          >
                            <Camera className="w-5 h-5 text-white mb-0.5" />
                            <span className="text-[8px] font-bold uppercase">Change</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Identity Metadata (High-contrast typography) */}
                  <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">
                        Authorized Personnel
                      </span>
                      <p className="text-sm sm:text-base font-black text-slate-950 truncate leading-tight">
                        {fullName}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">ID Code</span>
                        <p className={`text-[10px] px-1.5 py-0.5 rounded truncate inline-block ${cardConfig.idBadgeColor}`}>
                          {institutionalId}
                        </p>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">Status</span>
                        <span
                          className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${cardConfig.statusBadgeColor}`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ACTIVE
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold block">
                        Assignment / Track
                      </span>
                      <p className={`text-[10px] sm:text-[11px] truncate ${cardConfig.deptTextColor}`}>
                        {departmentTrack}
                      </p>
                    </div>

                    {/* Micro Chip & Security Tag */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-5 rounded bg-gradient-to-tr ${cardConfig.chipGrade} flex items-center justify-center text-[6px] font-mono font-black`}
                        >
                          CHIP
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-mono font-bold text-slate-500 tracking-wider">
                          {cardConfig.chipLabel}
                        </span>
                      </div>

                      {/* Small Quick-Scan QR indicator on front */}
                      <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-300 shadow-xs" title="Institutional Digital Security Tag">
                        <QrCode className="w-3 h-3 text-slate-700" />
                        <span className="text-[7px] font-mono font-bold text-slate-600 uppercase">E-SEAL</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Bar */}
              <div className={`py-2 px-5 ${cardConfig.footerBar} flex items-center justify-between text-[9px] font-mono`}>
                <div>
                  <span className="opacity-70">ISSUED: </span>
                  <strong className={cardConfig.footerHighlight}>{issueDate}</strong>
                </div>
                <div className="flex items-center gap-1 font-bold">
                  <ShieldCheck className={`w-3 h-3 ${cardConfig.accessIconColor}`} />
                  <span className="text-white text-[8px] tracking-wider">{cardConfig.accessLabel}</span>
                </div>
                <div>
                  <span className="opacity-70">EXPIRES: </span>
                  <strong className={cardConfig.footerHighlight}>{expiryDate}</strong>
                </div>
              </div>
            </div>

            {/* Pedestal Bottom Metadata & Quick Print */}
            <div className="w-full mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 no-print">
              <span className="font-mono text-slate-500">CR80 • 85.60 × 53.98 mm</span>
              <button
                type="button"
                onClick={() => handlePrint('front')}
                className="text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Print Front badge individually"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Front Only</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------- ID CARD BACK ----------------- */}
        {(activeSide === 'both' || activeSide === 'stacked' || activeSide === 'back') && (
          <div className="id-card-wrapper w-full max-w-[460px] flex flex-col items-center bg-slate-900/70 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-sm transition-all hover:border-slate-700/80">
            <div className="w-full flex items-center justify-between text-xs font-bold text-slate-300 mb-4 px-1 no-print">
              <span className="flex items-center gap-2 text-purple-400 font-mono tracking-wider">
                <ShieldCheck className="w-4 h-4" /> BACK SIDE (SECURITY REVERSE)
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-mono px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                CR80 • QR CODE & BARCODE
              </span>
            </div>

            <div
              className={`id-card-render-box w-full rounded-2xl sm:rounded-3xl ${cardConfig.backCardBg} p-0 relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all`}
              style={{ minHeight: '300px' }}
            >
              {/* Magnetic Stripe representation */}
              <div className={`h-10 ${cardConfig.magneticStripe} flex items-center px-6`}>
                <div className="w-full h-4 bg-slate-900 rounded flex items-center justify-between px-2">
                  <span className={`font-mono text-[8px] tracking-widest ${cardConfig.magneticText}`}>
                    JOWIS-SEC-CR80-E2EE-ENCRYPTED-ID
                  </span>
                  <span className="font-mono text-[7px] text-slate-500 uppercase tracking-widest">
                    AES-GCM-256
                  </span>
                </div>
              </div>

              {/* Terms of Card & Official QR Code Block */}
              <div className="px-4 py-2 my-auto">
                <div className={`p-3 sm:p-3.5 rounded-2xl ${cardConfig.backPlaque} flex items-center gap-3.5`}>
                  {/* High-Resolution Scannable Vector QR Code */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-slate-300 shadow-md">
                    <QRCodeSVG
                      value={verificationUrl}
                      size={70}
                      level="M"
                      includeMargin={false}
                    />
                    <div className="flex items-center gap-1 mt-1 text-[7px] font-mono font-black text-slate-800 uppercase tracking-wider">
                      <QrCode className="w-2.5 h-2.5 text-brand-600" />
                      <span>SCAN TO VERIFY</span>
                    </div>
                  </div>

                  {/* Terms & Return Text */}
                  <div className="flex-1 min-w-0 space-y-1.5 text-[9px]">
                    <p className="leading-snug text-slate-700">
                      {cardConfig.disclaimerText ||
                        'This card is the official property of Jowis Studio. It must be presented upon request at institutional premises, physical standup locations, and technical evaluations.'}
                    </p>
                    <div className={`p-2 rounded-xl ${cardConfig.hotlineBox} space-y-0.5`}>
                      <p className="text-[8px] leading-tight">
                        Return: <strong className="text-slate-900">{cardConfig.returnAddress || 'Jowis Studio Hub, Lagos, Nigeria'}</strong>
                      </p>
                      <p className="text-[8px] leading-tight">
                        Hotline: <strong className="text-slate-900">{cardConfig.supportHotline || '+234 (0) 800-JOWIS-ERP'}</strong>
                      </p>
                      <p className="text-[8px] leading-tight truncate">
                        Web: <strong className={cardConfig.hotlineWeb}>{cardConfig.supportWeb || 'https://erp.jowis.com'}</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signature Line & Barcode */}
              <div className={`py-2 px-5 ${cardConfig.footerBar} flex items-end justify-between`}>
                <div className="space-y-0.5">
                  <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                    Authorized Signatory
                  </span>
                  <div className={`w-32 h-6 border-b border-dashed ${cardConfig.signatureBorder} flex items-end justify-between`}>
                    <span className="font-serif italic text-xs text-white font-bold">
                      {cardConfig.signatureName || 'Dr. J. Owis'}
                    </span>
                    <span className="text-[7px] text-slate-400 font-mono">{cardConfig.signatureTitle || 'Director'}</span>
                  </div>
                </div>

                {/* Simulated Barcode */}
                <div className="text-right">
                  <div className={`font-mono tracking-widest text-xs font-black ${cardConfig.barcodeColor}`}>
                    ||| | |||| | ||| || ||||
                  </div>
                  <span className="font-mono text-[8px] text-slate-400 tracking-widest">{institutionalId}</span>
                </div>
              </div>
            </div>

            {/* Pedestal Bottom Metadata & Quick Print */}
            <div className="w-full mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 no-print">
              <span className="font-mono text-slate-500">E2EE Magnetic Security Chip</span>
              <button
                type="button"
                onClick={() => handlePrint('back')}
                className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Print Reverse side individually"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Reverse Only</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstitutionalIDCard;
