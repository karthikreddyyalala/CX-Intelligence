'use strict';
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

// GET /api/export/csv
router.get('/csv', (req, res) => {
  try {
    const db = getDb();
    const { source, sentiment, keyword, dateFrom, dateTo } = req.query;

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
    const rows = db.prepare(`SELECT * FROM reviews ${where} ORDER BY date DESC LIMIT 10000`).all(...params);

    const headers = ['id', 'source', 'author', 'text', 'rating', 'date', 'sentiment', 'themes'];
    const csvRows = [headers.join(',')];

    for (const r of rows) {
      const themes = r.themes ? JSON.parse(r.themes).join('; ') : '';
      const row = [
        `"${(r.id || '').replace(/"/g, '""')}"`,
        `"${(r.source || '').replace(/"/g, '""')}"`,
        `"${(r.author || '').replace(/"/g, '""')}"`,
        `"${(r.text || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        r.rating ?? '',
        `"${(r.date || '').replace(/"/g, '""')}"`,
        `"${(r.sentiment || '').replace(/"/g, '""')}"`,
        `"${themes.replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reviews-${dateStamp}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
