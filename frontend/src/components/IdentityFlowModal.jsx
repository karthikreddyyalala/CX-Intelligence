import React, { useEffect } from 'react';
import {
  X, Layers, Hash, GitCompare, SlidersHorizontal,
  Boxes, Sparkles, ListChecks, ArrowDown,
} from 'lucide-react';

/**
 * Explains, in plain English, how identity resolution decides that two
 * differently-named reviews are the same person or the same incident.
 * Opened from the section header — a walkthrough of the pipeline, not a control.
 */

const STAGES = [
  {
    icon: Layers, tag: 'Input',
    title: 'Collect every review',
    body: 'All reviews across Google, Trustpilot, the App Store, Google Play and Reddit land in one place — names, dates, branches, and the full text.',
  },
  {
    icon: Hash, tag: 'Step 1 · TF-IDF',
    title: 'Weight the words that matter',
    body: 'Each review is turned into a word-vector. Common words ("the", "car", "rental") count for almost nothing; rare, specific words ("pothole", "$1,410", "spare tire") are weighted heavily — those are what make one story identifiable.',
  },
  {
    icon: GitCompare, tag: 'Step 2 · Cosine similarity',
    title: 'Measure how much two stories overlap',
    body: 'Every pair of complaints is compared. A high score means the same rare words appear in both — the same story told twice, even under two different names.',
  },
  {
    icon: SlidersHorizontal, tag: 'Step 3 · Signals',
    title: 'Add the corroborating evidence',
    body: 'Text alone is not enough. The score is boosted when the two share a branch, fall on the same or a nearby date, or appear across different platforms — the fingerprints of one real event.',
  },
  {
    icon: Boxes, tag: 'Step 4 · Cluster',
    title: 'Group into four patterns',
    body: 'Matches are sorted into same-incident (one event, two posts), multi-branch (one name across locations), rating-burst (a run of star-only ratings), and cross-platform (one name on several sites).',
  },
  {
    icon: Sparkles, tag: 'Step 5 · AI verification',
    title: 'Claude reads each cluster and rules on it',
    body: 'A skeptical check: a shared complaint TYPE ("bad service") is not proof — a shared specific DETAIL ("the $1,410 tire charge on the 3rd") is. Claude returns a verdict and a confidence score, with its reasoning shown.',
  },
  {
    icon: ListChecks, tag: 'Output',
    title: 'Rank what survived',
    body: 'Clusters are ordered model-confirmed → signal-only → discarded, so the review counts stay honest: one angry customer never looks like four.',
  },
];

export default function IdentityFlowModal({ open, onClose }) {
  // H3: Escape always closes. Body scroll locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 animate-fade-in"
      style={{ background: 'color-mix(in srgb, var(--bg) 74%, transparent)', backdropFilter: 'blur(7px)' }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="flow-title"
    >
      <div
        className="panel w-[min(96vw,720px)] max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start gap-3 px-6 py-5"
          style={{ background: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}>
          <span className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'var(--accent-soft)' }}>
            <GitCompare size={17} style={{ color: 'var(--accent)' }} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="eyebrow" style={{ color: 'var(--accent)' }}>How it works</p>
            <h3 id="flow-title" className="font-display font-bold text-[18px] leading-tight" style={{ color: 'var(--text)' }}>
              Finding one person behind many names
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            style={{ color: 'var(--text-dim)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Flow */}
        <div className="px-6 py-6">
          <ol className="relative">
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const last = i === STAGES.length - 1;
              return (
                <li key={s.title} className="relative pl-14 pb-6 last:pb-0">
                  {/* connector line */}
                  {!last && (
                    <span className="absolute left-[19px] top-11 bottom-0 w-px" style={{ background: 'var(--border-2)' }} />
                  )}
                  {/* node */}
                  <span className="absolute left-0 top-0 flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--accent)' }}>
                    <Icon size={17} />
                  </span>
                  <p className="eyebrow mb-1">{s.tag}</p>
                  <p className="font-display font-semibold text-[15px] leading-snug" style={{ color: 'var(--text)' }}>{s.title}</p>
                  <p className="text-[13px] leading-relaxed mt-1 max-w-[58ch]" style={{ color: 'var(--text-dim)' }}>{s.body}</p>
                  {!last && (
                    <ArrowDown size={13} className="mt-3" style={{ color: 'var(--text-faint)' }} />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Worked example — the payoff, made concrete. */}
          <div className="tile p-5 mt-2">
            <p className="eyebrow mb-3">Worked example</p>
            <div className="space-y-2 text-[13px]" style={{ color: 'var(--text-dim)' }}>
              <p><span style={{ color: 'var(--text)' }}>"Johnny B" on Trustpilot</span> and <span style={{ color: 'var(--text)' }}>"J. Barnes" on Google</span> both mention a <span className="num" style={{ color: 'var(--accent)' }}>$1,410</span> tire charge, the same branch, two days apart.</p>
              <p>Cosine similarity is high, both signals fire, and Claude confirms the shared <em>specific detail</em> — verdict: <span style={{ color: 'var(--text)' }}>same incident</span>, confidence 90+.</p>
              <p>Result: it counts as <span style={{ color: 'var(--text)' }}>one</span> complaint, not two — so the branch's numbers stay honest.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
