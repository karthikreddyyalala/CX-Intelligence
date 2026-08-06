'use strict';
const { getDb } = require('./db');

/**
 * Blind-spot sizing and dispute detection.
 *
 * ACCURACY CONTRACT (same as riskBasis.js / segments.js): every figure here is
 * COUNTED from the reviews table. Nothing is modelled, projected or estimated.
 *
 * WHY THIS EXISTS
 * Avis's 10-K describes its entire customer-satisfaction programme as "sending
 * location-specific surveys to recent customers" — i.e. solicited feedback from
 * customers it already holds an email address for. Every review in this corpus
 * is UNSOLICITED: the customer went to a public platform unprompted. That gap
 * is the blind spot, and its size is simply the corpus count.
 *
 * The dispute layer reads money out of those same reviews. A customer who
 * writes "charged me $250 for cleaning" has published a billing dispute in the
 * open, typically days before it reaches a chargeback or a BBB case. Nothing
 * external is fetched — this is re-reading data already collected.
 */

// ── Money extraction ───────────────────────────────────────────────
// Matches $50, $1,250, $89.99, "$ 45". Deliberately conservative: currency
// symbol required, so "250 dollars" is missed rather than "250 miles" claimed.
const MONEY_RE = /\$\s?(\d[\d,]*(?:\.\d{1,2})?)/g;

// Above this a figure is almost never a disputed charge on one rental — it's a
// car's value, an annual spend, or a typo. Below $5 it's noise (tips, coffee).
const MAX_PLAUSIBLE = 20000;
const MIN_PLAUSIBLE = 5;

/** All plausible dollar figures mentioned in a block of text, de-duplicated. */
function extractAmounts(text) {
  if (!text) return [];
  const seen = new Set();
  for (const m of text.matchAll(MONEY_RE)) {
    const value = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isFinite(value) && value >= MIN_PLAUSIBLE && value <= MAX_PLAUSIBLE) seen.add(value);
  }
  return [...seen].sort((a, b) => b - a);
}

// ── Escalation signals ─────────────────────────────────────────────
// Weighted by what each phrase actually predicts. "Unauthorized" and "without
// my consent" are the exact language of a card-network chargeback claim and of
// the e-Toll class action, so they carry the most weight. "Scam" is loud but
// common, so it is deliberately cheap.
const ESCALATION_SIGNALS = [
  { re: /\bunauthori[sz]ed\b/i,                       weight: 25, label: 'unauthorized charge' },
  { re: /\bwithout (?:my |our )?(?:consent|permission|authorization)\b/i, weight: 25, label: 'no consent' },
  { re: /\bcharge ?back\b|\bdispute[ds]?\b/i,          weight: 22, label: 'disputing the charge' },
  { re: /\b(?:lawyer|attorney|legal action|sue|suing|lawsuit)\b/i, weight: 22, label: 'legal language' },
  { re: /\bBBB\b|better business bureau/i,             weight: 20, label: 'BBB threat' },
  { re: /\bfraud(?:ulent)?\b/i,                        weight: 18, label: 'alleges fraud' },
  { re: /\b(?:never rent|never again|never use)\b/i,   weight: 10, label: 'churn stated' },
  { re: /\bscam(?:med|ming)?\b/i,                      weight: 8,  label: 'calls it a scam' },
  { re: /\bstole|stealing|theft\b/i,                   weight: 8,  label: 'alleges theft' },
];

// Dispute categories — what KIND of charge is being contested. Ordered most to
// least specific so the first match wins.
const DISPUTE_TYPES = [
  { re: /\b(?:e-?toll|toll ?pass|toll)\b/i,                        type: 'Tolls' },
  { re: /\bclean(?:ing|liness)? ?(?:fee|charge)?\b/i,              type: 'Cleaning fee' },
  { re: /\bdamage[sd]?\b|\bscratch|\bdent\b/i,                     type: 'Damage claim' },
  { re: /\bfuel|\bgas\b|\bpetrol\b/i,                              type: 'Fuel charge' },
  { re: /\bdeposit|\bhold\b|\bauthoriz/i,                          type: 'Deposit / hold' },
  { re: /\bcancel(?:lation|led)?\b/i,                              type: 'Cancellation fee' },
  { re: /\binsurance|\bcoverage|\bwaiver|\bLDW\b|\bCDW\b/i,         type: 'Insurance' },
  { re: /\bupgrade|\bclass\b/i,                                    type: 'Upgrade charge' },
  { re: /\blate (?:fee|return)\b/i,                                type: 'Late fee' },
];

// A rental reference / confirmation number written into a public review. This
// is the highest-value signal in the whole model: it means the complaint can be
// looked up in Avis's own system immediately, with no customer contact needed.
const REF_RE = /\b(?:ref|reference|confirmation|conf|res(?:ervation)?)[.# :-]{0,4}([A-Z0-9]{6,20})\b/i;

function classify(text) {
  for (const { re, type } of DISPUTE_TYPES) if (re.test(text)) return type;
  return 'Unspecified charge';
}

function escalationFor(text) {
  const hits = [];
  let score = 0;
  for (const { re, weight, label } of ESCALATION_SIGNALS) {
    if (re.test(text)) { score += weight; hits.push(label); }
  }
  return { score, hits };
}

/**
 * Risk score 0-100 for one disputed review. Three components, each capped so no
 * single one can dominate:
 *   - money    (0-40) log-scaled, because $1,500 is not 30x worse than $50
 *   - language (0-40) sum of escalation-signal weights
 *   - rating   (0-20) a 1-star is materially more likely to escalate than a 3
 */
function riskScore({ amount, escalation, rating }) {
  const money = amount > 0 ? Math.min(40, Math.round((Math.log10(amount) / Math.log10(2000)) * 40)) : 0;
  const language = Math.min(40, escalation);
  const star = rating === 1 ? 20 : rating === 2 ? 13 : rating === 3 ? 6 : 0;
  return Math.min(100, money + language + star);
}

/**
 * Every review that both mentions money and reads as a complaint, ranked by
 * escalation risk. Returns the worklist plus the totals behind it.
 */
function getDisputes({ limit = 60 } = {}) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, review_id, source, author, text, rating, date, url,
           location_name, address, city, sentiment, owner_response_text
      FROM reviews
     WHERE text IS NOT NULL AND text != '' AND text LIKE '%$%'
     ORDER BY date DESC
  `).all();

  const items = [];
  for (const r of rows) {
    // A complaint is a low star rating OR a negative sentiment call from the
    // analyzer. Star-only rows have no text so they never reach here.
    const isComplaint = (r.rating != null && r.rating <= 3) || r.sentiment === 'negative';
    if (!isComplaint) continue;

    const amounts = extractAmounts(r.text);
    if (!amounts.length) continue;

    const { score: escalation, hits } = escalationFor(r.text);
    const amount = amounts[0];
    const ref = r.text.match(REF_RE);

    items.push({
      id: r.id,
      reviewId: r.review_id,
      source: r.source,
      author: r.author,
      text: r.text,
      rating: r.rating,
      date: r.date,
      url: r.url,
      branch: r.location_name || r.address || r.city || null,
      amount,
      allAmounts: amounts,
      type: classify(r.text),
      signals: hits,
      hasReference: Boolean(ref),
      reference: ref ? ref[1] : null,
      answered: Boolean(r.owner_response_text),
      risk: riskScore({ amount, escalation, rating: r.rating }),
    });
  }

  items.sort((a, b) => b.risk - a.risk || b.amount - a.amount);

  const totalDisputed = items.reduce((s, i) => s + i.amount, 0);
  const unanswered = items.filter(i => !i.answered);
  const byType = {};
  for (const i of items) {
    byType[i.type] = byType[i.type] || { type: i.type, count: 0, total: 0 };
    byType[i.type].count += 1;
    byType[i.type].total += i.amount;
  }

  return {
    items: items.slice(0, limit),
    totals: {
      disputes: items.length,
      totalDisputed: Math.round(totalDisputed),
      unanswered: unanswered.length,
      unansweredValue: Math.round(unanswered.reduce((s, i) => s + i.amount, 0)),
      withReference: items.filter(i => i.hasReference).length,
      highRisk: items.filter(i => i.risk >= 60).length,
    },
    byType: Object.values(byType).sort((a, b) => b.total - a.total),
  };
}

/**
 * The blind spot: how much unsolicited feedback exists that a survey-only
 * programme structurally cannot see.
 *
 * Every row in this corpus is unsolicited by construction — these are public
 * reviews scraped from platforms, not survey responses. So `unsolicited`
 * equals the corpus count. It is expressed as its own field rather than reusing
 * "total reviews" because the CLAIM being made is about what surveys miss, and
 * that claim should be legible in the API, not implied by the UI.
 */
function getBlindSpot() {
  const db = getDb();
  const one = sql => db.prepare(sql).get();

  const { total } = one(`SELECT COUNT(*) AS total FROM reviews`);
  const { withText } = one(`SELECT COUNT(*) AS withText FROM reviews WHERE text IS NOT NULL AND text != ''`);
  const { negative } = one(`SELECT COUNT(*) AS negative FROM reviews WHERE sentiment = 'negative'`);
  const { branches } = one(`SELECT COUNT(DISTINCT place_id) AS branches FROM reviews WHERE place_id IS NOT NULL`);
  const { unanswered } = one(`
    SELECT COUNT(*) AS unanswered FROM reviews
     WHERE sentiment = 'negative' AND (owner_response_text IS NULL OR owner_response_text = '')`);
  const { sources } = one(`SELECT COUNT(DISTINCT source) AS sources FROM reviews`);
  const span = one(`SELECT MIN(date) AS first, MAX(date) AS last FROM reviews WHERE date IS NOT NULL`);

  // Distinct staff named across reviews — counted the same way segments.js does.
  const empRows = db.prepare(`SELECT employees FROM reviews WHERE employees IS NOT NULL AND employees != ''`).all();
  const names = new Set();
  for (const row of empRows) {
    try {
      const list = JSON.parse(row.employees);
      if (Array.isArray(list)) for (const e of list) if (e?.name) names.add(String(e.name).trim().toLowerCase());
    } catch { /* malformed row — skip rather than fail the whole count */ }
  }

  const { totals } = getDisputes({ limit: 0 });

  return {
    unsolicited: total,
    fromSurveys: 0,          // structural: none of this corpus is survey-sourced
    withText,
    negative,
    unanswered,
    branches,
    sources,
    staffNamed: names.size,
    firstReview: span?.first || null,
    lastReview: span?.last || null,
    disputedDollars: totals.totalDisputed,
    disputeCount: totals.disputes,
  };
}

module.exports = { getBlindSpot, getDisputes, extractAmounts };
