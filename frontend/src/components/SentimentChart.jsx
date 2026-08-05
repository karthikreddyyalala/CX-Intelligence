import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel px-3 py-2.5 text-[12px]">
      <p className="num font-semibold mb-1.5" style={{ color: 'var(--text)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-5 mb-0.5">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />{p.name}
          </span>
          <span className="num font-semibold" style={{ color: 'var(--text)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function SentimentChart({ data }) {
  const chartData = (data || []).map(d => ({
    date: (d.day || d.date || '').slice(5),
    Positive: d.positive || 0, Neutral: d.neutral || 0, Negative: d.negative || 0,
  }));

  if (!chartData.length) {
    return (
      <div className="panel h-72 flex flex-col items-center justify-center gap-1.5">
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No trend data yet.</p>
        <p className="eyebrow">Run AI Analysis to chart sentiment over time</p>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display font-bold text-[14px]" style={{ color: 'var(--text)' }}>Sentiment trend</p>
        <div className="flex gap-3 num text-[11px]">
          {[['Positive', 'var(--pos)'], ['Neutral', 'var(--neu)'], ['Negative', 'var(--neg)']].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
              <span className="w-2.5 h-0.5 rounded" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 6, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--pos)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--pos)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neg)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--neg)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<Tip />} />
          <Area type="monotone" dataKey="Positive" stroke="var(--pos)" strokeWidth={2} fill="url(#gp)" dot={false} />
          <Area type="monotone" dataKey="Neutral" stroke="var(--neu)" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 3" />
          <Area type="monotone" dataKey="Negative" stroke="var(--neg)" strokeWidth={2} fill="url(#gn)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
