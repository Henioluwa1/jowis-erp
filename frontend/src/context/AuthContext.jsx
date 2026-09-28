import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { Clock, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

const AuthContext = createContext(null);

// Inactivity configuration (10 minutes total, 60s warning window)
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_WINDOW_MS = 60 * 1000; // 1 minute warning
const WARNING_START_MS = INACTIVITY_TIMEOUT_MS - WARNING_WINDOW_MS; // 9 minutes

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('jowis_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Inactivity tracking state
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const lastActivityRef = useRef(Date.now());
  const lastThrottleRef = useRef(0);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('jowis_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data.success) {
          setUser(res.data.user);
        } else {
          logout();
        }
      } catch (err) {
        console.error('Session validation failed:', err);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const resetInactivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showInactivityWarning) {
      setShowInactivityWarning(false);
    }
  }, [showInactivityWarning]);

  const logout = useCallback(async (reason = '') => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Continue client cleanup even if request fails
    }
    localStorage.removeItem('jowis_token');
    localStorage.removeItem('jowis_user');
    setToken(null);
    setUser(null);
    setShowInactivityWarning(false);
    lastActivityRef.current = Date.now();

    if (reason === 'inactivity') {
      window.location.href = '/login?reason=inactivity';
    }
  }, []);

  // Global activity listener
  useEffect(() => {
    if (!token || !user) return;

    const recordActivity = () => {
      const now = Date.now();
      // Throttle recording to at most once every 1.5 seconds
      if (now - lastThrottleRef.current > 1500) {
        lastThrottleRef.current = now;
        lastActivityRef.current = now;
        if (showInactivityWarning) {
          setShowInactivityWarning(false);
        }
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
    };
  }, [token, user, showInactivityWarning]);

  // Periodic inactivity interval check (every 1 second)
  useEffect(() => {
    if (!token || !user) {
      setShowInactivityWarning(false);
      return;
    }

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;

      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        // Inactivity limit reached -> Auto logout immediately
        clearInterval(checkInterval);
        logout('inactivity');
      } else if (idleTime >= WARNING_START_MS) {
        // Warning threshold reached -> show countdown
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - idleTime) / 1000));
        setSecondsRemaining(remaining);
        setShowInactivityWarning(true);
      } else {
        if (showInactivityWarning) {
          setShowInactivityWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [token, user, logout, showInactivityWarning]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token: newToken, user: userData } = res.data;
        localStorage.setItem('jowis_token', newToken);
        localStorage.setItem('jowis_user', JSON.stringify(userData));
        setToken(newToken);
        setUser(userData);
        lastActivityRef.current = Date.now();
        return { success: true, user: userData };
      }
      return { success: false, message: res.data.message };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please check credentials.';
      return { success: false, message };
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
        localStorage.setItem('jowis_user', JSON.stringify(res.data.user));
        return res.data.user;
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
    return null;
  };

  const updateUserState = (fields) => {
    if (user) {
      const updated = { ...user, ...fields };
      setUser(updated);
      localStorage.setItem('jowis_user', JSON.stringify(updated));
    }
  };

  const clearPasswordChangeRequirement = () => {
    if (user) {
      const updated = { ...user, mustChangePassword: false };
      setUser(updated);
      localStorage.setItem('jowis_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated: !!user && !!token,
        mustChangePassword: Boolean(user?.mustChangePassword),
        isLoading,
        login,
        logout,
        refreshUser,
        updateUserState,
        clearPasswordChangeRequirement,
        resetInactivity
      }}
    >
      {children}

      {/* 10-Minute Inactivity Warning Modal Overlay */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-amber-500/10 text-slate-100 relative overflow-hidden">
            {/* Top Amber Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Session Timeout Warning
                </h3>
                <p className="text-xs text-slate-400">
                  You have been inactive for over 9 minutes. For institutional security, your session will automatically terminate.
                </p>
              </div>
            </div>

            {/* Countdown Box */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-6 text-center">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Automatic Logout In
              </span>
              <div className="text-4xl font-black font-mono text-amber-400 tracking-wider">
                00:{String(secondsRemaining).padStart(2, '0')}
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(secondsRemaining / 60) * 100}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={resetInactivity}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Keep Me Signed In</span>
              </button>
              <button
                type="button"
                onClick={() => logout('manual')}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-800 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
