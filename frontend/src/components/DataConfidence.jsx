import React from 'react';
import { ShieldCheck, Link2, RadioTower } from 'lucide-react';

// Compact trust strip — makes the "this is real, verifiable data" pitch visible
// at a glance. Every figure is derived from live data the dashboard already holds.
function Stat({ value, label }) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="num font-semibold text-[13px]" style={{ color: 'var(--text)' }}>{value}</span>
      <span className="eyebrow">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="hidden sm:block w-px h-3.5 self-center" style={{ background: 'var(--border-2)' }} />;
}

export default function DataConfidence({ stats, sourceRatings }) {
  const total = stats?.totalReviews ?? 0;
  const channels = (sourceRatings || []).length;
  const days = stats?.sentimentByDay || [];
  const newestRaw = days.length ? days[days.length - 1].day : null;
  const newest = newestRaw
    ? new Date(newestRaw + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  if (!total) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-3 rounded-2xl mb-5"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      {/* Live signal */}
      <div className="flex items-center gap-2">
        <span className="relative flex items-center justify-center w-6 h-6 rounded-lg" style={{ background: 'color-mix(in srgb, var(--pos) 14%, transparent)' }}>
          <RadioTower size={13} style={{ color: 'var(--pos)' }} />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--pos)', color: 'var(--pos)' }} />
        </span>
        <span className="text-[13px] font-semibold" style={{ color: 'var(--pos)' }}>Real data</span>
      </div>

      <Divider />
      <Stat value={total.toLocaleString()} label="verified reviews" />
      <Divider />
      <Stat value={channels} label="live channels" />
      {newest && (<><Divider /><Stat value={newest} label="newest review" /></>)}

      <div className="flex items-center gap-4 ml-auto">
        <span className="flex items-center gap-1.5 eyebrow" style={{ color: 'var(--text-dim)' }}>
          <Link2 size={12} style={{ color: 'var(--accent)' }} /> Every review links to source
        </span>
        <span className="hidden md:flex items-center gap-1.5 eyebrow" style={{ color: 'var(--text-dim)' }}>
          <ShieldCheck size={12} style={{ color: 'var(--accent)' }} /> No sample data
        </span>
      </div>
    </div>
  );
}
