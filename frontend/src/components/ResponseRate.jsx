import React, { useEffect, useState } from 'react';
import { MessageSquareOff, Timer, AlertTriangle } from 'lucide-react';

/**
 * How often Avis answers its Google reviews — counted from scraped
 * owner-response data, never modeled. Google Maps is the only connected
 * source that exposes owner responses, so the stat is scoped and labelled.
 */
export default function ResponseRate() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/response-rate')
      .then(r => r.json())
      .then(j => (j.error ? setErr(j.error) : setD(j)))
      .catch(e => setErr(e.message));
  }, []);

  if (err) return null; // quiet fail — the panel is additive, not critical
  if (!d) return <div className="panel h-40 shimmer" />;

  const unansweredPct = 100 - d.responseRatePct;

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
            <MessageSquareOff size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>Are we answering?</p>
            <p className="eyebrow mt-0.5">Google reviews · counted from owner-response data</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
        {/* Headline: the silence */}
        <div>
          <p className="metric text-[44px]" style={{ color: 'var(--neg)' }}>{unansweredPct}%</p>
          <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--text)' }}>of reviews get no reply</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
            <span className="num">{d.responded}</span> of <span className="num">{d.total}</span> Google reviews answered
          </p>
        </div>

        {/* Negative silence */}
        <div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} style={{ color: 'var(--neg)' }} />
            <p className="metric text-[44px]" style={{ color: 'var(--text)' }}>
              {d.negativeUnanswered}<span className="text-[22px]" style={{ color: 'var(--text-dim)' }}>/{d.negativeTotal}</span>
            </p>
          </div>
          <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--text)' }}>negative reviews unanswered</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
            the angriest customers hear nothing back
          </p>
        </div>

        {/* The good news */}
        <div>
          <div className="flex items-center gap-1.5">
            <Timer size={14} style={{ color: 'var(--pos)' }} />
            <p className="metric text-[44px]" style={{ color: 'var(--pos)' }}>
              {d.medianHoursToRespond}<span className="text-[22px]">h</span>
            </p>
          </div>
          <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--text)' }}>median reply time — when we do reply</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
            the team is fast; it's coverage that's missing
          </p>
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed mt-5 pt-4" style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
        Counted from {d.total} Google Maps reviews — the one connected channel that exposes owner responses.
        Proserpio &amp; Zervas (2018) found businesses that respond to reviews gain +0.12 stars on average.
        The reply drafter below turns each unanswered review into a one-click response.
      </p>
    </div>
  );
}
