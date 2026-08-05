import React, { useRef } from 'react';
import { TrendingUp, TrendingDown, Star, Plus } from 'lucide-react';
import SourceIcon from './SourceIcon';

// Review platforms on the roadmap but not yet connected — shown so leadership
// sees the full coverage plan. Flip live once a paid/approved actor is enabled.
// (Social channels like Facebook / X are intentionally excluded — those are
// covered by Sprout; this tool owns review-and-rating platforms.)
const PLANNED = ['Yelp', 'ConsumerAffairs', 'BBB', 'TripAdvisor'];

function PlannedCard({ source }) {
  return (
    <div className="tile p-4 w-full" style={{ borderStyle: 'dashed', opacity: 0.7 }}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--text-faint)' }}>
          <SourceIcon source={source} size={15} />
        </span>
        <span className="badge" style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb,var(--accent) 30%,transparent)', background: 'var(--accent-soft)' }}>
          <Plus size={10} /> Planned
        </span>
      </div>
      <p className="eyebrow mb-1 truncate">{source}</p>
      <p className="font-display font-bold text-[22px] leading-none" style={{ color: 'var(--text-faint)' }}>—</p>
      <p className="text-[11px] mt-3" style={{ color: 'var(--text-faint)' }}>Not yet connected</p>
    </div>
  );
}

function Stars({ value }) {
  if (!value) return null;
  const full = Math.round(value);
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} strokeWidth={0}
          fill={i <= full ? 'var(--accent)' : 'var(--border-2)'} />
      ))}
    </div>
  );
}

function SentimentBar({ positive, neutral, negative }) {
  const total = (positive || 0) + (neutral || 0) + (negative || 0);
  if (!total) return <div className="h-1 rounded-full mt-2.5" style={{ background: 'var(--border)' }} />;
  const p = (positive / total) * 100, n = (neutral / total) * 100;
  return (
    <div className="flex h-1 rounded-full overflow-hidden mt-2.5 gap-px">
      <div style={{ width: `${p}%`, background: 'var(--pos)' }} />
      <div style={{ width: `${n}%`, background: 'var(--neu)' }} />
      <div style={{ width: `${100 - p - n}%`, background: 'var(--neg)' }} />
    </div>
  );
}

function Card({ d, onClick }) {
  const trend = d.ratingTrend;
  const hasRating = d.avgRating != null;
  const ref = useRef(null);
  // Cursor-follow spotlight — a soft accent glow tracks the pointer on hover.
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <button ref={ref} onMouseMove={onMove} onClick={() => onClick?.(d.source)}
      className="tile tile-hover p-4 text-left w-full group relative overflow-hidden">
      <span aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'radial-gradient(240px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, var(--accent) 13%, transparent), transparent 65%)' }} />
      <div className="flex items-center justify-between mb-3 relative">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          <SourceIcon source={d.source} size={15} />
        </span>
        <span className="num text-[11px]" style={{ color: 'var(--text-faint)' }}>
          {d.recentCount > 0 ? `+${d.recentCount} new` : `${d.totalReviews}`}
        </span>
      </div>

      <p className="eyebrow mb-1 truncate">{d.source}</p>

      {hasRating ? (
        <div className="flex items-end gap-1.5">
          <span className="num font-display font-bold leading-none text-[26px]" style={{ color: 'var(--text)' }}>{d.avgRating}</span>
          <span className="num text-[11px] mb-0.5" style={{ color: 'var(--text-faint)' }}>/ 5</span>
          {trend != null && trend !== 0 && (
            <span className="num text-[11px] font-semibold mb-0.5 flex items-center gap-0.5"
              style={{ color: trend > 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(trend)}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: 'var(--text-faint)' }}>Social mentions</p>
      )}

      {hasRating && <div className="mt-2"><Stars value={d.avgRating} /></div>}
      <SentimentBar positive={d.positive} neutral={d.neutral} negative={d.negative} />
      <p className="num text-[11px] mt-2.5" style={{ color: 'var(--text-faint)' }}>{d.totalReviews} reviews</p>
    </button>
  );
}

export default function PlatformRatings({ sourceRatings, loading, onSourceClick }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(7)].map((_, i) => <div key={i} className="tile shimmer h-[168px]" />)}
      </div>
    );
  }
  if (!sourceRatings?.length) {
    return (
      <div className="panel-quiet p-10 text-center" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No platform data yet.</p>
        <p className="eyebrow mt-1">Run AI Analysis to pull live reviews</p>
      </div>
    );
  }
  const liveSources = new Set(sourceRatings.map(s => s.source));
  const planned = PLANNED.filter(p => !liveSources.has(p));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
      {sourceRatings.map(s => <Card key={s.source} d={s} onClick={onSourceClick} />)}
      {planned.map(p => <PlannedCard key={p} source={p} />)}
    </div>
  );
}
