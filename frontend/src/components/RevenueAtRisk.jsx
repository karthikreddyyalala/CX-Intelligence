import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, SlidersHorizontal, Info, BookOpen } from 'lucide-react';

// Conservative starting assumptions. Every one is user-editable — the panel is a
// model the viewer controls, never a claim the tool makes on its own.
const DEFAULTS = {
  rentalValue: 250,   // $ per rental
  rentalsPerYear: 2,
  loyaltyYears: 3,
  voiceMultiplier: 5, // unhappy customers per customer who writes a review
  churnRate: 20,      // % of unhappy customers who stop renting
};

const money = (n) => '$' + Math.round(n).toLocaleString();

// Headline currency: smaller raised "$" with dominant digits (financial-report
// convention) rather than a same-size dollar sign.
function Money({ value, className = '', style }) {
  return (
    <span className={`metric ${className}`} style={style}>
      <span className="cur">$</span>{Math.round(value).toLocaleString()}
    </span>
  );
}

function Field({ label, value, onChange, prefix, suffix, hint }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      <span className="flex items-center gap-1 rounded-xl px-2.5 py-2"
        style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
        {prefix && <span className="num text-[13px]" style={{ color: 'var(--text-faint)' }}>{prefix}</span>}
        <input
          type="number" min="0" value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="num w-full bg-transparent outline-none text-[15px] font-semibold"
          style={{ color: 'var(--text)' }}
        />
        {suffix && <span className="num text-[12px]" style={{ color: 'var(--text-faint)' }}>{suffix}</span>}
      </span>
      {hint && <span className="text-[11px] mt-1 block" style={{ color: 'var(--text-faint)' }}>{hint}</span>}
    </label>
  );
}

// Collection depth is uneven across channels: the App Store is read from Apple's
// RSS feed and reaches back months, while the Apify-backed sources only hold what
// was newest at scrape time. A cross-platform window longer than a week would
// therefore be mostly App Store — the most negative channel — and would overstate
// the negative rate through coverage bias rather than customer sentiment. So the
// long view is offered for one source at a time, and labelled as such.
const SCOPES = [
  { key: '7', label: 'Last 7 days', query: 'days=7', note: 'All 5 platforms · complete coverage' },
  { key: 'as60', label: 'App Store · 60 days', query: `days=60&source=${encodeURIComponent('App Store')}`,
    note: 'App Store only — the one channel with history this far back' },
  { key: 'all', label: 'All data', query: 'days=all', note: 'Every review on file · coverage varies by channel' },
];

export default function RevenueAtRisk() {
  const [basis, setBasis] = useState(null);
  const [err, setErr] = useState('');
  const [a, setA] = useState(DEFAULTS);
  const [period, setPeriod] = useState('7');
  const scope = SCOPES.find(s => s.key === period) || SCOPES[0];

  useEffect(() => {
    setBasis(null); setErr('');
    fetch(`/api/risk-basis?${scope.query}`)
      .then(r => r.json())
      .then(d => (d.error ? setErr(d.error) : setBasis(d)))
      .catch(e => setErr(e.message));
  }, [scope.query]);

  const calc = useMemo(() => {
    if (!basis) return null;
    const clv = a.rentalValue * a.rentalsPerYear * a.loyaltyYears;
    const affected = basis.negativeCount * a.voiceMultiplier;
    const atRisk = affected * (a.churnRate / 100);
    const revenue = atRisk * clv;
    return { clv, affected, atRisk, revenue };
  }, [basis, a]);

  if (err) {
    return (
      <div className="panel p-5" style={{ borderColor: 'color-mix(in srgb, var(--neg) 30%, var(--border))' }}>
        <p className="text-[13px]" style={{ color: 'var(--neg)' }}>Could not load risk basis: {err}</p>
      </div>
    );
  }
  const periodTabs = (
    <div className="flex items-center gap-1 p-0.5 rounded-xl"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
      {SCOPES.map(p => {
        const on = p.key === period;
        return (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className="px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap"
            style={on ? { background: 'var(--accent)', color: '#17130a' } : { color: 'var(--text-dim)' }}>
            {p.label}
          </button>
        );
      })}
    </div>
  );

  if (!basis || !calc) {
    return (
      <div className="panel p-5 sm:p-6">
        <div className="flex justify-end mb-4">{periodTabs}</div>
        <div className="h-56 rounded-2xl shimmer" />
      </div>
    );
  }

  const themes = basis.themes.slice(0, 5);

  return (
    <div className="panel p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
            <Calculator size={17} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>What these complaints cost</p>
            <p className="eyebrow mt-0.5">
              {basis.dateFrom} to {basis.dateTo} · {scope.note}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {periodTabs}
          <span className="badge inline-flex items-center gap-1"
            style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', background: 'var(--accent-soft)' }}>
            <SlidersHorizontal size={10} /> Adjustable
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
        {/* ── Inputs ── */}
        <div>
          <p className="eyebrow mb-3">Your assumptions</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Avg rental value" prefix="$" value={a.rentalValue}
              onChange={v => setA(s => ({ ...s, rentalValue: v }))} />
            <Field label="Rentals per year" value={a.rentalsPerYear}
              onChange={v => setA(s => ({ ...s, rentalsPerYear: v }))} />
            <Field label="Years a customer stays" value={a.loyaltyYears}
              onChange={v => setA(s => ({ ...s, loyaltyYears: v }))} />
            <Field label="Churn after bad experience" suffix="%" value={a.churnRate}
              onChange={v => setA(s => ({ ...s, churnRate: v }))} />
            <div className="col-span-2">
              <Field label="Unhappy customers per public review" value={a.voiceMultiplier}
                onChange={v => setA(s => ({ ...s, voiceMultiplier: v }))}
                hint="Most unhappy customers never write a review. Set this to whatever multiple your team considers defensible." />
            </div>
          </div>

          <button onClick={() => setA(DEFAULTS)}
            className="chip mt-3 inline-flex items-center gap-1" style={{ color: 'var(--text-dim)' }}>
            Reset to defaults
          </button>
        </div>

        {/* ── Output ── */}
        <div>
          <p className="eyebrow mb-3">Estimated annualised exposure</p>
          <div className="rounded-2xl p-5"
            style={{ background: 'color-mix(in srgb, var(--neg) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--neg) 22%, transparent)' }}>
            <p className="text-[38px]" style={{ color: 'var(--neg)' }}>
              <Money value={calc.revenue} />
            </p>
            <p className="text-[12px] mt-2.5" style={{ color: 'var(--text-dim)' }}>
              at risk from <span className="num font-semibold" style={{ color: 'var(--text)' }}>{basis.negativeCount}</span> unhappy customers
            </p>

            {/* Transparent, auditable formula chain */}
            <div className="mt-4 pt-4 space-y-1.5" style={{ borderTop: '1px solid color-mix(in srgb, var(--neg) 18%, transparent)' }}>
              {[
                [`${basis.negativeCount} negative reviews`, 'counted from real data', true],
                [`× ${a.voiceMultiplier} = ${calc.affected.toLocaleString()} unhappy customers`, 'your multiplier', false],
                [`× ${a.churnRate}% = ${Math.round(calc.atRisk).toLocaleString()} likely to leave`, 'your churn rate', false],
                [`× ${money(calc.clv)} lifetime value`, `${money(a.rentalValue)} × ${a.rentalsPerYear}/yr × ${a.loyaltyYears} yrs`, false],
              ].map(([line, note, isReal]) => (
                <div key={line} className="flex items-baseline justify-between gap-3">
                  <span className="num text-[12px]" style={{ color: 'var(--text)' }}>{line}</span>
                  <span className="text-[10px] uppercase tracking-wider whitespace-nowrap"
                    style={{ color: isReal ? 'var(--pos)' : 'var(--text-faint)' }}>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Where it comes from */}
          <p className="eyebrow mt-5 mb-2.5">Where it's coming from</p>
          <div className="space-y-2">
            {themes.map(t => (
              <div key={t.name}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-[13px] capitalize" style={{ color: 'var(--text)' }}>{t.name}</span>
                  <span className="num text-[12.5px] font-semibold" style={{ color: 'var(--text-dim)' }}>
                    {money(calc.revenue * t.share)}
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.min(t.share / (themes[0].share || 1) * 100, 100)}%`, background: 'var(--neg)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Honesty footer */}
      <div className="mt-5 pt-4 space-y-2.5" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-start gap-2">
          <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-faint)' }} />
          <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            The <strong style={{ color: 'var(--text-dim)' }}>{basis.negativeCount} negative reviews</strong> and the
            complaint-theme split are counted directly from real customer reviews
            ({basis.dateFrom} to {basis.dateTo}{basis.source ? `, ${basis.source} only` : ', all 5 platforms'}).
            Customer value, churn rate and the review multiplier are
            assumptions you set above — change them and every figure updates. Theme amounts are allocated by each
            theme's share of tagged complaints, so they sum to the total.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <BookOpen size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            <strong style={{ color: 'var(--text-dim)' }}>Why ratings map to revenue:</strong> Luca,
            <em> Reviews, Reputation, and Revenue: The Case of Yelp.com</em> (Harvard Business School Working
            Paper 12-016, 2011) established that ratings causally affect revenue —{' '}
            <strong style={{ color: 'var(--text-dim)' }}>5–9% per star</strong>, measured on independent
            restaurants (the study found no significant effect for chain-affiliated businesses, so treat it as
            directional here, not as an Avis-specific elasticity). Proserpio &amp; Zervas (2018) separately found
            that businesses which <strong style={{ color: 'var(--text-dim)' }}>respond</strong> to reviews gain
            +0.12 stars on average.
          </p>
        </div>
      </div>
    </div>
  );
}
