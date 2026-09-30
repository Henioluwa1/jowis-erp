import React from 'react';
import { Loader2, Shield } from 'lucide-react';

export const PageLoadingFallback = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center">
        {/* Glowing background ring */}
        <div className="absolute w-20 h-20 bg-brand-500/20 rounded-full blur-xl animate-pulse" />
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center relative">
          <Shield className="w-6 h-6 text-brand-400 opacity-60" />
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin absolute" />
        </div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 font-mono">
          Jowis Studio ERP
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Loading modular workspace...
        </p>
      </div>
    </div>
  );
};
