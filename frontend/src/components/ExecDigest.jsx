import React, { useEffect, useState } from 'react';
import { Mail, Copy, Check, ShieldCheck } from 'lucide-react';

// Forwardable executive brief. Every figure and quote is computed/copied
// server-side from real reviews — nothing here is model-generated.
// Scopes mirror the risk model: cross-platform reporting is honest only over the
// window every channel actually covers (7 days). Anything deeper is offered per
// source, because only the App Store has history that far back.
const SCOPES = [
  { key: '7', label: 'Last 7 days', query: 'days=7' },
  { key: 'as60', label: 'App Store · 60 days', query: `days=60&source=${encodeURIComponent('App Store')}` },
  { key: 'all', label: 'All data', query: 'days=all' },
];

export default function ExecDigest() {
  const [digest, setDigest] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState('7');
  const scope = SCOPES.find(s => s.key === period) || SCOPES[0];

  useEffect(() => {
    setDigest(null); setErr(''); setCopied(false);
    fetch(`/api/digest?${scope.query}`)
      .then(r => r.json())
      .then(d => (d.error ? setErr(d.error) : setDigest(d)))
      .catch(e => setErr(e.message));
  }, [scope.query]);

  const copy = () => {
    if (!digest?.text) return;
    navigator.clipboard?.writeText(digest.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const PeriodTabs = (
    <div className="flex items-center gap-1 p-0.5 rounded-xl"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      {SCOPES.map(p => {
        const on = p.key === period;
        return (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap"
            style={on
              ? { background: 'var(--accent)', color: '#17130a' }
              : { color: 'var(--text-dim)' }}>
            {p.label}
          </button>
        );
      })}
    </div>
  );

  if (err) {
    return (
      <div className="panel p-5" style={{ borderColor: 'color-mix(in srgb, var(--neg) 30%, var(--border))' }}>
        <p className="text-[13px]" style={{ color: 'var(--neg)' }}>Could not build the brief: {err}</p>
      </div>
    );
  }

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
            <Mail size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>
              {digest?.periodLabel || 'Brief'}, ready to send
            </p>
            <p className="eyebrow mt-0.5">
              {digest ? `${digest.dateFrom} to ${digest.dateTo}` : 'Building…'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PeriodTabs}
          <button onClick={copy} className="btn-signal" disabled={!digest}
            style={copied ? { background: 'var(--pos)' } : undefined}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy brief</>}
          </button>
        </div>
      </div>

      {!digest ? (
        <div className="h-52 rounded-2xl shimmer" />
      ) : (
        <>
          {/* Preview — mirrors exactly what lands on the clipboard */}
          <pre
            className="num text-[12px] leading-relaxed rounded-2xl p-4 overflow-x-auto whitespace-pre-wrap animate-fade-in"
            style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--text-dim)', maxHeight: 420 }}
          >{digest.text}</pre>

          <div className="flex items-center gap-1.5 mt-3">
            <ShieldCheck size={12} style={{ color: 'var(--pos)' }} />
            <p className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
              Every number counted from real reviews · quotes copied verbatim, never paraphrased
            </p>
          </div>
        </>
      )}
    </div>
  );
}
