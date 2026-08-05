'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

// GET /api/reviews
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const {
      source, sentiment, keyword,
      dateFrom, dateTo,
      page = 1, pageSize = 25,
    } = req.query;

    const conditions = [];
    const params = [];

    if (source) {
      const sources = source.split(',').map(s => s.trim()).filter(Boolean);
      if (sources.length > 0) {
        conditions.push(`source IN (${sources.map(() => '?').join(',')})`);
        params.push(...sources);
      }
    }
    if (sentiment) { conditions.push('sentiment = ?'); params.push(sentiment); }
    if (keyword) { conditions.push('LOWER(text) LIKE ?'); params.push(`%${keyword.toLowerCase()}%`); }
    if (dateFrom) { conditions.push('date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date <= ?'); params.push(dateTo + 'T23:59:59Z'); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const total = db.prepare(`SELECT COUNT(*) as count FROM reviews ${where}`).get(...params)?.count || 0;
    const rows = db.prepare(`
      SELECT * FROM reviews ${where}
      ORDER BY date DESC, scraped_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), offset);

    const data = rows.map(r => ({
      ...r,
      themes: r.themes ? JSON.parse(r.themes) : [],
      rating: r.rating ?? null,
    }));

    res.json({ data, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const { dateFrom, dateTo } = req.query;

    const conditions = ['analyzed_at IS NOT NULL'];
    const params = [];
    if (dateFrom) { conditions.push('date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('date <= ?'); params.push(dateTo + 'T23:59:59Z'); }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const totals = db.prepare(`
      SELECT 
        COUNT(*) as totalReviews,
        SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positiveCount,
        SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutralCount,
        SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negativeCount
      FROM reviews ${where}
    `).get(...params);

    const activePainPoints = db.prepare(`SELECT COUNT(*) as count FROM pain_points`).get()?.count || 0;

    // Sentiment by day
    const sentimentByDay = db.prepare(`
      SELECT 
        substr(date, 1, 10) as day,
        SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral,
        SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative
      FROM reviews ${where}
      GROUP BY day ORDER BY day ASC
    `).all(...params);

    // Volume by source
    const volumeBySource = db.prepare(`
      SELECT source, COUNT(*) as count,
        ROUND(AVG(rating), 1) as avgRating,
        SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative
      FROM reviews ${where}
      GROUP BY source ORDER BY count DESC
    `).all(...params);

    // Rating trend by platform (last 7 days vs previous 7 days)
    const now = new Date();
    const last7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const prev7Start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const ratingTrend = db.prepare(`
      SELECT source,
        ROUND(AVG(CASE WHEN date >= ? THEN rating END), 2) as currentRating,
        ROUND(AVG(CASE WHEN date >= ? AND date < ? THEN rating END), 2) as previousRating
      FROM reviews WHERE rating IS NOT NULL
      GROUP BY source
    `).all(last7Start, prev7Start, last7Start);

    res.json({
      ...totals,
      activePainPoints,
      sentimentByDay,
      volumeBySource,
      ratingTrend,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
