import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ExternalLink, Hash, ShieldAlert, Clock, ChevronDown,
  ChevronRight, HelpCircle, X, ListFilter,
} from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

/**
 * Billing disputes already published in public, ranked by escalation risk.
 *
 * Nothing new is fetched — this re-reads the reviews already collected and pulls
 * out the dollar figure, the kind of charge, and the language that predicts an
 * escalation (chargeback, BBB case, legal action). The worklist is the product:
 * each row is one customer somebody could call back today.
 *
 * Usability: the four headline totals are always visible (skip-friendly); the
 * detail — charge mix + the ranked worklist — sits under one disclosure so a
 * reader can go deep or move on. Built to Nielsen's ten heuristics (see notes
 * against each control below).
 */

const RISK_BANDS = [
  { min: 75, label: 'Critical', color: 'var(--neg)' },
  { min: 55, label: 'High',     color: '#e0913a' },
  { min: 35, label: 'Medium',   color: 'var(--accent)' },
  { min: 0,  label: 'Low',      color: 'var(--text-faint)' },
];
const bandFor = risk => RISK_BANDS.find(b => risk >= b.min);

const money = n => `$${Math.round(n).toLocaleString()}`;

function daysAgo(date) {
  if (!date) return null;
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function Row({ item, open, onToggle }) {
  const band = bandFor(item.risk);
  const age = daysAgo(item.date);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left px-4 sm:px-5 py-4 flex items-start gap-4 transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
      >
        {/* H4 consistency: severity stripe reads state before any number is parsed. */}
        <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: band.color }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1.5">
            <span className="num font-display font-bold text-[19px] tracking-tight" style={{ color: 'var(--text)' }}>
              {money(item.amount)}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md font-medium"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
              {item.type}
            </span>
            {item.hasReference && (
              <span className="text-[11px] px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <Hash size={10} />lookup ready
              </span>
            )}
            {!item.answered && (
              <span className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                style={{ background: `color-mix(in srgb, var(--neg) 12%, transparent)`, color: 'var(--neg)' }}>
                no reply yet
              </span>
            )}
          </div>

          <p className="text-[13px] leading-relaxed" style={{
            color: 'var(--text-dim)',
            display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2,
            WebkitBoxOrient: 'vertical', overflow: open ? 'visible' : 'hidden',
          }}>
            {item.text}
          </p>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 eyebrow">
            {item.branch && <span>{item.branch}</span>}
            {age != null && (
              <span className="inline-flex items-center gap-1"><Clock size={10} />{age}d ago</span>
            )}
            {item.signals.slice(0, 3).map(s => (
              <span key={s} style={{ color: band.color }}>{s}</span>
            ))}
            {/* H1 visibility: tell the reader the row opens, and to what. */}
            <span style={{ color: 'var(--text-faint)' }}>{open ? 'less' : 'details'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right leading-tight">
            <p className="num font-semibold text-[15px]" style={{ color: band.color }}>{item.risk}</p>
            <p className="eyebrow">{band.label}</p>
          </div>
          <ChevronDown size={14} className="transition-transform duration-200"
            style={{ color: 'var(--text-faint)', transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-4 pl-9 sm:pl-10 animate-fade-in">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]" style={{ color: 'var(--text-faint)' }}>
            {item.reference && (
              <span>Reference in review: <span className="num font-semibold" style={{ color: 'var(--accent)' }}>{item.reference}</span></span>
            )}
            {item.allAmounts.length > 1 && (
              <span>All figures cited: {item.allAmounts.map(money).join(' · ')}</span>
            )}
            <span>{item.source}{item.author ? ` · ${item.author}` : ''}</span>
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
                style={{ color: 'var(--accent)' }}>
                Open original <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DisputeRadar() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [detailOpen, setDetailOpen] = useState(true);   // H3: skip or go deep
  const [openRows, setOpenRows] = useState(() => new Set());
  const [showHelp, setShowHelp] = useState(false);       // H10: help on demand

  useEffect(() => {
    let alive = true;
    fetch('/api/disputes?limit=60')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    if (!data) return [];
    if (filter === 'unanswered') return data.items.filter(i => !i.answered);
    if (filter === 'high') return data.items.filter(i => i.risk >= 55);
    if (filter === 'lookup') return data.items.filter(i => i.hasReference);
    return data.items;
  }, [data, filter]);

  const toggleRow = useCallback(id => {
    setOpenRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const expandAll = () => setOpenRows(new Set(shown.map(i => i.id)));
  const collapseAll = () => setOpenRows(new Set());
  const allOpen = shown.length > 0 && shown.every(i => openRows.has(i.id));

  // H9: recover from errors — plain message, not a stack trace.
  if (error) {
    return (
      <div className="panel p-6 text-[13px]" style={{ color: 'var(--text-dim)' }}>
        Dispute data could not be loaded ({error}). Try refreshing — everything else on the
        page still works.
      </div>
    );
  }
  // H1: visibility of system status — skeleton matches final layout.
  if (!data) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-[86px] rounded-xl shimmer" />)}
        </div>
        <div className="h-14 rounded-xl shimmer" />
      </div>
    );
  }

  const t = data.totals;

  if (!t.disputes) {
    return (
      <div className="panel p-10 text-center">
        <ShieldAlert size={22} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
        <p className="font-display font-bold text-[16px]" style={{ color: 'var(--text)' }}>No public disputes detected</p>
        <p className="text-[13px] mt-1.5 max-w-[42ch] mx-auto" style={{ color: 'var(--text-dim)' }}>
          No complaint in the current corpus cites a dollar figure. Re-run the sweep to check for new ones.
        </p>
      </div>
    );
  }

  const FILTERS = [
    { key: 'all',        label: 'All',          n: t.disputes },
    { key: 'high',       label: 'High risk',    n: data.items.filter(i => i.risk >= 55).length },
    { key: 'unanswered', label: 'No reply yet',  n: t.unanswered },
    { key: 'lookup',     label: 'Lookup ready', n: t.withReference },
  ];
  const activeFilter = FILTERS.find(f => f.key === filter);

  return (
    <div className="space-y-5">
      {/* ── Totals — always visible so the section can be skipped at a glance. ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { v: t.totalDisputed,   l: 'Disputed in public', tone: 'var(--neg)', fmt: money },
          { v: t.disputes,        l: 'Open disputes' },
          { v: t.unansweredValue, l: `No reply yet (${t.unanswered})`, tone: 'var(--neg)', fmt: money },
          { v: t.withReference,   l: 'Cite a booking ref', tone: 'var(--accent)' },
        ].map(s => (
          <div key={s.l} className="tile p-4">
            <AnimatedNumber
              value={s.v}
              format={s.fmt || (n => Math.round(n).toLocaleString())}
              className="num font-display font-bold tracking-tight text-[26px] leading-none block"
              style={{ color: s.tone || 'var(--text)' }}
            />
            <p className="eyebrow mt-2">{s.l}</p>
          </div>
        ))}
      </div>

      {/* ── Disclosure header: the drop option. Open to go deep, close to skip. ── */}
      <div className="panel overflow-hidden">
        <button
          onClick={() => setDetailOpen(o => !o)}
          aria-expanded={detailOpen}
          aria-controls="dispute-detail"
          className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
        >
          <ChevronRight size={16} className="transition-transform duration-200 flex-shrink-0"
            style={{ color: 'var(--accent)', transform: detailOpen ? 'rotate(90deg)' : 'none' }} />
          <span className="font-display font-semibold text-[14px]" style={{ color: 'var(--text)' }}>
            The {t.disputes}-dispute worklist
          </span>
          {/* H1 + H6: summary stays visible even when collapsed — no need to open to recall it. */}
          <span className="eyebrow hidden sm:inline">charge mix · ranked call-back list</span>
          <span className="ml-auto text-[12px] font-medium" style={{ color: 'var(--text-dim)' }}>
            {detailOpen ? 'Hide' : 'Show'}
          </span>
        </button>

        {detailOpen && (
          <div id="dispute-detail" className="animate-fade-in" style={{ borderTop: '1px solid var(--border)' }}>
            {/* Charge mix. */}
            <div className="p-5" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="eyebrow mb-3">Contested charges by type</p>
              <div className="space-y-2">
                {data.byType.slice(0, 6).map(row => {
                  const pct = Math.round((row.total / t.totalDisputed) * 100);
                  return (
                    <div key={row.type} className="flex items-center gap-3">
                      <span className="text-[12.5px] w-[132px] flex-shrink-0 truncate" style={{ color: 'var(--text-dim)' }}>
                        {row.type}
                      </span>
                      <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
                        <span className="block h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: 'var(--accent)' }} />
                      </span>
                      <span className="num text-[12.5px] w-[74px] text-right" style={{ color: 'var(--text)' }}>{money(row.total)}</span>
                      <span className="num eyebrow w-[34px] text-right">{row.count}×</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filter bar + row controls. */}
            <div className="flex items-center gap-2 px-4 sm:px-5 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
              <ListFilter size={13} style={{ color: 'var(--text-faint)' }} />
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className="text-[12px] px-2.5 py-1 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{
                    background: filter === f.key ? 'var(--accent)' : 'var(--surface)',
                    color: filter === f.key ? '#17130a' : 'var(--text-dim)',
                    border: '1px solid var(--border)',
                  }}>
                  {f.label} <span className="num opacity-70">{f.n}</span>
                </button>
              ))}
              {/* H3: user control — a way out of a filter, always offered when one is active. */}
              {filter !== 'all' && (
                <button onClick={() => setFilter('all')}
                  className="text-[12px] px-2 py-1 rounded-lg inline-flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  style={{ color: 'var(--text-faint)' }}>
                  <X size={11} />clear
                </button>
              )}
              {/* H7: efficiency — expand/collapse every row at once. */}
              <button onClick={allOpen ? collapseAll : expandAll}
                className="ml-auto text-[12px] px-2 py-1 rounded-lg font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                style={{ color: 'var(--text-dim)' }}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            {/* H1: status line — what you're looking at and how much of it. */}
            <div className="px-4 sm:px-5 pt-2.5 text-[12px]" style={{ color: 'var(--text-faint)' }}>
              Showing <span className="num" style={{ color: 'var(--text-dim)' }}>{shown.length}</span> of{' '}
              <span className="num" style={{ color: 'var(--text-dim)' }}>{t.disputes}</span>
              {filter !== 'all' && <> · filtered by <span style={{ color: 'var(--text-dim)' }}>{activeFilter.label}</span></>}
              {' '}· ranked highest-risk first
            </div>

            {/* The worklist. */}
            <div className="mt-1">
              {shown.length === 0
                ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>Nothing matches this filter.</p>
                    <button onClick={() => setFilter('all')}
                      className="mt-2 text-[12px] font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                      Show all {t.disputes} disputes
                    </button>
                  </div>
                )
                : shown.map(item => (
                  <Row key={item.id} item={item}
                    open={openRows.has(item.id)}
                    onToggle={() => toggleRow(item.id)} />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* H10: help & documentation — folded away until asked for. */}
      <div>
        <button onClick={() => setShowHelp(h => !h)}
          aria-expanded={showHelp}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
          style={{ color: 'var(--text-dim)' }}>
          <HelpCircle size={13} />How is the risk score calculated?
        </button>
        {showHelp && (
          <p className="text-[12px] leading-relaxed max-w-[74ch] mt-2 animate-fade-in" style={{ color: 'var(--text-faint)' }}>
            The score (0–100) combines three inputs read straight from the review: the disputed
            amount (log-scaled, so $1,500 is not treated as 30× worse than $50), escalation
            language (&ldquo;unauthorized&rdquo;, &ldquo;chargeback&rdquo;, &ldquo;BBB&rdquo;,
            legal references), and the star rating. Nothing is estimated. Amounts above $20,000
            are excluded as implausible for a single rental, and when a review names several
            figures only the largest is counted — so the totals are a floor, not a guess.
          </p>
        )}
      </div>
    </div>
  );
}
