import React from 'react';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';

// Light renderer for the Claude-authored brief (handles #/##, **bold**, paragraphs).
function renderNarrative(text) {
  const blocks = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  return blocks.map((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      return <p key={i} className="eyebrow mt-4 first:mt-0" style={{ color: 'var(--accent)' }}>{line.replace(/^#{1,3}\s/, '')}</p>;
    }
    if (/^\*\*.+\*\*:?$/.test(line)) {
      return <p key={i} className="eyebrow mt-4 first:mt-0" style={{ color: 'var(--accent)' }}>{line.replace(/\*\*/g, '').replace(/:$/, '')}</p>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, j) =>
      /^\*\*.+\*\*$/.test(p)
        ? <strong key={j} style={{ color: 'var(--text)', fontWeight: 600 }}>{p.replace(/\*\*/g, '')}</strong>
        : <React.Fragment key={j}>{p}</React.Fragment>
    );
    return <p key={i} className="text-[13.5px] leading-relaxed mt-2 first:mt-0" style={{ color: 'var(--text-dim)' }}>{parts}</p>;
  });
}

export default function InsightSummary({ summary, loading }) {
  if (loading) {
    return (
      <div className="panel p-6">
        <div className="h-4 w-40 rounded shimmer mb-4" />
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-3 rounded shimmer" style={{ width: `${88 - i * 12}%` }} />)}</div>
      </div>
    );
  }

  if (!summary || !summary.narrative_text || /No AI summary/.test(summary.narrative_text)) {
    return (
      <div className="panel-quiet p-6 flex items-center gap-4" style={{ borderStyle: 'dashed' }}>
        <span className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0" style={{ background: 'var(--accent-soft)' }}>
          <Sparkles size={19} style={{ color: 'var(--accent)' }} />
        </span>
        <div>
          <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>No brief generated yet</p>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
            Hit <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Run AI Analysis</span> — Claude will read every review and write the first leadership brief.
          </p>
        </div>
      </div>
    );
  }

  const dist = summary.sentiment_distribution || {};
  const t = (dist.positive || 0) + (dist.neutral || 0) + (dist.negative || 0);
  const posP = t ? Math.round((dist.positive / t) * 100) : 0;
  const negP = t ? Math.round((dist.negative / t) * 100) : 0;
  const neuP = 100 - posP - negP;
  const recs = summary.top_recommendations || [];
  const gen = summary.generated_at ? new Date(summary.generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Narrative */}
      <div className="panel p-6 lg:col-span-3">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
              <Sparkles size={17} style={{ color: 'var(--accent)' }} />
            </span>
            <div>
              <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>Executive brief</p>
              <p className="eyebrow mt-0.5">Claude · {summary.window_start} → {summary.window_end}</p>
            </div>
          </div>
          <span className="num text-[11px] px-2 py-1 rounded-lg" style={{ color: 'var(--text-faint)', background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>{gen}</span>
        </div>

        {/* Sentiment strip */}
        <div className="flex items-center gap-2 mb-4">
          <span className="badge badge-pos">{posP}% positive</span>
          <span className="badge badge-neu">{neuP}% neutral</span>
          <span className="badge badge-neg">{negP}% negative</span>
          <span className="num text-[11px] ml-auto" style={{ color: 'var(--text-faint)' }}>{t.toLocaleString()} reviews</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden mb-5 gap-px">
          <div style={{ width: `${posP}%`, background: 'var(--pos)' }} />
          <div style={{ width: `${neuP}%`, background: 'var(--neu)' }} />
          <div style={{ width: `${negP}%`, background: 'var(--neg)' }} />
        </div>

        <div className="max-h-64 overflow-y-auto pr-1">{renderNarrative(summary.narrative_text)}</div>
      </div>

      {/* Recommended actions */}
      <div className="panel p-6 lg:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} style={{ color: 'var(--accent)' }} />
          <p className="eyebrow">Recommended actions</p>
        </div>
        {recs.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--text-faint)' }}>No actions surfaced for this window.</p>
        ) : (
          <div className="space-y-2.5">
            {recs.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
                <span className="num flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-bold flex-shrink-0"
                  style={{ background: 'var(--accent)', color: '#17130a' }}>{r.rank || i + 1}</span>
                <p className="text-[12.5px] leading-snug flex-1" style={{ color: 'var(--text-dim)' }}>{r.action}</p>
                {r.impactScore != null && (
                  <span className="num text-[11px] font-semibold flex-shrink-0" style={{ color: 'var(--neg)' }}>{r.impactScore}</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-4 text-[12px]" style={{ color: 'var(--text-faint)' }}>
          <ArrowRight size={12} /> Scroll to the feed for the raw evidence behind each theme.
        </div>
      </div>
    </div>
  );
}
