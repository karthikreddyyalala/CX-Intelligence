import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Sun, Moon, X, CheckCircle2, AlertCircle, Radar,
  ArrowUpRight, ArrowDownRight, Sparkles, GitCompare,
} from 'lucide-react';
import PeopleIntel from './components/PeopleIntel';
import KPIPanel from './components/KPIPanel';
import DisputeRadar from './components/DisputeRadar';
import DataConfidence from './components/DataConfidence';
import RevenueAtRisk from './components/RevenueAtRisk';
import ExecDigest from './components/ExecDigest';
import ResponseRate from './components/ResponseRate';
import LocationIntel from './components/LocationIntel';
import LocationThemes from './components/LocationThemes';
import IdentityIntel from './components/IdentityIntel';
import IdentityFlowModal from './components/IdentityFlowModal';
import AskPanel from './components/AskPanel';
import CompetitorPanel from './components/CompetitorPanel';
import PlatformRatings from './components/PlatformRatings';
import SentimentChart from './components/SentimentChart';
import VolumeChart from './components/VolumeChart';
import PainPointsChart from './components/PainPointsChart';
import InsightSummary from './components/InsightSummary';
import ReviewFeed from './components/ReviewFeed';
import FilterBar from './components/FilterBar';
import { useStats, usePainPoints, useInsightSummary, useSourceRatings } from './hooks/useApi';

const EMPTY_FILTERS = { sentiment: '', source: '', keyword: '', dateFrom: '', dateTo: '' };

const RUN_STAGES = [
  'Sweeping monitored platforms',
  'Pulling fresh reviews & mentions',
  'Claude reading every conversation',
  'Ranking complaints by impact',
  'Writing the executive brief',
];

// ── Toast ──────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, []);
  const cfg = {
    success: { c: 'var(--pos)', I: CheckCircle2 },
    error:   { c: 'var(--neg)', I: AlertCircle },
    info:    { c: 'var(--accent)', I: Sparkles },
  }[type] || { c: 'var(--accent)', I: Sparkles };
  const I = cfg.I;
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl panel text-sm animate-scale-in max-w-sm"
      style={{ borderColor: `color-mix(in srgb, ${cfg.c} 40%, var(--border))` }}
    >
      <I size={16} style={{ color: cfg.c }} />
      <span style={{ color: 'var(--text)' }}>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100 transition-opacity"><X size={14} /></button>
    </div>
  );
}

// ── Theme toggle ───────────────────────────────────────────────────
function ThemeToggle({ dark, toggle }) {
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative w-[54px] h-7 rounded-full transition-colors duration-300 flex-shrink-0"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)' }}
    >
      <span
        className="absolute top-[3px] w-[20px] h-[20px] rounded-full flex items-center justify-center transition-all duration-300"
        style={{ left: dark ? 'calc(100% - 23px)' : '3px', background: 'var(--accent)', color: '#17130a' }}
      >
        {dark ? <Moon size={11} /> : <Sun size={11} />}
      </span>
    </button>
  );
}

// ── Run progress overlay ───────────────────────────────────────────
function RunOverlay({ stage }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'color-mix(in srgb, var(--bg) 78%, transparent)', backdropFilter: 'blur(6px)' }}>
      <div className="panel px-8 py-7 w-[min(90vw,420px)]">
        <div className="flex items-center gap-3 mb-5">
          <span className="relative flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--accent-soft)' }}>
            <Radar size={18} className="spin" style={{ color: 'var(--accent)' }} />
          </span>
          <div>
            <p className="font-display font-bold text-[15px]" style={{ color: 'var(--text)' }}>Running intelligence sweep</p>
            <p className="eyebrow mt-0.5">Powered by Claude · Apify</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {RUN_STAGES.map((s, i) => {
            const done = i < stage, active = i === stage;
            return (
              <div key={s} className="flex items-center gap-3 text-[13px]">
                <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: done ? 'var(--accent)' : 'transparent', border: `1px solid ${done || active ? 'var(--accent)' : 'var(--border-2)'}` }}>
                  {done ? <CheckCircle2 size={11} style={{ color: '#17130a' }} />
                    : active ? <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--accent)', color: 'var(--accent)' }} /> : null}
                </span>
                <span style={{ color: done || active ? 'var(--text)' : 'var(--text-faint)', fontWeight: active ? 600 : 400 }}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [toast, setToast] = useState(null);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [flowOpen, setFlowOpen] = useState(false);
  const stageTimer = useRef(null);

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); }, [dark]);

  const statsFilters = { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  const { stats, refetch: rStats } = useStats(statsFilters);
  const { painPoints, refetch: rPP } = usePainPoints();
  const { summary, refetch: rSum } = useInsightSummary();
  const { sourceRatings, loading: ratingLoading, refetch: rRatings } = useSourceRatings();

  const refetchAll = useCallback(() => { rStats(); rPP(); rSum(); rRatings(); }, []);

  // Poll pipeline while running + advance the stage indicator
  useEffect(() => {
    if (!running) return;
    stageTimer.current = setInterval(() => setStage(s => Math.min(s + 1, RUN_STAGES.length - 1)), 4200);
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/pipeline/status');
        const data = await res.json();
        if (data.status !== 'running' && !data.isRunning) {
          clearInterval(id); clearInterval(stageTimer.current);
          setStage(RUN_STAGES.length);
          setTimeout(() => {
            setRunning(false); setStage(0);
            setToast({ type: 'success', message: `Sweep complete — ${data.total_collected ?? 0} new reviews processed.` });
            setTimeout(refetchAll, 400);
          }, 700);
        }
      } catch (_) {}
    }, 2500);
    return () => { clearInterval(id); clearInterval(stageTimer.current); };
  }, [running]);

  const runPipeline = async () => {
    if (running) return;
    setRunning(true); setStage(0);
    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'already_running') { setToast({ type: 'info', message: 'A sweep is already in progress…' }); return; }
      if (!res.ok) throw new Error(data.message || 'Failed to start');
    } catch (e) {
      setRunning(false); setStage(0);
      setToast({ type: 'error', message: e.message });
    }
  };

  const handleExportCsv = () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
    window.open(`/api/export/csv?${p.toString()}`, '_blank');
  };

  const total = stats?.totalReviews ?? 0;
  const negP = total ? Math.round((stats.negativeCount / total) * 100) : 0;
  const posP = total ? Math.round((stats.positiveCount / total) * 100) : 0;

  return (
    <div className="min-h-[100dvh] relative" style={{ background: 'var(--bg)' }}>
      <div className="atmosphere" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 sweep-line" style={{ background: 'color-mix(in srgb, var(--bg) 82%, transparent)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="relative flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Radar size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            </span>
            <div className="hidden sm:block leading-tight">
              <p className="font-display font-bold text-[15px] tracking-tight" style={{ color: 'var(--text)' }}>CX Intelligence</p>
              <p className="eyebrow">AI Social Listening · Avis</p>
            </div>
          </div>

          {/* Live pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full ml-1" style={{ background: 'color-mix(in srgb, var(--pos) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--pos) 30%, transparent)' }}>
            <span className="relative w-1.5 h-1.5 rounded-full live-dot" style={{ background: 'var(--pos)', color: 'var(--pos)' }} />
            <span className="text-[11px] font-semibold" style={{ color: 'var(--pos)' }}>Live</span>
          </div>

          <div className="flex-1" />

          {/* Inline metrics */}
          {total > 0 && (
            <div className="hidden lg:flex items-center gap-5 mr-1">
              <Metric label="Mentions" value={total.toLocaleString()} />
              <Metric label="Positive" value={`${posP}%`} tone="pos" trend />
              <Metric label="Complaints" value={`${negP}%`} tone="neg" />
            </div>
          )}

          <ThemeToggle dark={dark} toggle={() => setDark(d => !d)} />
          <button onClick={runPipeline} disabled={running} className="btn-signal">
            <RefreshCw size={14} className={running ? 'spin' : ''} />
            <span className="hidden sm:inline">{running ? 'Sweeping…' : 'Run AI Analysis'}</span>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-12">

        {/* Executive pulse */}
        <section>
          <SectionLabel eyebrow="01 — Executive pulse" title="One lens on every conversation about Avis"
            sub="Real reviews from Google, the App Store, Trustpilot, Google Play and Reddit — aggregated, scored, and ranked, each linking back to its source." />
          <DataConfidence stats={stats} sourceRatings={sourceRatings} />
          <KPIPanel stats={stats} sourceRatings={sourceRatings} />
        </section>

        {/* Dispute radar — the money view */}
        <section>
          <SectionLabel eyebrow="02 — Dispute radar" title="Billing disputes already public" accent
            sub="Every complaint that names a dollar figure, ranked by how likely it is to escalate into a chargeback, a BBB case, or a claim. Read from what customers actually wrote — nothing estimated." />
          <DisputeRadar />
        </section>

        {/* Ask — conversational analyst */}
        <section>
          <SectionLabel eyebrow="03 — Talk to your customers' feedback" title="Ask anything, get an answer with evidence" accent
            sub="Not a static report — a live analyst. Ask a question in plain English and Claude answers from the actual reviews, quoting the proof." />
          <AskPanel />
        </section>

        {/* AI brief */}
        <section>
          <SectionLabel eyebrow="04 — What leadership should know" title="AI executive brief" accent
            sub="A leadership-ready read on sentiment health and the actions that move the needle — generated by Claude." />
          <InsightSummary summary={summary} />
        </section>

        {/* Focus areas */}
        <section>
          <SectionLabel eyebrow="05 — Where to focus" title="Top complaints, ranked by impact"
            sub="The recurring, high-negativity themes dragging the brand down. Fix these first." />
          <PainPointsChart data={painPoints}
            onPainPointClick={theme => setFilters(f => ({ ...f, keyword: f.keyword === theme ? '' : theme }))} />
        </section>

        {/* Cost of inaction */}
        <section>
          <SectionLabel eyebrow="06 — The business case" title="What these complaints are costing" accent
            sub="Real complaint volume translated into revenue exposure. Set your own customer-value assumptions and every figure updates." />
          <RevenueAtRisk />
          <div className="mt-6">
            <ResponseRate />
          </div>
        </section>

        {/* Branch performance */}
        <section>
          <SectionLabel eyebrow="07 — Location intelligence" title="The same brand, 30 different experiences" accent
            sub="Every Avis branch scored on its own reviews — ranked worst-first, with the complaints and unanswered customers behind each number." />
          <LocationIntel />
          <div className="mt-6">
            <LocationThemes />
          </div>
        </section>

        {/* Staff praised in reviews */}
        <section>
          <SectionLabel eyebrow="08 — People intelligence" title="Staff customers praised by name"
            sub="Customers who called out someone by name for great service — who is winning goodwill for the brand. Every count opens to the exact review." />
          <PeopleIntel />
        </section>

        {/* Duplicate reviewer detection */}
        <section>
          <SectionLabel eyebrow="09 — Identity intelligence" title="When one angry customer sounds like four" accent
            sub="The same person can rate on every platform under a different name. Signal analysis finds the likely duplicates — same story, same day, same branch — and AI reads each cluster and rules on it, reasoning shown."
            action={
              <button onClick={() => setFlowOpen(true)}
                className="btn-quiet inline-flex items-center gap-1.5"
                aria-haspopup="dialog">
                <GitCompare size={14} />How it works
              </button>
            } />
          <IdentityIntel />
        </section>

        {/* Platforms */}
        <section>
          <SectionLabel eyebrow="10 — Every channel, one place" title="Platform intelligence"
            sub="Live rating and sentiment per source. Click any platform to filter the feed below." />
          <PlatformRatings sourceRatings={sourceRatings} loading={ratingLoading}
            onSourceClick={src => setFilters(f => ({ ...f, source: f.source === src ? '' : src }))} />
        </section>

        {/* Trends */}
        <section>
          <SectionLabel eyebrow="11 — Signal over time" title="Sentiment & volume trends"
            sub="How the conversation is moving day to day, and where the volume comes from." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SentimentChart data={stats?.sentimentByDay} />
            <VolumeChart data={stats?.volumeBySource}
              onSourceClick={src => setFilters(f => ({ ...f, source: f.source === src ? '' : src }))} />
          </div>
        </section>

        {/* Competitive context */}
        <section>
          <SectionLabel eyebrow="12 — Competitive context" title="How Avis stacks up against rivals"
            sub="Benchmark rating, sentiment mix and share of voice against Hertz, Enterprise, Budget and National. Illustrative for now — one switch pulls each rival's live reviews." />
          <CompetitorPanel />
        </section>

        {/* Feed */}
        <section>
          <SectionLabel eyebrow="13 — The raw signal" title="Live conversation feed"
            sub="Every review and mention, filterable by platform, sentiment, topic and date." />
          <FilterBar filters={filters} onFilterChange={setFilters} totalCount={reviewTotal} onExportCsv={handleExportCsv} />
          <ReviewFeed filters={filters} onThemeClick={t => setFilters(f => ({ ...f, keyword: t }))} onTotalChange={setReviewTotal} />
        </section>

        {/* Take-away brief */}
        <section>
          <SectionLabel eyebrow="14 — Take it with you" title="This week, in one email" accent
            sub="A leadership-ready summary built from the same real reviews — one click to your clipboard." />
          <ExecDigest />
        </section>
      </main>

      <footer className="relative z-10 mt-6 py-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1360px] mx-auto px-6 flex items-center justify-between eyebrow">
          <span>CX Intelligence · Claude + Apify</span>
          <span>Refreshed daily · avis.com</span>
        </div>
      </footer>

      {running && <RunOverlay stage={stage} />}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <IdentityFlowModal open={flowOpen} onClose={() => setFlowOpen(false)} />
    </div>
  );
}

function Metric({ label, value, tone, trend }) {
  const color = tone === 'pos' ? 'var(--pos)' : tone === 'neg' ? 'var(--neg)' : 'var(--text)';
  return (
    <div className="text-right leading-tight">
      <p className="num text-[13px] font-semibold flex items-center gap-1 justify-end" style={{ color }}>
        {trend && <ArrowUpRight size={12} />}{value}
      </p>
      <p className="eyebrow">{label}</p>
    </div>
  );
}

function SectionLabel({ eyebrow, title, sub, accent, action }) {
  return (
    <div className="mb-5">
      <div className="flex items-start gap-4 justify-between">
        <div className="max-w-[62ch]">
          <p className="eyebrow mb-2" style={{ color: accent ? 'var(--accent)' : undefined }}>{eyebrow}</p>
          <h2 className="font-display font-bold tracking-tight leading-tight text-2xl sm:text-[30px]" style={{ color: 'var(--text)' }}>{title}</h2>
        </div>
        {action && <div className="flex-shrink-0 pt-1">{action}</div>}
      </div>
      {sub && <p className="mt-2 text-[14px] leading-relaxed max-w-[62ch]" style={{ color: 'var(--text-dim)' }}>{sub}</p>}
    </div>
  );
}
