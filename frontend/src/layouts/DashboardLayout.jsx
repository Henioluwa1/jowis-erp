import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { FirstLoginModal } from '../components/common/FirstLoginModal';
import { LoginBriefingModal } from '../components/common/LoginBriefingModal';
import { LiveChatWidget } from '../components/chat/LiveChatWidget';

export const DashboardLayout = () => {
  const { role } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Portal Theme Class Selector (UI/UX Pro Max)
  const portalThemeClass =
    role === 'super_admin'
      ? 'portal-theme-super_admin'
      : role === 'mentor'
      ? 'portal-theme-mentor'
      : role === 'intern'
      ? 'portal-theme-intern'
      : 'portal-theme-admin';

  // Dynamic Content Gradient per Portal
  const contentGradientClass =
    role === 'super_admin'
      ? 'bg-gradient-to-b from-[#06080f] via-[#0d1322] to-[#04060a]'
      : role === 'mentor'
      ? 'bg-gradient-to-b from-[#0a0718] via-[#140e2b] to-[#070512]'
      : role === 'intern'
      ? 'bg-gradient-to-b from-[#051017] via-[#0a1e2a] to-[#040d13]'
      : 'bg-gradient-to-b from-[#070b14] via-[#0e1628] to-[#05080f]';

  // Ambient Glow Color
  const primaryOrbColor =
    role === 'super_admin'
      ? '#f59e0b'
      : role === 'mentor'
      ? '#8b5cf6'
      : role === 'intern'
      ? '#06b6d4'
      : '#2563eb';

  const secondaryOrbColor =
    role === 'super_admin'
      ? '#3b82f6'
      : role === 'mentor'
      ? '#ec4899'
      : role === 'intern'
      ? '#10b981'
      : '#60a5fa';

  return (
    <div className={`flex h-screen text-slate-100 overflow-hidden relative ${portalThemeClass}`}>
      {/* Dynamic Ambient Background Orbs */}
      <div
        className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-20 transition-all duration-700 -mr-40 -mt-40 z-0"
        style={{ background: primaryOrbColor }}
      />
      <div
        className="fixed bottom-0 left-1/3 w-[450px] h-[450px] rounded-full blur-[160px] pointer-events-none opacity-15 transition-all duration-700 -mb-40 z-0"
        style={{ background: secondaryOrbColor }}
      />

      {/* Forced First-Login Modal Overlay */}
      <FirstLoginModal />

      {/* Daily Briefing / Important Reminder Popup Modal */}
      <LoginBriefingModal />

      {/* Floating E2EE Live Chat Widget (Always visible across all pages) */}
      <LiveChatWidget />

      {/* Responsive Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden z-10">
        <Header onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 transition-colors duration-300 ${contentGradientClass}`}>
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
