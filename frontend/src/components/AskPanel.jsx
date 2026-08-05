import React, { useState } from 'react';
import { Sparkles, ArrowUp, ExternalLink, Quote } from 'lucide-react';
import SourceIcon from './SourceIcon';

const SUGGESTED = [
  'What should we fix first to raise our rating?',
  'Why are customers angry at the counter?',
  'Summarize the billing complaints',
  'How does Trustpilot compare to Google?',
];

export default function AskPanel() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [asked, setAsked] = useState('');

  const ask = async (question) => {
    const text = (question ?? q).trim();
    if (!text || loading) return;
    setAsked(text); setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ answer: 'Something went wrong reaching the analyst.', citations: [], error: true });
    } finally { setLoading(false); }
  };

  return (
    <div className="panel p-6 relative overflow-hidden"
      style={{ borderColor: 'color-mix(in srgb, var(--accent) 24%, var(--border))' }}>

      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
          <Sparkles size={17} style={{ color: 'var(--accent)' }} />
        </span>
        <div>
          <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>Ask CX Intelligence</p>
          <p className="eyebrow mt-0.5">Answered live from real customer reviews — with evidence</p>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); ask(); }} className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask anything about what customers are saying…"
          className="field flex-1 text-[14px]" style={{ padding: '0.7rem 0.9rem' }} />
        <button type="submit" disabled={loading || !q.trim()} className="btn-signal" style={{ padding: '0.5rem 0.9rem' }}>
          {loading ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent spin" /> : <ArrowUp size={16} />}
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>

      {/* Suggestions */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTED.map(s => (
            <button key={s} onClick={() => { setQ(s); ask(s); }} className="chip" style={{ fontSize: '0.72rem' }}>{s}</button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-4 space-y-2">
          <p className="text-[13px]" style={{ color: 'var(--text-faint)' }}>Reading the reviews for “{asked}”…</p>
          {[...Array(3)].map((_, i) => <div key={i} className="h-3 rounded shimmer" style={{ width: `${90 - i * 15}%` }} />)}
        </div>
      )}

      {/* Answer */}
      {result && !loading && (
        <div className="mt-4 animate-fade-up">
          <p className="text-[11px] mb-2" style={{ color: 'var(--text-faint)' }}>
            Q: <span style={{ color: 'var(--text-dim)' }}>{asked}</span>
          </p>
          <div className="p-4 rounded-xl mb-3" style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text)' }}>{result.answer}</p>
          </div>

          {result.citations?.length > 0 && (
            <div className="space-y-1.5">
              <p className="eyebrow mb-1">Evidence · {result.evidenceCount} reviews analyzed</p>
              {result.citations.map((c, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="mt-0.5" style={{ color: 'var(--text-faint)' }}><SourceIcon source={c.source} size={13} /></span>
                  <p className="text-[12.5px] leading-snug flex-1" style={{ color: 'var(--text-dim)' }}>
                    <Quote size={11} className="inline mr-1 -mt-0.5" style={{ color: 'var(--text-faint)' }} />
                    {c.quote} <span style={{ color: 'var(--text-faint)' }}>— {c.author}, {c.source}</span>
                  </p>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} title="Open source">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <button onClick={() => { setResult(null); setQ(''); }} className="btn-quiet mt-3">Ask another question</button>
        </div>
      )}
    </div>
  );
}
