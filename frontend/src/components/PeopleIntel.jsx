import React, { useEffect, useState } from 'react';
import { Award, LifeBuoy, Quote, ExternalLink, Users } from 'lucide-react';

/**
 * Staff named in customer reviews, split into recognition and coaching.
 *
 * Handled deliberately: these are names customers wrote in public reviews, and
 * a complaint is a signal to look into, never a verdict on an employee. The UI
 * always shows the verbatim behind a count and links to the source review, so
 * nobody is ever judged on an aggregate alone.
 */

const TABS = [
  { key: 'recognition', label: 'Praised', icon: Award, tone: 'var(--pos)' },
  { key: 'coaching', label: 'Complaints', icon: LifeBuoy, tone: 'var(--neg)' },
];

function QuoteLine({ q }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <Quote size={11} className="flex-shrink-0 mt-1" style={{ color: 'var(--text-faint)' }} />
      <p className="text-[12.5px] leading-snug flex-1" style={{ color: 'var(--text-dim)' }}>
        {q.text}
        {q.location && <span style={{ color: 'var(--text-faint)' }}> — {q.location}</span>}
      </p>
      {q.url && (
        <a href={q.url} target="_blank" rel="noopener noreferrer"
          className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} title="Open the review">
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function PersonRow({ p, tone, expanded, onToggle }) {
  const count = tone === 'var(--pos)' ? p.positive : p.negative;
  const shared = p.locations.length > 1;
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button onClick={onToggle}
        className="w-full flex items-center gap-3 py-2.5 px-1 text-left transition-colors hover:bg-[var(--bg-elev)]">
        {/* Initial instead of a stock avatar — no invented faces for real people. */}
        <span className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 text-[12px] font-semibold"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
          {p.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.name}</p>
          <p className="text-[11.5px] truncate" style={{ color: 'var(--text-faint)' }}>
            {p.locations[0]?.name ?? 'Branch not identified'}
            {shared && ' · named at multiple branches'}
          </p>
        </div>
        <span className="num text-[15px] font-semibold flex-shrink-0" style={{ color: tone }}>{count}</span>
      </button>

      {expanded && (
        <div className="pb-3 pl-11 pr-1 space-y-1.5 animate-fade-up">
          {p.quotes.filter(q => (tone === 'var(--pos)' ? q.sentiment === 'positive' : q.sentiment === 'negative'))
            .map((q, i) => <QuoteLine key={i} q={q} />)}
          {shared && (
            <p className="text-[11px] pt-1" style={{ color: 'var(--text-faint)' }}>
              Named at {p.locations.map(l => `${l.name} (${l.count})`).join(', ')} — likely more than
              one person sharing a first name.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PeopleIntel() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('recognition');
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/people')
      .then(r => r.json())
      .then(j => (j.error ? setErr(j.error) : setD(j)))
      .catch(e => setErr(e.message));
  }, []);

  if (err) return null;
  if (!d) return <div className="panel h-64 shimmer" />;

  const active = TABS.find(t => t.key === tab);
  const list = d[tab] || [];
  const visible = showAll ? list : list.slice(0, 8);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
            <Users size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>The people customers name</p>
            <p className="eyebrow mt-0.5">
              <span className="num">{d.peopleNamed}</span> staff named across <span className="num">{d.reviewsNamingSomeone}</span> reviews
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {TABS.map(t => {
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setOpen(null); setShowAll(false); }}
                className="chip flex items-center gap-1.5" style={{
                  fontSize: '0.72rem',
                  borderColor: on ? t.tone : undefined,
                  color: on ? t.tone : undefined,
                  background: on ? 'var(--bg-elev)' : undefined,
                }}>
                <t.icon size={12} strokeWidth={1.75} />
                {t.label}
                <span className="num" style={{ color: 'var(--text-faint)' }}>{(d[t.key] || []).length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length ? (
        <>
          <div>
            {visible.map(p => (
              <PersonRow key={p.name} p={p} tone={active.tone}
                expanded={open === p.name}
                onToggle={() => setOpen(open === p.name ? null : p.name)} />
            ))}
          </div>
          {list.length > 8 && (
            <button onClick={() => setShowAll(s => !s)} className="btn-quiet mt-4">
              {showAll ? 'Show top 8' : `Show all ${list.length}`}
            </button>
          )}
        </>
      ) : (
        <div className="py-10 text-center">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--text-dim)' }}>
            {tab === 'coaching' ? 'Nobody was named in a complaint.' : 'Nobody was named in praise yet.'}
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-faint)' }}>
            {tab === 'coaching'
              ? 'Customers who complained described the process, not a person.'
              : 'Named praise appears here as reviews accumulate.'}
          </p>
        </div>
      )}

      <p className="text-[11.5px] leading-relaxed mt-5 pt-4"
        style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
        Names are extracted by Claude only where a customer clearly identified the person who served
        them; every count opens to the exact sentence and links to the original review. Treat a
        complaint as a prompt to look into a shift, not a judgement on an employee — first names are
        not unique, and one review is one customer&rsquo;s account.
      </p>
    </div>
  );
}
