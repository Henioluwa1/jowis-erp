import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Clock, LogOut, User } from 'lucide-react';

export const Header = () => {
  const { user, logout } = useAuth();
  const [lagosTime, setLagosTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Africa/Lagos',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setLagosTime(new Intl.DateTimeFormat('en-US', options).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: Organization Clock */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium text-slate-300">
          <Clock className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
          <span>Lagos Server Time:</span>
          <span className="font-mono font-bold text-brand-300">{lagosTime || 'Loading...'}</span>
          <span className="text-[10px] text-slate-500 border-l border-slate-700 pl-2">UTC+1</span>
        </div>
        <div className="hidden md:flex items-center text-xs text-slate-400">
          Cutoff: <span className="text-amber-400 font-semibold ml-1">09:00:00 AM</span>
        </div>
      </div>

      {/* Right: User Profile & Logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-300 font-bold text-xs">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-white leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[10px] text-slate-400 capitalize">
              {user?.internCode || user?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-800/50 transition-all duration-150 flex items-center gap-1.5 text-xs font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};
