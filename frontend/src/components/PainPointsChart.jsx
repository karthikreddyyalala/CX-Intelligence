import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';

// Single-hue severity ramp — complaints are negative; intensity encodes impact.
function severity(score) {
  const o = 0.4 + 0.6 * Math.min(score / 100, 1);
  return `color-mix(in srgb, var(--neg) ${Math.round(o * 100)}%, transparent)`;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="panel px-3 py-2.5 text-[12px]" style={{ maxWidth: 220 }}>
      <p className="font-display font-bold capitalize mb-1" style={{ color: 'var(--text)' }}>{d?.theme_name}</p>
      <p className="num" style={{ color: 'var(--neg)' }}>Impact {d?.impact_score}/100</p>
      <p className="num mt-0.5" style={{ color: 'var(--text-dim)' }}>{d?.frequency}× mentioned · {Math.round((d?.negative_ratio || 0) * 100)}% negative</p>
    </div>
  );
};

export default function PainPointsChart({ data, onPainPointClick }) {
  if (!data?.length) {
    return (
      <div className="panel h-56 flex flex-col items-center justify-center gap-1.5">
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No pain points detected yet.</p>
        <p className="eyebrow">Run AI Analysis to surface complaint themes</p>
      </div>
    );
  }
  const chartData = data.slice(0, 10).map(p => ({
    ...p, theme_name: p.theme_name.length > 24 ? p.theme_name.slice(0, 24) + '…' : p.theme_name,
  }));

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Ranked by impact · click a bar to drill into the feed</p>
        <div className="flex items-center gap-2 num text-[11px]" style={{ color: 'var(--text-faint)' }}>
          <span className="w-6 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb,var(--neg) 40%,transparent), var(--neg))' }} />
          low → high
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 42)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 44, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="theme_name" width={132}
            tick={{ fill: 'var(--text-dim)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-soft)' }} />
          {/* Animation off: the chart can mount off-screen, where Recharts ends the
              grow-in early and leaves bars short of their true value. */}
          <Bar dataKey="impact_score" radius={[0, 7, 7, 0]} cursor="pointer" isAnimationActive={false}
            onClick={d => onPainPointClick?.(d.theme_name)}
            label={{ position: 'right', fontSize: 11, fill: 'var(--text-dim)', fontFamily: 'Geist Mono' }}>
            {chartData.map((e, i) => <Cell key={i} fill={severity(e.impact_score)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
