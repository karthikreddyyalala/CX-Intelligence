'use strict';
const { getDb } = require('./db');
const { getRiskBasis, resolveScope } = require('./riskBasis');

// Honest period naming — the label always matches the scope actually queried,
// including the source filter when one is applied.
const PERIOD_LABEL = { 7: 'Last 7 days', 30: 'Last 30 days', 60: 'Last 60 days', 90: 'Last 90 days' };

function scopeLabel(days, source) {
  const period = days ? (PERIOD_LABEL[days] || `Last ${days} days`) : 'All reviews on file';
  return source ? `${source} · ${period.toLowerCase()}` : period;
}

/**
 * Executive digest — a forwardable weekly brief.
 *
 * ACCURACY CONTRACT: every figure and quote here is COUNTED or COPIED VERBATIM
 * from the review table. No LLM generates any number or any quote, so nothing
 * can be hallucinated. The only interpretive line ("recommended focus") is
 * derived deterministically from the highest-weighted complaint theme.
 */
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function getDigest(days = 7, source = null) {
  const db = getDb();
  const basis = getRiskBasis(days, source);
  const s = resolveScope(db, days, source);
  const { totalReviews, negativeCount, positiveCount, sources, dateFrom, dateTo } = basis;

  const positivePct = totalReviews ? Math.round((positiveCount / totalReviews) * 100) : 0;
  const negativePct = totalReviews ? Math.round((negativeCount / totalReviews) * 100) : 0;
  const periodLabel = scopeLabel(days, source);

  // Per-source counts and average ratings within the scope (real).
  const bySource = db.prepare(`
    SELECT source, COUNT(*) c, ROUND(AVG(rating), 2) avg
    FROM reviews${s.where} GROUP BY source ORDER BY c DESC
  `).all(...s.params);

  // Top complaint themes by fractional attribution (real).
  const topThemes = basis.themes.slice(0, 3).map(t => ({
    name: t.name,
    reviews: Math.round(t.weight),
    share: Math.round(t.share * 100),
  }));

  // Two verbatim quotes from the lowest-rated, most recent negative reviews.
  const quotes = db.prepare(`
    SELECT source, author, rating, text, date FROM reviews
    ${s.and("sentiment = 'negative' AND text IS NOT NULL AND TRIM(text) != ''")}
    ORDER BY COALESCE(rating, 1) ASC, date DESC
    LIMIT 2
  `).all(...s.params).map(q => ({
    source: q.source,
    rating: q.rating,
    date: q.date ? q.date.slice(0, 10) : null,
    // Trimmed for readability; never reworded.
    text: q.text.replace(/\s+/g, ' ').trim().slice(0, 180),
  }));

  const focus = topThemes[0]?.name || null;

  // Plain-text, email-ready body.
  const lines = [];
  lines.push(`Avis — Customer Experience Brief`);
  lines.push(`${periodLabel} · ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`);
  lines.push('');
  lines.push(source
    ? `${totalReviews.toLocaleString()} ${source} reviews analyzed.`
    : `${totalReviews.toLocaleString()} customer reviews analyzed across ${sources} platform${sources === 1 ? '' : 's'}.`);
  lines.push(`Sentiment: ${positivePct}% positive, ${negativePct}% negative (${negativeCount} unhappy customers).`);
  lines.push('');
  if (source) {
    // Single-source views exist because only this channel has deep history; say
    // so in the brief itself, so a forwarded copy can't be read as full coverage.
    lines.push(`NOTE: This brief covers ${source} only — the one channel with history this far back. Cross-platform reporting currently covers the most recent 7 days.`);
    lines.push('');
  }
  lines.push(`TOP COMPLAINT THEMES`);
  topThemes.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.name} — ${t.reviews} negative reviews (${t.share}% of tagged complaints)`);
  });
  lines.push('');
  if (quotes.length) {
    lines.push(`IN CUSTOMERS' WORDS`);
    quotes.forEach(q => {
      lines.push(`"${q.text}"`);
      lines.push(`   — ${q.source}${q.rating ? `, ${q.rating}-star` : ''}${q.date ? `, ${q.date}` : ''}`);
    });
    lines.push('');
  }
  lines.push(`BY PLATFORM`);
  bySource.forEach(s => {
    lines.push(`- ${s.source}: ${s.c} reviews${s.avg ? `, ${s.avg} avg rating` : ''}`);
  });
  if (focus) {
    lines.push('');
    lines.push(`RECOMMENDED FOCUS`);
    lines.push(`"${focus}" is the highest-volume complaint theme and is where fixes would remove the most customer friction.`);
  }
  lines.push('');
  lines.push(`Source: CX Intelligence — every figure counted from real customer reviews; each review links back to its original platform.`);

  return {
    text: lines.join('\n'),
    periodDays: days || null, periodLabel,
    dateFrom, dateTo, totalReviews, positivePct, negativePct,
    negativeCount, sources, topThemes, quotes, bySource, focus,
  };
}

module.exports = { getDigest };
