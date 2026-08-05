'use strict';
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');

function calculateImpactScore(frequency, totalReviews, negativeRatio) {
  if (totalReviews === 0) return 1;
  const raw = Math.round((frequency / totalReviews) * 100 * negativeRatio * 10);
  return Math.min(100, Math.max(1, raw));
}

function calculatePainPoints() {
  const db = getDb();
  const now = new Date();
  const windowEnd = now.toISOString().slice(0, 10);
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get all analyzed reviews in the 30-day window
  const reviews = db.prepare(`
    SELECT id, themes, sentiment FROM reviews
    WHERE analyzed_at IS NOT NULL
      AND date >= ? AND date <= ?
      AND themes IS NOT NULL
  `).all(windowStart, windowEnd + 'T23:59:59Z');

  const totalReviews = reviews.length;
  if (totalReviews === 0) return [];

  // Build theme stats
  const themeStats = {};
  for (const r of reviews) {
    let themes;
    try { themes = JSON.parse(r.themes); } catch { themes = []; }
    for (const theme of themes) {
      const key = theme.toLowerCase().trim();
      if (!themeStats[key]) themeStats[key] = { frequency: 0, negativeCount: 0 };
      themeStats[key].frequency++;
      if (r.sentiment === 'negative') themeStats[key].negativeCount++;
    }
  }

  // Filter to pain points: freq >= 5 and negative ratio > 0.60
  const painPoints = [];
  for (const [theme, stats] of Object.entries(themeStats)) {
    const negRatio = stats.frequency > 0 ? stats.negativeCount / stats.frequency : 0;
    if (stats.frequency >= 5 && negRatio > 0.60) {
      painPoints.push({
        theme,
        frequency: stats.frequency,
        negativeRatio: negRatio,
        impactScore: calculateImpactScore(stats.frequency, totalReviews, negRatio),
      });
    }
  }

  // Sort by impact score descending
  painPoints.sort((a, b) => b.impactScore - a.impactScore);

  // Replace the whole table, not just this window. The API serves pain points as
  // a single current snapshot (no window filter), so leaving rows from an earlier
  // window behind surfaces every theme twice in the ranked chart.
  db.prepare(`DELETE FROM pain_points`).run();

  const insertStmt = db.prepare(`
    INSERT INTO pain_points (id, theme_name, impact_score, frequency, negative_ratio, window_start, window_end, identified_at)
    VALUES (@id, @theme_name, @impact_score, @frequency, @negative_ratio, @window_start, @window_end, @identified_at)
  `);

  const insertAll = db.transaction(() => {
    for (const pp of painPoints) {
      insertStmt.run({
        id: uuidv4(),
        theme_name: pp.theme,
        impact_score: pp.impactScore,
        frequency: pp.frequency,
        negative_ratio: pp.negativeRatio,
        window_start: windowStart,
        window_end: windowEnd,
        identified_at: new Date().toISOString(),
      });
    }
  });
  insertAll();

  console.log(`[PainPoints] Identified ${painPoints.length} pain points.`);
  return painPoints;
}

module.exports = { calculatePainPoints, calculateImpactScore };
