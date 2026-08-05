import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Plane, Building2, ChevronDown, ExternalLink, Star, AlertTriangle } from 'lucide-react';

/**
 * Branch-level scorecard. Every figure is counted from Google Maps reviews —
 * the only connected source that ties a review to a specific storefront.
 *
 * Ranked worst-first on purpose: the question this answers is "where do we
 * intervene", not "who deserves a prize".
 */

const FILTERS = [
  { key: 'all', label: 'All branches', match: () => true },
  { key: 'airport', label: 'Airport', match: l => l.isAirport },
  { key: 'city', label: 'Neighbourhood', match: l => !l.isAirport },
];

const pct = v => `${Math.round(v * 100)}%`;

function RateBar({ value, max }) {
  const w = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden w-full" style={{ background: 'var(--border)' }}>
      <div className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${w}%`, background: 'var(--neg)' }} />
    </div>
  );
}

function Row({ l, worstRate, expanded, onToggle }) {
  const worseThanNetwork = l.negRateVsNetwork > 0;
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button onClick={onToggle}
        className="w-full grid items-center gap-3 py-3 px-1 text-left transition-colors hover:bg-[var(--bg-elev)]"
        style={{ gridTemplateColumns: 'minmax(0,2.4fr) 4.5rem minmax(0,1.5fr) 4rem 1.25rem' }}>

        {/* Branch */}
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
            {l.isAirport ? <Plane size={14} strokeWidth={1.75} /> : <Building2 size={14} strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>{l.name}</p>
            <p className="text-[11.5px] truncate" style={{ color: 'var(--text-faint)' }}>
              {l.city}{l.state ? `, ${l.state}` : ''}
              {l.lowSample && <span style={{ color: 'var(--neu)' }}> · low sample</span>}
            </p>
          </div>
        </div>

        {/* Google's public rating for the branch */}
        <div className="flex items-center gap-1">
          <Star size={11} strokeWidth={0} fill="var(--accent)" />
          <span className="num text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
            {l.googleRating?.toFixed(1) ?? '—'}
          </span>
        </div>

        {/* Negative rate */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between mb-1 gap-2">
            <span className="num text-[13px] font-semibold"
              style={{ color: worseThanNetwork ? 'var(--neg)' : 'var(--text-dim)' }}>{pct(l.negRate)}</span>
            <span className="num text-[10.5px]" style={{ color: 'var(--text-faint)' }}>
              {l.negative}/{l.scored}
            </span>
          </div>
          <RateBar value={l.negRate} max={worstRate} />
        </div>

        {/* Negative reviews with no reply */}
        <span className="num text-[13px] text-right"
          style={{ color: l.negUnanswered > 0 ? 'var(--neg)' : 'var(--text-faint)' }}>
          {l.negUnanswered}
        </span>

        <ChevronDown size={14} style={{
          color: 'var(--text-faint)',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform .2s',
        }} />
      </button>

      {expanded && (
        <div className="pb-4 pl-8 pr-1 animate-fade-up">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] items-start">
            <div className="min-w-0">
              <p className="eyebrow mb-1.5">What customers complain about here</p>
              {l.topThemes.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {l.topThemes.map(t => (
                    <span key={t.name} className="chip" style={{ fontSize: '0.72rem' }}>
                      {t.name}<span className="num ml-1.5" style={{ color: 'var(--text-faint)' }}>{t.weight}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  No tagged complaints in the sample.
                </p>
              )}
              <p className="text-[11.5px] mt-3 leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                {l.address}
                {l.googleReviewCount ? <> · Google shows <span className="num">{l.googleReviewCount.toLocaleString()}</span> reviews here; we sampled <span className="num">{l.reviews}</span>, of which <span className="num">{l.scored}</span> had text to analyse.</> : null}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="text-right">
                <p className="eyebrow">Replies sent</p>
                <p className="num text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{pct(l.responseRate)}</p>
              </div>
              <a href={`https://www.google.com/maps/search/?api=1&query=Avis&query_place_id=${l.placeId}`}
                target="_blank" rel="noopener noreferrer"
                className="btn-quiet" style={{ fontSize: '0.72rem' }}>
                Open in Maps <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocationIntel() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(j => (j.error ? setErr(j.error) : setD(j)))
      .catch(e => setErr(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!d) return [];
    return d.locations.filter(FILTERS.find(f => f.key === filter).match);
  }, [d, filter]);

  const summary = useMemo(() => {
    if (!rows.length) return null;
    const rated = rows.filter(l => l.googleRating != null);
    const best = rated.reduce((a, b) => (b.googleRating > a.googleRating ? b : a), rated[0]);
    const worst = rated.reduce((a, b) => (b.googleRating < a.googleRating ? b : a), rated[0]);
    return {
      best, worst,
      spread: best && worst ? best.googleRating - worst.googleRating : 0,
      belowAvg: rows.filter(l => l.negRateVsNetwork > 0).length,
      unanswered: rows.reduce((n, l) => n + l.negUnanswered, 0),
    };
  }, [rows]);

  if (err) return null;              // additive panel — never breaks the page
  if (!d) return <div className="panel h-72 shimmer" />;

  const worstRate = Math.max(...rows.map(l => l.negRate), 0.01);
  const visible = showAll ? rows : rows.slice(0, 12);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
            <MapPin size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>Which branches need help</p>
            <p className="eyebrow mt-0.5">
              <span className="num">{d.locationCount}</span> Avis locations · counted from <span className="num">{d.totalLocated.toLocaleString()}</span> Google reviews
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setOpen(null); }}
              className="chip" style={{
                fontSize: '0.72rem',
                borderColor: filter === f.key ? 'var(--accent)' : undefined,
                color: filter === f.key ? 'var(--accent)' : undefined,
                background: filter === f.key ? 'var(--accent-soft)' : undefined,
              }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* The spread is the headline: same brand, same week, very different experience. */}
      {summary && (
        <div className="grid gap-x-6 gap-y-4 grid-cols-2 lg:grid-cols-4 mb-5 pb-5"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <p className="eyebrow mb-1">Rating spread</p>
            <p className="metric text-[30px]" style={{ color: 'var(--text)' }}>{summary.spread.toFixed(1)}<span className="text-[16px]" style={{ color: 'var(--text-dim)' }}>★</span></p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>best branch vs worst</p>
          </div>
          <div>
            {/* "Lowest rated", not "worst" — the table below ranks by our own
                negative rate, and the two need not agree. */}
            <p className="eyebrow mb-1">Lowest rated</p>
            <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--neg)' }}>{summary.worst?.name}</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
              <span className="num">{summary.worst?.googleRating?.toFixed(1)}</span>★ · {summary.worst?.city}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">Highest rated</p>
            <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--pos)' }}>{summary.best?.name}</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
              <span className="num">{summary.best?.googleRating?.toFixed(1)}</span>★ · {summary.best?.city}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">Unanswered complaints</p>
            <p className="metric text-[30px]" style={{ color: 'var(--neg)' }}>{summary.unanswered}</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
              across <span className="num">{summary.belowAvg}</span> branches worse than average
            </p>
          </div>
        </div>
      )}

      {/* Column headers */}
      <div className="grid items-center gap-3 pb-2 px-1"
        style={{ gridTemplateColumns: 'minmax(0,2.4fr) 4.5rem minmax(0,1.5fr) 4rem 1.25rem' }}>
        <span className="eyebrow">Branch</span>
        <span className="eyebrow">Google</span>
        <span className="eyebrow">Negative rate</span>
        <span className="eyebrow text-right">No reply</span>
        <span />
      </div>

      <div>
        {visible.map(l => (
          <Row key={l.placeId} l={l} worstRate={worstRate}
            expanded={open === l.placeId}
            onToggle={() => setOpen(open === l.placeId ? null : l.placeId)} />
        ))}
      </div>

      {rows.length > 12 && (
        <button onClick={() => setShowAll(s => !s)} className="btn-quiet mt-4">
          {showAll ? 'Show top 12' : `Show all ${rows.length} branches`}
        </button>
      )}

      <p className="text-[11.5px] leading-relaxed mt-5 pt-4"
        style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
        <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />
        Ranked by the share of sampled reviews scored negative, worst first. Branch star ratings are
        Google&rsquo;s own public figure. Branches marked <em>low sample</em> have too few reviews to
        rank confidently — they are shown for completeness, not for action.
      </p>
    </div>
  );
}
