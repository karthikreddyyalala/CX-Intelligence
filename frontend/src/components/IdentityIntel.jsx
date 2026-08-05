import React, { useEffect, useState } from 'react';
import { Fingerprint, ExternalLink, ShieldCheck, ShieldQuestion, ChevronDown, Info, Sparkles } from 'lucide-react';

/**
 * Identity resolution panel: reviews that are probably the same person or the
 * same incident under different display names.
 *
 * Every cluster shows WHY it was flagged (the concrete signals) and, where the
 * model has ruled, its verdict with the reasoning verbatim. Nothing here claims
 * certainty — the copy says "likely", and each underlying review is one click
 * away so a human can decide.
 */

const TYPE_META = {
  'same-incident': { label: 'Same story, different names', tone: 'var(--neg)' },
  'multi-branch': { label: 'One name, several branches', tone: 'var(--accent)' },
  'rating-burst': { label: 'Suspicious rating burst', tone: 'var(--neu)' },
  'cross-platform': { label: 'Same name across platforms', tone: 'var(--accent)' },
};

function Verdict({ ai }) {
  if (!ai) return null;
  const confirmed = ai.verdict === 'same-person' || ai.verdict === 'same-incident';
  const Icon = confirmed ? ShieldCheck : ShieldQuestion;
  const tone = confirmed ? 'var(--pos)' : 'var(--neu)';
  const label = {
    'same-person': 'AI verdict: same person',
    'same-incident': 'AI verdict: same incident',
    unclear: 'AI verdict: unclear',
    unrelated: 'AI verdict: likely unrelated',
  }[ai.verdict] || `AI verdict: ${ai.verdict}`;
  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: tone }}>
        <Icon size={13} strokeWidth={2} />
        {label} · <span className="num">{ai.confidence}%</span> confident
      </p>
      <p className="text-[12px] leading-relaxed mt-1" style={{ color: 'var(--text-dim)' }}>{ai.reasoning}</p>
    </div>
  );
}

function ReviewCard({ r }) {
  return (
    <div className="rounded-xl p-3 min-w-0" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>{r.author}</p>
        <span className="num text-[11px] flex-shrink-0" style={{ color: r.rating <= 2 ? 'var(--neg)' : 'var(--pos)' }}>
          {r.rating != null ? `${r.rating}★` : '—'}
        </span>
      </div>
      <p className="text-[10.5px] mb-1.5" style={{ color: 'var(--text-faint)' }}>
        {r.source} · {r.date}{r.location ? ` · ${r.location}` : ''}
      </p>
      {r.text ? (
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          &ldquo;{r.text.slice(0, 200)}{r.text.length > 200 ? '…' : ''}&rdquo;
        </p>
      ) : (
        <p className="text-[12px] italic" style={{ color: 'var(--text-faint)' }}>Star rating only — no text written.</p>
      )}
      {r.url && (
        <a href={r.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] mt-1.5" style={{ color: 'var(--accent)' }}>
          View original <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

function Cluster({ c, expanded, onToggle }) {
  const meta = TYPE_META[c.type] || { label: c.type, tone: 'var(--text-dim)' };
  const shown = expanded ? c.reviews : c.reviews.slice(0, 2);
  return (
    <div className="rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ color: meta.tone, background: 'var(--bg-elev)', border: `1px solid ${meta.tone}` }}>
          {meta.label}
        </span>
        {c.ai && (c.ai.verdict === 'same-person' || c.ai.verdict === 'same-incident') && (
          <span className="flex items-center gap-1 text-[10.5px] font-medium" style={{ color: 'var(--pos)' }}>
            <Sparkles size={11} /> AI-verified
          </span>
        )}
        <span className="text-[11px] ml-auto" style={{ color: 'var(--text-faint)' }}>
          {c.signals.join(' · ')}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {shown.map(r => <ReviewCard key={r.id} r={r} />)}
      </div>
      {c.reviews.length > 2 && (
        <button onClick={onToggle} className="btn-quiet mt-2" style={{ fontSize: '0.7rem' }}>
          <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          {expanded ? 'Show fewer' : `Show all ${c.reviews.length} reviews`}
        </button>
      )}

      <Verdict ai={c.ai} />
    </div>
  );
}

export default function IdentityIntel() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    fetch('/api/identity')
      .then(r => r.json())
      .then(j => (j.error ? setErr(j.error) : setD(j)))
      .catch(e => setErr(e.message));
  }, []);

  if (err) return null;               // additive panel — never breaks the page
  if (!d) return <div className="panel h-72 shimmer" />;

  // Hide what the model has already ruled out; keep everything it confirmed or
  // hasn't seen yet, strongest first (the API pre-sorts).
  const clusters = d.clusters.filter(c => !c.ai || c.ai.verdict !== 'unrelated');
  if (!clusters.length) return null;

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
            <Fingerprint size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>
              One customer, many names
            </p>
            <p className="eyebrow mt-0.5">Likely duplicate reviewers, found by signal analysis and verified by AI</p>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <p className="metric text-[26px]" style={{ color: 'var(--text)' }}>{clusters.length}</p>
            <p className="eyebrow">clusters</p>
          </div>
          <div className="text-right">
            <p className="metric text-[26px]" style={{ color: 'var(--text)' }}>{d.reviewsFlagged}</p>
            <p className="eyebrow">reviews flagged</p>
          </div>
          <div className="text-right">
            <p className="metric text-[26px]" style={{ color: 'var(--pos)' }}>{d.verifiedCount}</p>
            <p className="eyebrow">AI-verified</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {clusters.map(c => (
          <Cluster key={c.clusterId} c={c}
            expanded={open === c.clusterId}
            onToggle={() => setOpen(open === c.clusterId ? null : c.clusterId)} />
        ))}
      </div>

      <p className="text-[11.5px] leading-relaxed mt-5 pt-4"
        style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
        <Info size={11} className="inline mr-1 -mt-0.5" />
        Public platforms expose no account identity, so nothing here is certain — clusters are
        flagged from concrete overlaps (name, branch, timing, wording) and the strongest are
        read and ruled on by the model, whose reasoning is shown verbatim. Treat each as a lead
        to check, not a verdict: the original reviews are linked for exactly that purpose.
      </p>
    </div>
  );
}
