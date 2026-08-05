import React from 'react';
import { TrendingUp, TrendingDown, Crown, FlaskConical } from 'lucide-react';

// Illustrative competitive set. Wire to live Apify pulls (Trustpilot/Google per
// brand) when the team decides to invest — the shape below is what it fills.
const BRANDS = [
  { brand: 'Enterprise', rating: 4.1, pos: 71, neu: 10, neg: 19, trend: 0.2, complaint: 'wait times', voice: 28 },
  { brand: 'National',   rating: 3.9, pos: 66, neu: 11, neg: 23, trend: 0.1, complaint: 'car availability', voice: 14 },
  { brand: 'Avis',       rating: 2.8, pos: 74, neu: 2,  neg: 24, trend: -0.3, complaint: 'billing errors', voice: 22, you: true },
  { brand: 'Hertz',      rating: 2.6, pos: 58, neu: 9,  neg: 33, trend: -0.1, complaint: 'billing disputes', voice: 24 },
  { brand: 'Budget',     rating: 2.4, pos: 55, neu: 8,  neg: 37, trend: -0.2, complaint: 'hidden fees', voice: 12 },
];

function Bar({ pos, neu, neg }) {
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden gap-px w-full">
      <div style={{ width: `${pos}%`, background: 'var(--pos)' }} />
      <div style={{ width: `${neu}%`, background: 'var(--neu)' }} />
      <div style={{ width: `${neg}%`, background: 'var(--neg)' }} />
    </div>
  );
}

export default function CompetitorPanel() {
  const rows = [...BRANDS].sort((a, b) => b.rating - a.rating);
  const avisRank = rows.findIndex(r => r.you) + 1;

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <p className="eyebrow">Brand rating · sentiment mix · share of voice</p>
        <span className="badge" style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb,var(--accent) 30%,transparent)', background: 'var(--accent-soft)' }}>
          <FlaskConical size={11} /> Illustrative · not yet live
        </span>
      </div>

      {/* Standing callout */}
      <div className="p-4 rounded-xl mb-5" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
        <p className="text-[13.5px]" style={{ color: 'var(--text-dim)' }}>
          Avis ranks <span className="num font-semibold" style={{ color: 'var(--text)' }}>#{avisRank} of {rows.length}</span> on brand rating.
          The gap to the leaders is <span style={{ color: 'var(--pos)' }}>sentiment mix</span>, not volume — Avis has the
          highest positive share but its <span style={{ color: 'var(--neg)' }}>billing complaints</span> cap the ceiling.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ minWidth: 560 }}>
          <thead>
            <tr className="eyebrow" style={{ color: 'var(--text-faint)' }}>
              <th className="pb-2 font-normal">Brand</th>
              <th className="pb-2 font-normal">Rating</th>
              <th className="pb-2 font-normal w-[34%]">Sentiment</th>
              <th className="pb-2 font-normal">Top complaint</th>
              <th className="pb-2 font-normal text-right">Share of voice</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.brand} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="py-3">
                  <span className="flex items-center gap-1.5 font-semibold text-[13.5px]"
                    style={{ color: r.you ? 'var(--accent)' : 'var(--text)' }}>
                    {r.you && <Crown size={13} />}{r.brand}
                  </span>
                </td>
                <td className="py-3">
                  <span className="num font-display font-bold text-[17px]" style={{ color: 'var(--text)' }}>{r.rating}</span>
                  <span className="num text-[11px] ml-1 inline-flex items-center gap-0.5"
                    style={{ color: r.trend >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {r.trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{Math.abs(r.trend)}
                  </span>
                </td>
                <td className="py-3 pr-4"><Bar pos={r.pos} neu={r.neu} neg={r.neg} /></td>
                <td className="py-3"><span className="chip" style={{ cursor: 'default' }}>{r.complaint}</span></td>
                <td className="py-3 text-right num text-[13px]" style={{ color: 'var(--text-dim)' }}>{r.voice}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
