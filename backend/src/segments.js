'use strict';
const { getDb } = require('./db');

/**
 * Location- and people-level cuts of the review corpus.
 *
 * ACCURACY CONTRACT (same as riskBasis.js): every figure here is COUNTED from
 * the reviews table. Nothing is modelled or estimated. Financial assumptions
 * stay in the UI, so a branch's "revenue at risk" is always
 * (this branch's real negative count) x (the user's own inputs).
 *
 * Scope note: branch identity comes from Google Maps, the only connected source
 * that ties a review to a storefront. App Store / Trustpilot / Reddit reviews
 * are brand-level and are excluded from these cuts rather than being guessed at.
 */

const LOCATED = `source = 'Google Maps' AND place_id IS NOT NULL`;

/** Parse a JSON array column that may be NULL or malformed. */
function parseList(raw) {
  if (!raw) return [];
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p.filter(Boolean) : [];
  } catch { return []; }
}

/**
 * Fractional theme attribution: a review tagged with k themes contributes 1/k to
 * each, so per-theme weights sum to the number of themed reviews — no double
 * counting when a branch's complaints span several topics.
 */
function themeWeights(rows) {
  const w = new Map();
  let themed = 0;
  for (const r of rows) {
    const list = parseList(r.themes);
    if (!list.length) continue;
    themed++;
    const share = 1 / list.length;
    for (const t of list) w.set(t, (w.get(t) || 0) + share);
  }
  return { weights: w, themed };
}

/**
 * Every branch with its own scorecard, ranked worst-first by negative rate.
 * `minReviews` guards against a branch with three reviews topping the table on
 * noise alone; below it a branch is still returned but flagged `lowSample`.
 */
function getLocations({ minReviews = 10 } = {}) {
  const db = getDb();

  const branches = db.prepare(`
    SELECT place_id, location_name, address, city, state, neighborhood,
           lat, lng, is_airport,
           MAX(location_rating)       AS google_rating,
           MAX(location_review_count) AS google_review_count,
           COUNT(*)                                                     AS reviews,
           -- Star-only reviews carry no text to score. They belong in the star
           -- average but must stay out of the negative-rate denominator, or a
           -- branch with many silent 5-star ratings looks better than it is.
           SUM(sentiment IS NOT NULL)                                   AS scored,
           AVG(rating)                                                  AS avg_stars,
           SUM(sentiment = 'negative')                                  AS negative,
           SUM(sentiment = 'positive')                                  AS positive,
           SUM(sentiment = 'neutral')                                   AS neutral,
           SUM(owner_response_date IS NOT NULL)                         AS responded,
           SUM(sentiment = 'negative' AND owner_response_date IS NULL)  AS neg_unanswered,
           MIN(date) AS first_date, MAX(date) AS last_date
    FROM reviews WHERE ${LOCATED}
    GROUP BY place_id
  `).all();

  // Network-wide negative rate, so each branch can be read against the average
  // rather than against an arbitrary threshold.
  const net = db.prepare(`
    SELECT COUNT(*) n, SUM(sentiment IS NOT NULL) scored, SUM(sentiment = 'negative') neg
    FROM reviews WHERE ${LOCATED}
  `).get();
  const networkNegRate = net.scored ? net.neg / net.scored : 0;

  const themeStmt = db.prepare(
    `SELECT themes FROM reviews WHERE ${LOCATED} AND place_id = ? AND sentiment = 'negative'`
  );

  const out = branches.map(b => {
    const scored = b.scored || 0;
    const negRate = scored ? b.negative / scored : 0;
    const { weights } = themeWeights(themeStmt.all(b.place_id));
    const topThemes = [...weights.entries()]
      .sort((a, c) => c[1] - a[1]).slice(0, 3)
      .map(([name, weight]) => ({ name, weight: Number(weight.toFixed(2)) }));

    return {
      placeId: b.place_id,
      name: b.location_name,
      address: b.address,
      city: b.city,
      state: b.state,
      neighborhood: b.neighborhood,
      lat: b.lat,
      lng: b.lng,
      isAirport: !!b.is_airport,
      googleRating: b.google_rating,            // branch score shown publicly on Google
      googleReviewCount: b.google_review_count, // total reviews Google reports
      reviews: b.reviews || 0,                  // everything we sampled here
      scored: scored,                           // the subset with text to analyse
      avgStars: b.avg_stars != null ? Number(b.avg_stars.toFixed(2)) : null,
      negative: b.negative || 0,
      positive: b.positive || 0,
      neutral: b.neutral || 0,
      negRate: Number(negRate.toFixed(4)),
      // Positive = worse than the network; the sign is what the UI colours on.
      negRateVsNetwork: Number((negRate - networkNegRate).toFixed(4)),
      responded: b.responded || 0,
      // Replies are counted against every review, star-only ones included —
      // the owner can answer those too.
      responseRate: b.reviews ? Number((b.responded / b.reviews).toFixed(4)) : 0,
      negUnanswered: b.neg_unanswered || 0,
      topThemes,
      lowSample: scored < minReviews,
      firstDate: b.first_date, lastDate: b.last_date,
    };
  });

  out.sort((a, b) => b.negRate - a.negRate || b.reviews - a.reviews);

  return {
    networkNegRate: Number(networkNegRate.toFixed(4)),
    totalLocated: net.n,
    locationCount: out.length,
    minReviews,
    locations: out,
  };
}

/**
 * Staff named in reviews, aggregated across branches.
 *
 * Two lists come out of the same data: people repeatedly praised (recognition,
 * and a retention risk if they leave) and people drawing complaints (a coaching
 * signal, not an accusation — it is what customers wrote, nothing more).
 */
function getPeople({ minMentions = 2 } = {}) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, employees, text, rating, date, url, sentiment,
           location_name, city, place_id
    FROM reviews
    WHERE employees IS NOT NULL AND employees != '[]'
  `).all();

  const people = new Map();
  for (const r of rows) {
    for (const e of parseList(r.employees)) {
      const name = String(e.name || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!people.has(key)) {
        people.set(key, {
          name, mentions: 0, positive: 0, negative: 0,
          locations: new Map(), quotes: [],
        });
      }
      const p = people.get(key);
      p.mentions++;
      if (e.sentiment === 'negative') p.negative++; else p.positive++;
      if (r.location_name) {
        p.locations.set(r.location_name, (p.locations.get(r.location_name) || 0) + 1);
      }
      // Keep a couple of verbatims per polarity so a claim can always be shown
      // with the sentence that produced it.
      if (p.quotes.filter(q => q.sentiment === e.sentiment).length < 2) {
        p.quotes.push({
          sentiment: e.sentiment === 'negative' ? 'negative' : 'positive',
          text: (r.text || '').slice(0, 240),
          rating: r.rating, date: r.date, url: r.url,
          location: r.location_name || null,
        });
      }
    }
  }

  const all = [...people.values()].map(p => ({
    name: p.name,
    mentions: p.mentions,
    positive: p.positive,
    negative: p.negative,
    // Branches they were named at — more than one usually means a shared name,
    // which the UI flags rather than silently merging.
    locations: [...p.locations.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    quotes: p.quotes,
  }));

  const named = all.reduce((n, p) => n + p.mentions, 0);

  return {
    minMentions,
    peopleNamed: all.length,
    totalMentions: named,
    reviewsNamingSomeone: rows.length,
    // Repeatedly praised, no complaints on file.
    recognition: all
      .filter(p => p.positive >= minMentions && p.negative === 0)
      .sort((a, b) => b.positive - a.positive),
    // Anyone customers complained about, most-complained first.
    coaching: all
      .filter(p => p.negative > 0)
      .sort((a, b) => b.negative - a.negative || b.mentions - a.mentions),
    all: all.sort((a, b) => b.mentions - a.mentions),
  };
}

/**
 * Theme x location matrix — answers the question a systemic fix depends on:
 * is this complaint everywhere, or is it three branches?
 *
 * `concentration` is the share of a theme's total weight sitting in its single
 * worst branch. High concentration means a local fix; low means a policy fix.
 */
function getLocationThemes({ topThemes = 8, minReviews = 10 } = {}) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT place_id, location_name, city, themes
    FROM reviews WHERE ${LOCATED} AND sentiment = 'negative'
  `).all();

  const byBranch = new Map();   // placeId -> { name, city, total, themes: Map }
  const themeTotals = new Map();

  for (const r of rows) {
    const list = parseList(r.themes);
    if (!list.length) continue;
    if (!byBranch.has(r.place_id)) {
      byBranch.set(r.place_id, { placeId: r.place_id, name: r.location_name, city: r.city, total: 0, themes: new Map() });
    }
    const b = byBranch.get(r.place_id);
    b.total++;
    const share = 1 / list.length;
    for (const t of list) {
      b.themes.set(t, (b.themes.get(t) || 0) + share);
      themeTotals.set(t, (themeTotals.get(t) || 0) + share);
    }
  }

  const themes = [...themeTotals.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, topThemes)
    .map(([name, weight]) => ({ name, weight: Number(weight.toFixed(2)) }));

  const branches = [...byBranch.values()]
    .filter(b => b.total >= Math.min(minReviews, 3))
    .sort((a, b) => b.total - a.total)
    .map(b => ({
      placeId: b.placeId, name: b.name, city: b.city, negatives: b.total,
      cells: themes.map(t => Number((b.themes.get(t.name) || 0).toFixed(2))),
    }));

  // Is a theme concentrated in a few branches, or spread across the network?
  //
  // Two naive measures both fail here. "Share sitting in the worst branch" never
  // looks concentrated across 30 branches (an even spread is only ~3% each), and
  // "highest over-index at any branch" always looks concentrated, because the
  // maximum of 30 noisy ratios is high by construction.
  //
  // So use a normalised Herfindahl index over the theme's distribution: 0 means
  // perfectly even across every branch, 1 means entirely at one. It needs no
  // threshold to be meaningful, and themes are ranked against each other rather
  // than against a number picked by hand.
  const totalNegatives = branches.reduce((a, b) => a + b.negatives, 0);
  const n = branches.length;

  const concentration = themes.map((t, i) => {
    const col = branches.map(b => b.cells[i]);
    const themeTotal = col.reduce((a, c) => a + c, 0);
    if (!themeTotal || n < 2) {
      return { theme: t.name, concentration: 0, topShare: 0, topBranch: null, topBranchIndex: 0 };
    }

    const hhi = col.reduce((a, c) => a + (c / themeTotal) ** 2, 0);
    const normalised = (hhi - 1 / n) / (1 - 1 / n);

    // The single branch carrying most of it, with how over-represented it is
    // relative to that branch's share of all complaints.
    const topIdx = col.indexOf(Math.max(...col));
    const topShare = col[topIdx] / themeTotal;
    const expected = totalNegatives ? branches[topIdx].negatives / totalNegatives : 0;

    return {
      theme: t.name,
      concentration: Number(Math.max(0, normalised).toFixed(3)),
      topShare: Number(topShare.toFixed(3)),
      topBranch: branches[topIdx].name,
      topBranchIndex: expected ? Number((topShare / expected).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.concentration - a.concentration);

  return { themes, branches, concentration, totalNegatives, branchCount: n };
}

module.exports = { getLocations, getPeople, getLocationThemes };
