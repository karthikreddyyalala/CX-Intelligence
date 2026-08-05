import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts';

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="panel px-3 py-2.5 text-[12px]" style={{ minWidth: 140 }}>
      <p className="font-display font-bold mb-1.5" style={{ color: 'var(--text)' }}>{d?.source}</p>
      <p className="num" style={{ color: 'var(--text-dim)' }}>{d?.count} reviews</p>
      {d?.avgRating ? <p className="num mt-0.5" style={{ color: 'var(--accent)' }}>{d.avgRating} avg rating</p> : null}
      {d?.negative > 0 ? <p className="num mt-0.5" style={{ color: 'var(--neg)' }}>{d.negative} complaints</p> : null}
      {d?.positive > 0 ? <p className="num mt-0.5" style={{ color: 'var(--pos)' }}>{d.positive} positive</p> : null}
    </div>
  );
};

export default function VolumeChart({ data, onSourceClick }) {
  if (!data?.length) {
    return (
      <div className="panel h-72 flex flex-col items-center justify-center gap-1.5">
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No volume data yet.</p>
        <p className="eyebrow">Run AI Analysis to break down volume by platform</p>
      </div>
    );
  }
  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display font-bold text-[14px]" style={{ color: 'var(--text)' }}>Volume by platform</p>
        <p className="eyebrow">click a bar to filter</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 6, left: -22, bottom: 34 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="source" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} angle={-28} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<Tip />} cursor={{ fill: 'var(--accent-soft)' }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} cursor="pointer" maxBarSize={44} onClick={d => onSourceClick?.(d.source)}>
            {data.map((_, i) => <Cell key={i} fill="var(--accent)" fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
