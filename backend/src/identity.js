'use strict';
const crypto = require('crypto');
const { getDb } = require('./db');

/**
 * Identity resolution: find the reviews that are probably the same person or
 * the same incident wearing different names.
 *
 * Public review platforms have no login we can see, so certainty is impossible
 * and never claimed. Instead each cluster carries the SIGNALS that produced it
 * (same name, same day, same branch, text similarity) and a score; the top
 * clusters can additionally be verified by the model (see verifyIdentity.js),
 * whose verdict is stored — never invented at read time.
 *
 * Cluster types:
 *  - same-incident   different names, near-identical story (the "Danny" case)
 *  - multi-branch    one name hitting several branches in a tight window
 *  - rating-burst    one name mass-posting empty star ratings (inflation)
 *  - cross-platform  one name appearing on more than one platform
 */

// ── text similarity (TF-IDF cosine over negative reviews) ────────────────────

const STOP = new Set(
  ('the a an and or but of to in on for with at is was were are be i my me we they it this that had have has ' +
   'not no you your from as by would will when after there so all very get got do did').split(' ')
);
const tokenize = t => ((t || '').toLowerCase().match(/[a-z']+/g) || [])
  .filter(w => w.length > 2 && !STOP.has(w));

function tfidfVectors(texts) {
  const docs = texts.map(tokenize);
  const df = new Map();
  docs.forEach(d => new Set(d).forEach(w => df.set(w, (df.get(w) || 0) + 1)));
  const N = docs.length || 1;
  return docs.map(d => {
    const tf = new Map();
    d.forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
    const v = new Map();
    let norm = 0;
    for (const [w, c] of tf) {
      const x = c * Math.log(N / (df.get(w) || 1));
      v.set(w, x);
      norm += x * x;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [w, x] of v) v.set(w, x / norm);
    return v;
  });
}

function cosine(a, b) {
  let s = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [w, x] of small) {
    const y = large.get(w);
    if (y) s += x * y;
  }
  return s;
}

const daysBetween = (a, b) => {
  const da = Date.parse(a), dbb = Date.parse(b);
  if (isNaN(da) || isNaN(dbb)) return Infinity;
  return Math.abs(da - dbb) / 864e5;
};

// A stable id lets the verification table survive re-computation.
const clusterId = ids => crypto.createHash('sha1').update([...ids].sort().join('|')).digest('hex').slice(0, 12);

const slim = r => ({
  id: r.id, source: r.source, author: r.author, rating: r.rating, date: r.date,
  location: r.location_name || null, sentiment: r.sentiment,
  text: (r.text || '').slice(0, 400), url: r.url,
});

// ── cluster builders ─────────────────────────────────────────────────────────

/** Different names, near-identical negative story. The hardest and most valuable case. */
function findSameIncident(db) {
  const rows = db.prepare(`
    SELECT id, source, author, rating, date, location_name, sentiment, text, url
    FROM reviews WHERE sentiment = 'negative' AND LENGTH(text) > 60
  `).all();
  const vecs = tfidfVectors(rows.map(r => r.text));

  const out = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const A = rows[i], B = rows[j];
      if (A.author.toLowerCase().trim() === B.author.toLowerCase().trim()) continue;
      const sim = cosine(vecs[i], vecs[j]);
      if (sim < 0.28) continue;

      const sameBranch = A.location_name && A.location_name === B.location_name;
      const days = daysBetween(A.date, B.date);
      // Similar wording alone is weak — angry customers reuse the same phrases.
      // It becomes a real signal only combined with shared circumstance.
      let score = sim;
      if (sameBranch) score += 0.25;
      if (days <= 3) score += 0.2;
      else if (days <= 14) score += 0.1;
      if (A.source !== B.source) score += 0.05; // cross-platform posting is itself the behaviour we hunt

      if (score < 0.55) continue;
      out.push({
        type: 'same-incident',
        score: Number(Math.min(score, 0.99).toFixed(2)),
        signals: [
          `wording ${Math.round(sim * 100)}% similar`,
          sameBranch ? `same branch (${A.location_name})` : null,
          days <= 14 ? `${Math.round(days)} day(s) apart` : null,
          A.source !== B.source ? 'different platforms' : null,
        ].filter(Boolean),
        reviews: [slim(A), slim(B)],
      });
    }
  }
  return out;
}

/** One name, several branches, tight window — one bad day producing multiple reviews. */
function findMultiBranch(db) {
  const groups = db.prepare(`
    SELECT LOWER(TRIM(author)) k FROM reviews
    WHERE source = 'Google Maps' AND place_id IS NOT NULL
      AND author != '' AND author != 'Anonymous'
    GROUP BY k HAVING COUNT(DISTINCT place_id) > 1
  `).all();
  const byAuthor = db.prepare(`
    SELECT id, source, author, rating, date, location_name, sentiment, text, url, place_id
    FROM reviews WHERE source = 'Google Maps' AND LOWER(TRIM(author)) = ? ORDER BY date
  `);

  const out = [];
  for (const g of groups) {
    const rows = byAuthor.all(g.k);
    const withText = rows.filter(r => (r.text || '').length > 0);
    const dates = rows.map(r => r.date).filter(Boolean);
    const spanDays = dates.length > 1 ? daysBetween(dates[0], dates[dates.length - 1]) : 0;

    // Empty five-star ratings sprayed across branches within days: not a customer
    // journey, a ratings campaign. Google's own averages count these.
    if (rows.length >= 3 && withText.length === 0 && spanDays <= 7 &&
        rows.every(r => r.rating >= 4)) {
      out.push({
        type: 'rating-burst',
        score: 0.9,
        signals: [
          `${rows.length} text-free ${Math.round(rows.reduce((a, r) => a + r.rating, 0) / rows.length)}★ ratings`,
          `${new Set(rows.map(r => r.place_id)).size} branches in ${Math.max(1, Math.round(spanDays))} day(s)`,
          'no review ever written',
        ],
        reviews: rows.map(slim),
      });
      continue;
    }

    // Reviews at different branches within a few days of each other — usually one
    // failed pickup bouncing the customer between locations.
    if (spanDays <= 3 && rows.length >= 2 && withText.length >= 1) {
      out.push({
        type: 'multi-branch',
        score: rows.some(r => r.sentiment === 'negative') ? 0.85 : 0.6,
        signals: [
          `same name at ${new Set(rows.map(r => r.place_id)).size} branches`,
          `within ${Math.max(1, Math.round(spanDays))} day(s)`,
          rows.some(r => r.sentiment === 'negative') ? 'at least one negative' : 'all non-negative',
        ],
        reviews: rows.map(slim),
      });
    }
  }
  return out;
}

/** One name on more than one platform. Weak alone; scored by whether the stories align. */
function findCrossPlatform(db) {
  const groups = db.prepare(`
    SELECT LOWER(TRIM(author)) k FROM reviews
    WHERE author != '' AND author != 'Anonymous' AND LENGTH(author) > 3
    GROUP BY k HAVING COUNT(DISTINCT source) > 1
  `).all();
  const byAuthor = db.prepare(`
    SELECT id, source, author, rating, date, location_name, sentiment, text, url
    FROM reviews WHERE LOWER(TRIM(author)) = ? ORDER BY date
  `);

  const out = [];
  for (const g of groups) {
    const rows = byAuthor.all(g.k);
    const dates = rows.map(r => r.date).filter(Boolean).sort();
    const spanDays = dates.length > 1 ? daysBetween(dates[0], dates[dates.length - 1]) : Infinity;
    const vecs = tfidfVectors(rows.map(r => r.text));
    let maxSim = 0;
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++)
        maxSim = Math.max(maxSim, cosine(vecs[i], vecs[j]));

    // A common first name years apart is a coincidence, and is scored like one.
    const score = Math.min(0.95,
      0.3 + (spanDays <= 7 ? 0.35 : spanDays <= 30 ? 0.2 : 0) + maxSim * 0.5);
    out.push({
      type: 'cross-platform',
      score: Number(score.toFixed(2)),
      signals: [
        `same name on ${[...new Set(rows.map(r => r.source))].join(' + ')}`,
        spanDays <= 30 ? `${Math.max(1, Math.round(spanDays))} day(s) apart` : 'far apart in time',
        maxSim > 0.2 ? `wording ${Math.round(maxSim * 100)}% similar` : 'stories differ',
      ],
      reviews: rows.map(slim),
    });
  }
  return out;
}

// ── verification storage ─────────────────────────────────────────────────────

function ensureTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity_verdicts (
      cluster_id TEXT PRIMARY KEY,
      verdict TEXT,            -- 'same-person' | 'same-incident' | 'unrelated' | 'unclear'
      confidence INTEGER,      -- 0-100, the model's own estimate
      reasoning TEXT,
      verified_at TEXT
    );
  `);
}

/** Build every cluster, attach any stored model verdicts, sort by score. */
function getIdentityClusters() {
  const db = getDb();
  ensureTable(db);

  const clusters = [
    ...findSameIncident(db),
    ...findMultiBranch(db),
    ...findCrossPlatform(db),
  ].map(c => ({ ...c, clusterId: clusterId(c.reviews.map(r => r.id)) }));

  const verdicts = new Map(
    db.prepare(`SELECT * FROM identity_verdicts`).all().map(v => [v.cluster_id, v])
  );
  for (const c of clusters) {
    const v = verdicts.get(c.clusterId);
    c.ai = v ? {
      verdict: v.verdict, confidence: v.confidence,
      reasoning: v.reasoning, verifiedAt: v.verified_at,
    } : null;
  }

  // Model-confirmed clusters outrank signal-only ones; discarded ones sink.
  clusters.sort((a, b) => {
    const rank = c => c.ai
      ? (c.ai.verdict === 'unrelated' ? -1 : 1 + c.ai.confidence / 100)
      : c.score;
    return rank(b) - rank(a);
  });

  const flagged = clusters.filter(c => !c.ai || c.ai.verdict !== 'unrelated');
  const reviewsFlagged = new Set(flagged.flatMap(c => c.reviews.map(r => r.id))).size;

  return {
    clusterCount: flagged.length,
    reviewsFlagged,
    verifiedCount: clusters.filter(c => c.ai).length,
    byType: flagged.reduce((m, c) => ((m[c.type] = (m[c.type] || 0) + 1), m), {}),
    clusters,
  };
}

module.exports = { getIdentityClusters, ensureTable, clusterId };
