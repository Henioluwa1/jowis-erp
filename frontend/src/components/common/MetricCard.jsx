import React from 'react';

export const MetricCard = ({ title, value, subtext, icon: Icon, color = 'brand', trend }) => {
  const colorMap = {
    brand: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/30',
    emerald: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30',
    amber: 'text-amber-400 bg-amber-950/40 border-amber-800/30',
    rose: 'text-rose-400 bg-rose-950/40 border-rose-800/30',
    cyan: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/30'
  };

  const iconStyles = colorMap[color] || colorMap.brand;

  return (
    <div className="erp-card p-5 hover:border-slate-700 transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        {Icon && (
          <div className={`p-2.5 rounded-lg border ${iconStyles}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend.value}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1.5 text-xs text-slate-400">{subtext}</p>}
    </div>
  );
};
