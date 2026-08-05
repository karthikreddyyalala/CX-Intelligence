import React, { useEffect, useState } from 'react';
import { Grid3x3, Info } from 'lucide-react';

/**
 * Theme x branch matrix.
 *
 * The point is triage: a complaint spread evenly across every branch is a policy
 * or system problem, while one concentrated in two branches is a local fix. The
 * concentration figure below the grid makes that call explicit instead of
 * leaving it to be eyeballed.
 */

// Themes arrive sorted most-concentrated first. Rather than apply a threshold —
// any fixed cutoff is arbitrary once there are 30 branches — the two ends of the
// ranking are shown against each other, which is the comparison that drives the
// decision anyway.
const ENDS = 3;

function Cell({ value, max }) {
  const intensity = max ? value / max : 0;
  return (
    <div className="h-8 rounded flex items-center justify-center"
      style={{
        // A single hue ramped by opacity — readable in both themes, and it
        // never implies a category difference where there is only magnitude.
        background: intensity > 0.02
          ? `color-mix(in srgb, var(--neg) ${Math.round(12 + intensity * 78)}%, transparent)`
          : 'var(--bg-elev)',
      }}
      title={`${value} review-equivalents`}>
      {value >= 0.5 && (
        <span className="num text-[10.5px] font-semibold"
          style={{ color: intensity > 0.55 ? '#fff' : 'var(--text-dim)' }}>
          {Math.round(value)}
        </span>
      )}
    </div>
  );
}

export default function LocationThemes() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/location-themes')
      .then(r => r.json())
      .then(j => (j.error ? setErr(j.error) : setD(j)))
      .catch(e => setErr(e.message));
  }, []);

  if (err) return null;
  if (!d) return <div className="panel h-64 shimmer" />;
  if (!d.themes?.length || !d.branches?.length) return null;

  const max = Math.max(...d.branches.flatMap(b => b.cells), 1);
  const branches = showAll ? d.branches : d.branches.slice(0, 10);
  // Columns stay wide enough for a theme label to wrap on spaces rather than
  // mid-word; the grid scrolls sideways inside its own container instead.
  const cols = `minmax(9rem, 1.5fr) repeat(${d.themes.length}, minmax(4.5rem, 1fr))`;

  const local = d.concentration.slice(0, ENDS);                 // most concentrated
  const systemic = d.concentration.slice(-ENDS).reverse();      // most widespread

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
          <Grid3x3 size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
        </span>
        <div>
          <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>Is it the branch, or is it us?</p>
          <p className="eyebrow mt-0.5">Complaint themes mapped across branches</p>
        </div>
      </div>

      {/* Wide grid scrolls inside its own container so the page never does. */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div style={{ minWidth: `${9 + d.themes.length * 4.75}rem` }}>
          <div className="grid gap-1 mb-1.5" style={{ gridTemplateColumns: cols }}>
            <span />
            {d.themes.map(t => (
              <span key={t.name} className="eyebrow text-[9.5px] leading-tight text-center px-0.5"
                style={{ overflowWrap: 'normal', wordBreak: 'keep-all' }}>
                {t.name}
              </span>
            ))}
          </div>

          {branches.map(b => (
            <div key={b.placeId} className="grid gap-1 mb-1 items-center" style={{ gridTemplateColumns: cols }}>
              <div className="min-w-0 pr-2">
                <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{b.name}</p>
                <p className="text-[10.5px] truncate" style={{ color: 'var(--text-faint)' }}>
                  {b.city} · <span className="num">{b.negatives}</span> negative
                </p>
              </div>
              {b.cells.map((v, i) => <Cell key={i} value={v} max={max} />)}
            </div>
          ))}
        </div>
      </div>

      {d.branches.length > 10 && (
        <button onClick={() => setShowAll(s => !s)} className="btn-quiet mt-3">
          {showAll ? 'Show top 10 branches' : `Show all ${d.branches.length} branches`}
        </button>
      )}

      {/* The actual takeaway, stated rather than implied. */}
      <div className="grid gap-4 sm:grid-cols-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div>
          <p className="eyebrow mb-2">Most concentrated — send someone to the branch</p>
          <div className="space-y-1.5">
            {local.map(c => (
              <p key={c.theme} className="text-[12.5px] leading-snug" style={{ color: 'var(--text-dim)' }}>
                <span style={{ color: 'var(--text)' }}>{c.theme}</span>
                <span style={{ color: 'var(--text-faint)' }}>
                  {' — '}<span className="num">{Math.round(c.topShare * 100)}%</span> at {c.topBranch},{' '}
                  <span className="num">{c.topBranchIndex}×</span> its usual share
                </span>
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">Most widespread — fix the policy, not the branch</p>
          <div className="space-y-1.5">
            {systemic.map(c => (
              <p key={c.theme} className="text-[12.5px] leading-snug" style={{ color: 'var(--text-dim)' }}>
                <span style={{ color: 'var(--text)' }}>{c.theme}</span>
                <span style={{ color: 'var(--text-faint)' }}>
                  {' — spread across the network, no branch above '}
                  <span className="num">{Math.round(c.topShare * 100)}%</span>
                </span>
              </p>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed mt-4 pt-3"
        style={{ color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}>
        <Info size={11} className="inline mr-1 -mt-0.5" />
        Cells are review-equivalents: a complaint tagged with three themes counts one third to each,
        so a branch&rsquo;s row sums to its real negative total. Themes are ranked by how unevenly they
        spread across the {d.branchCount} branches with at least three tagged complaints, and each is
        weighed against that branch&rsquo;s own share of all complaints — so a busy counter doesn&rsquo;t
        read as a hotspot just for being busy.
      </p>
    </div>
  );
}
