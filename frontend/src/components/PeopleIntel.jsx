import React, { useEffect, useState } from 'react';
import { Award, Quote, ExternalLink, Users } from 'lucide-react';

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

  const list = d.recognition || [];
  const visible = showAll ? list : list.slice(0, 8);

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
          <Users size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
        </span>
        <div>
          <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>Staff customers praised by name</p>
          <p className="eyebrow mt-0.5">
            <span className="num">{list.length}</span> people named across <span className="num">{d.reviewsNamingSomeone}</span> reviews
          </p>
        </div>
      </div>

      {visible.length ? (
        <>
          <div>
            {visible.map(p => (
              <PersonRow key={p.name} p={p} tone="var(--pos)"
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
          <p className="text-[13px] font-semibold" style={{ color: 'var(--text-dim)' }}>Nobody was named in praise yet.</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-faint)' }}>Named praise appears here as reviews accumulate.</p>
        </div>
      )}
    </div>
  );
}
