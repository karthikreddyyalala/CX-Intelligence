'use strict';
const express = require('express');
const { getDb } = require('../db');
const { askAnalyst } = require('../ask');
const { draftReply } = require('../replyDrafter');
const { getRiskBasis } = require('../riskBasis');
const { getDigest } = require('../digest');
const { getLocations, getPeople, getLocationThemes } = require('../segments');
const { getIdentityClusters } = require('../identity');
const router = express.Router();

// Only whitelisted windows and sources — keeps labels honest, queries
// predictable, and the source value safe to bind straight into SQL.
const ALLOWED_DAYS = [7, 30, 60, 90];
const ALLOWED_SOURCES = ['Google Maps', 'App Store', 'Trustpilot', 'Google Play', 'Reddit'];

function parseDays(raw, fallback) {
  if (raw === 'all') return null;
  const n = parseInt(raw, 10);
  return ALLOWED_DAYS.includes(n) ? n : fallback;
}
function parseSource(raw) {
  return ALLOWED_SOURCES.includes(raw) ? raw : null;
}

// GET /api/risk-basis?days=7|30|60|90|all&source=<platform>
// Real counted figures for the risk model. `source` narrows to one platform —
// used for the long-window view, where only one channel has history that deep.
router.get('/risk-basis', (req, res) => {
  try { res.json(getRiskBasis(parseDays(req.query.days, null), parseSource(req.query.source))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/digest?days=7|30|60|90|all&source=<platform> — forwardable brief, real data only
router.get('/digest', (req, res) => {
  try { res.json(getDigest(parseDays(req.query.days, 7), parseSource(req.query.source))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ask — conversational analyst grounded in the real review corpus
router.post('/ask', express.json(), async (req, res) => {
  const question = (req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Question required.' });
  try {
    const result = await askAnalyst(question.slice(0, 400));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/draft-reply — AI-drafted public response to a single real review
router.post('/draft-reply', express.json(), async (req, res) => {
  const reviewId = (req.body?.reviewId || '').trim();
  if (!reviewId) return res.status(400).json({ error: 'reviewId required.' });
  try {
    const result = await draftReply(reviewId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/pain-points
router.get('/pain-points', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM pain_points
      ORDER BY impact_score DESC LIMIT 10
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/insight-summary
router.get('/insight-summary', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM insight_summaries ORDER BY generated_at DESC LIMIT 1
    `).get();

    if (!row) return res.json(null);

    res.json({
      ...row,
      sentiment_distribution: JSON.parse(row.sentiment_distribution || '{}'),
      top_pain_points: JSON.parse(row.top_pain_points || '[]'),
      top_recommendations: JSON.parse(row.top_recommendations || '[]'),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/response-rate — how often Avis answers its Google reviews.
// Counted entirely from scraped owner-response data; Google Maps is the only
// connected source that exposes owner responses, so the stat is scoped to it
// and labelled that way in the UI.
router.get('/response-rate', (req, res) => {
  try {
    const db = getDb();
    const base = db.prepare(`
      SELECT COUNT(*) total,
             SUM(CASE WHEN owner_response_date IS NOT NULL THEN 1 ELSE 0 END) responded,
             SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) negTotal,
             SUM(CASE WHEN sentiment = 'negative' AND owner_response_date IS NOT NULL THEN 1 ELSE 0 END) negResponded
      FROM reviews WHERE source = 'Google Maps'
    `).get();

    // Median hours-to-respond among answered reviews with exact timestamps.
    const gaps = db.prepare(`
      SELECT (julianday(owner_response_date) - julianday(published_at_exact)) * 24.0 AS hrs
      FROM reviews
      WHERE source = 'Google Maps' AND owner_response_date IS NOT NULL
        AND published_at_exact IS NOT NULL
        AND julianday(owner_response_date) >= julianday(published_at_exact)
        AND (julianday(owner_response_date) - julianday(published_at_exact)) < 365
      ORDER BY hrs
    `).all().map(r => r.hrs);
    const medianHours = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;

    res.json({
      source: 'Google Maps',
      total: base.total,
      responded: base.responded,
      responseRatePct: base.total ? Math.round((base.responded / base.total) * 100) : 0,
      negativeTotal: base.negTotal,
      negativeResponded: base.negResponded,
      negativeUnanswered: base.negTotal - base.negResponded,
      medianHoursToRespond: medianHours !== null ? Number(medianHours.toFixed(1)) : null,
      medianSamples: gaps.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SEGMENTATION: branch and people cuts ──────────────────────────────────
// All three are counted from Google Maps reviews, the only connected source
// that ties a review to a specific storefront.

// GET /api/locations?minReviews=10 — per-branch scorecard, worst-first
router.get('/locations', (req, res) => {
  try {
    const min = Math.max(1, Math.min(100, parseInt(req.query.minReviews, 10) || 10));
    res.json(getLocations({ minReviews: min }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/people?minMentions=2 — staff named in reviews, praised and blamed
router.get('/people', (req, res) => {
  try {
    const min = Math.max(1, Math.min(20, parseInt(req.query.minMentions, 10) || 2));
    res.json(getPeople({ minMentions: min }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/location-themes — theme x branch matrix: systemic problem or local one?
router.get('/location-themes', (req, res) => {
  try { res.json(getLocationThemes()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/identity — clusters of reviews probably written by the same person
// under different names/platforms, with stored AI verdicts where available.
router.get('/identity', (req, res) => {
  try { res.json(getIdentityClusters()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/source-ratings — per-platform rating cards
router.get('/source-ratings', (req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const prev7 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const sources = db.prepare(`SELECT DISTINCT source FROM reviews`).all().map(r => r.source);

    const result = sources.map(source => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as totalReviews,
          ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END), 2) as avgRating,
          ROUND(AVG(CASE WHEN rating IS NOT NULL AND date >= ? THEN rating END), 2) as recentRating,
          ROUND(AVG(CASE WHEN rating IS NOT NULL AND date >= ? AND date < ? THEN rating END), 2) as prevRating,
          SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
          SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral,
          SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) as recentCount
        FROM reviews WHERE source = ? AND date >= ?
      `).get(last7, prev7, last7, last7, source, last30);

      const recentReviews = db.prepare(`
        SELECT id, author, text, rating, date, sentiment, themes
        FROM reviews WHERE source = ?
        ORDER BY date DESC LIMIT 3
      `).all(source);

      const trend = stats.recentRating && stats.prevRating
        ? stats.recentRating - stats.prevRating
        : null;

      return {
        source,
        totalReviews: stats.totalReviews || 0,
        avgRating: stats.avgRating,
        recentRating: stats.recentRating,
        ratingTrend: trend ? parseFloat(trend.toFixed(2)) : null,
        positive: stats.positive || 0,
        negative: stats.negative || 0,
        neutral: stats.neutral || 0,
        recentCount: stats.recentCount || 0,
        recentReviews: recentReviews.map(r => ({
          ...r,
          themes: r.themes ? JSON.parse(r.themes) : [],
        })),
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
