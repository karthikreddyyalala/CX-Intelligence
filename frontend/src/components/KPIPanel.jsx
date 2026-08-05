import React, { useEffect, useState } from 'react';
import { MessageSquare, Star, TrendingUp, AlertTriangle } from 'lucide-react';

function useCountUp(target, ms = 1000) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!target) { setN(0); return; }
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / ms, 1);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return n;
}

function Tile({ label, display, rawNumber, sub, icon: Icon, tone, delta }) {
  const animated = useCountUp(typeof rawNumber === 'number' ? rawNumber : 0);
  const toneColor = tone === 'pos' ? 'var(--pos)' : tone === 'neg' ? 'var(--neg)' : 'var(--text)';
  return (
    <div className="tile tile-hover p-5 flex flex-col justify-between min-h-[152px]">
      <div className="flex items-start justify-between">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
          <Icon size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
        </span>
        {delta != null && (
          <span className="num text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: delta >= 0 ? 'var(--pos)' : 'var(--neg)', background: `color-mix(in srgb, ${delta >= 0 ? 'var(--pos)' : 'var(--neg)'} 12%, transparent)` }}>
            {delta >= 0 ? '+' : ''}{delta}
          </span>
        )}
      </div>
      <div>
        <p className="num font-display font-bold tracking-tight leading-none text-[34px]" style={{ color: toneColor }}>
          {typeof rawNumber === 'number' ? animated.toLocaleString() : display}
        </p>
        <p className="eyebrow mt-2">{label}</p>
        {sub && <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-faint)' }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function KPIPanel({ stats, sourceRatings }) {
  const total = stats?.totalReviews ?? 0;
  const pos = stats?.positiveCount ?? 0;
  const neg = stats?.negativeCount ?? 0;
  const posP = total ? Math.round((pos / total) * 100) : 0;
  const negP = total ? Math.round((neg / total) * 100) : 0;
  const painPoints = stats?.activePainPoints ?? 0;

  const rated = (sourceRatings || []).filter(s => s.avgRating);
  const overall = rated.length
    ? (rated.reduce((a, s) => a + s.avgRating, 0) / rated.length).toFixed(1)
    : null;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5 stagger">
      <Tile label="Total mentions" rawNumber={total}
        sub={`across ${(sourceRatings || []).length} platforms`} icon={MessageSquare} />
      <Tile label="Brand rating" display={overall ? `${overall}` : '—'}
        sub={overall ? `avg across ${rated.length} rated sources` : 'awaiting analysis'} icon={Star}
        tone={overall && overall >= 3.5 ? 'pos' : overall && overall < 2.75 ? 'neg' : undefined} />
      <Tile label="Positive sentiment" rawNumber={posP} display={`${posP}%`}
        sub={`${pos.toLocaleString()} happy customers`} icon={TrendingUp} tone="pos" />
      <Tile label="Active complaints" rawNumber={negP} display={`${negP}%`}
        sub={`${neg.toLocaleString()} negative · ${painPoints} focus areas`} icon={AlertTriangle} tone="neg" />
    </div>
  );
}
