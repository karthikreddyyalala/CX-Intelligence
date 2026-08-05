'use strict';
const { getDb } = require('./db');

/**
 * Factual basis for the Revenue-at-Risk model.
 *
 * ACCURACY CONTRACT: everything returned here is COUNTED from the review table —
 * no estimates, no model assumptions, no LLM-generated figures. The financial
 * assumptions (customer value, churn rate, etc.) live entirely in the UI where
 * the user sets them, so the numbers on screen are always
 * (real counts) x (the user's own inputs).
 *
 * Theme attribution uses fractional weighting: a negative review tagged with k
 * themes contributes 1/k to each. That makes the per-theme weights sum exactly
 * to the number of themed negative reviews — no double counting.
 */
/**
 * Resolve a reporting scope: a time window, an optional single-source filter, or
 * both. The window is measured back from the newest review in the data (not from
 * "now"), so a period label always describes the data it actually covers.
 *
 * Scoping by source exists because collection depth is uneven: the App Store is
 * read from Apple's RSS feed and reaches back months, while the Apify-backed
 * sources only hold what was newest at scrape time. Mixing them over a long
 * window would silently weight the result toward whichever source happens to
 * have history — so a long window is only ever offered for one source at a time.
 *
 * days = null means every review on file; source = null means every platform.
 */
function resolveScope(db, days = null, source = null) {
  const conds = [];
  const params = [];
  let from = null;

  if (days) {
    const newest = db.prepare('SELECT MAX(date) d FROM reviews WHERE date IS NOT NULL').get()?.d;
    if (newest) {
      from = new Date(Date.parse(newest.slice(0, 10) + 'T00:00:00') - (days - 1) * 864e5)
        .toISOString().slice(0, 10);
      conds.push('date >= ?');
      params.push(from);
    }
  }
  if (source) {
    conds.push('source = ?');
    params.push(source);
  }

  return {
    days, source, from, params,
    where: conds.length ? ` WHERE ${conds.join(' AND ')}` : '',
    // WHERE clause with one extra condition ANDed on, for the filtered queries.
    and: (extra) => ` WHERE ${[...conds, extra].join(' AND ')}`,
  };
}

function getRiskBasis(days = null, source = null) {
  const db = getDb();
  const s = resolveScope(db, days, source);

  const totalReviews = db.prepare(`SELECT COUNT(*) c FROM reviews${s.where}`).get(...s.params).c;
  const sentiment = db.prepare(
    `SELECT sentiment, COUNT(*) c FROM reviews${s.where} GROUP BY sentiment`
  ).all(...s.params).reduce((a, r) => (a[r.sentiment || 'unknown'] = r.c, a), {});

  const negativeCount = sentiment.negative || 0;
  const positiveCount = sentiment.positive || 0;
  const neutralCount = sentiment.neutral || 0;

  const range = db.prepare(
    `SELECT MIN(date) f, MAX(date) t FROM reviews${s.and('date IS NOT NULL')}`
  ).get(...s.params);
  const sources = db.prepare(`SELECT COUNT(DISTINCT source) c FROM reviews${s.where}`).get(...s.params).c;

  // Fractional theme attribution across negative reviews in the scope.
  const negRows = db.prepare(
    `SELECT themes FROM reviews${s.and("sentiment = 'negative'")}`
  ).all(...s.params);
  const weights = new Map();
  let themedNegatives = 0;
  for (const row of negRows) {
    let list = [];
    try {
      const parsed = typeof row.themes === 'string' ? JSON.parse(row.themes) : row.themes;
      if (Array.isArray(parsed)) list = parsed.filter(Boolean);
    } catch { /* untagged or malformed — counted as unthemed below */ }
    if (!list.length) continue;
    themedNegatives++;
    const share = 1 / list.length;
    for (const t of list) weights.set(t, (weights.get(t) || 0) + share);
  }

  const themes = [...weights.entries()]
    .map(([name, weight]) => ({
      name,
      // review-equivalents (fractional), rounded for display only
      weight: Number(weight.toFixed(2)),
      // share of all themed negative reviews — sums to 1 across every theme
      share: themedNegatives ? weight / themedNegatives : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  return {
    periodDays: days || null,
    source: source || null,
    totalReviews,
    negativeCount,
    positiveCount,
    neutralCount,
    themedNegatives,
    untaggedNegatives: negativeCount - themedNegatives,
    sources,
    dateFrom: range?.f ? range.f.slice(0, 10) : null,
    dateTo: range?.t ? range.t.slice(0, 10) : null,
    themes,
  };
}

module.exports = { getRiskBasis, resolveScope };
