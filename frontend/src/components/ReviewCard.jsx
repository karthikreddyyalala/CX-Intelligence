import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Star, ExternalLink, Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import SourceIcon from './SourceIcon';

function Stars({ rating }) {
  if (!rating) return null;
  const full = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} strokeWidth={0} fill={i <= full ? 'var(--accent)' : 'var(--border-2)'} />
      ))}
      <span className="num text-[11px] ml-1" style={{ color: 'var(--text-faint)' }}>{rating}</span>
    </div>
  );
}

const SENT = {
  positive: { cls: 'badge-pos', label: 'positive' },
  negative: { cls: 'badge-neg', label: 'negative' },
  neutral:  { cls: 'badge-neu', label: 'neutral' },
};

// ── AI reply drafter — generates an on-brand public response to this review ──
function ReplyDrafter({ review, alignRight }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setState('loading'); setError(''); setCopied(false);
    try {
      const res = await fetch('/api/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not draft a reply.');
      setReply(data.reply || ''); setState('done');
    } catch (e) { setError(e.message); setState('error'); }
  };

  const copy = () => {
    navigator.clipboard?.writeText(reply);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  if (state === 'idle') {
    return (
      <button onClick={generate}
        className={`chip inline-flex items-center gap-1 ${alignRight ? 'ml-auto' : ''}`}
        style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border))', background: 'var(--accent-soft)' }}
        title="Draft an on-brand reply with Claude">
        <Sparkles size={11} /> Draft reply
      </button>
    );
  }

  // Non-idle states take their own full-width row within the flex-wrap footer.
  if (state === 'loading') {
    return (
      <div className="w-full mt-1 rounded-xl p-3 space-y-2"
        style={{ flexBasis: '100%', background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)' }}>
        <p className="eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
          <Sparkles size={10} className="spin" /> Claude is drafting a reply…
        </p>
        <div className="h-2.5 rounded shimmer" style={{ width: '92%' }} />
        <div className="h-2.5 rounded shimmer" style={{ width: '78%' }} />
        <div className="h-2.5 rounded shimmer" style={{ width: '85%' }} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="w-full mt-1 rounded-xl p-3 flex items-center justify-between gap-2"
        style={{ flexBasis: '100%', background: 'color-mix(in srgb, var(--neg) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--neg) 25%, transparent)' }}>
        <span className="text-[12px]" style={{ color: 'var(--neg)' }}>{error}</span>
        <button onClick={generate} className="chip inline-flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="w-full mt-1 rounded-xl p-3 animate-fade-in"
      style={{ flexBasis: '100%', background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
          <Sparkles size={10} /> Suggested reply
        </p>
        <div className="flex items-center gap-1.5">
          <button onClick={generate} className="inline-flex items-center gap-1 text-[11px] font-medium opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }}>
            <RefreshCw size={11} /> Redraft
          </button>
          <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] font-semibold transition-colors"
            style={{ color: copied ? 'var(--pos)' : 'var(--accent)' }}>
            {copied ? <><Check size={12} /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{reply}</p>
      <p className="eyebrow mt-2.5" style={{ color: 'var(--text-faint)' }}>AI-drafted · review before posting</p>
    </div>
  );
}

export default function ReviewCard({ review, onThemeClick, index = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const text = review.text || '';
  const long = text.length > 240;
  const display = long && !expanded ? text.slice(0, 240) + '…' : text;
  const date = review.date ? new Date(review.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const sc = SENT[review.sentiment] || SENT.neutral;

  return (
    <div className="tile tile-hover p-4" style={{ animationDelay: `${Math.min(index * 25, 250)}ms` }}>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
            style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
            <SourceIcon source={review.source} size={15} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">{review.source}</p>
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{review.author}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`badge ${sc.cls}`}>{sc.label}</span>
          <span className="num text-[11px]" style={{ color: 'var(--text-faint)' }}>{date}</span>
        </div>
      </div>

      {review.rating ? <div className="mb-2"><Stars rating={review.rating} /></div> : null}

      <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        {display}
        {long && (
          <button onClick={() => setExpanded(e => !e)}
            className="ml-1 text-[12px] font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
            {expanded ? <><ChevronUp size={12} />less</> : <><ChevronDown size={12} />more</>}
          </button>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        {(review.themes || []).slice(0, 5).map(t => (
          <button key={t} onClick={() => onThemeClick?.(t)} className="chip">{t}</button>
        ))}
        {review.url && (
          <a href={review.url} target="_blank" rel="noopener noreferrer"
            className="chip ml-auto inline-flex items-center gap-1"
            style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border))' }}
            title="Open the original review">
            <ExternalLink size={11} /> source
          </a>
        )}
        <ReplyDrafter review={review} alignRight={!review.url} />
      </div>
    </div>
  );
}
