'use strict';
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');

/**
 * Deduplicates and inserts reviews into SQLite.
 * Dedupe key: source + author + text.slice(0, 80)
 */
function deduplicateAndInsert(reviews, pipelineRunId) {
  const db = getDb();
  let inserted = 0;
  let skipped = 0;

  const checkStmt = db.prepare(
    `SELECT id FROM reviews WHERE source = ? AND author = ? AND substr(text, 1, 80) = ?`
  );
  const insertStmt = db.prepare(`
    INSERT INTO reviews (id, source, author, text, rating, date, sentiment, themes, scraped_at, analyzed_at, pipeline_run_id, url)
    VALUES (@id, @source, @author, @text, @rating, @date, @sentiment, @themes, @scraped_at, @analyzed_at, @pipeline_run_id, @url)
  `);

  const insertMany = db.transaction((items) => {
    for (const r of items) {
      const existing = checkStmt.get(
        r.source || '',
        r.author || '',
        (r.text || '').slice(0, 80)
      );
      if (existing) {
        skipped++;
        continue;
      }
      insertStmt.run({
        id: uuidv4(),
        source: r.source || 'Unknown',
        author: r.author || 'Anonymous',
        text: r.text || '',
        rating: r.rating ?? null,
        date: r.date || new Date().toISOString(),
        sentiment: null,
        themes: null,
        scraped_at: new Date().toISOString(),
        analyzed_at: null,
        pipeline_run_id: pipelineRunId || null,
        url: r.url || null,
      });
      inserted++;
    }
  });

  insertMany(reviews);
  return { inserted, skipped };
}

function createPipelineRun() {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO pipeline_runs (id, started_at, status)
    VALUES (?, ?, 'running')
  `).run(id, now);
  return id;
}

function updatePipelineRun(id, fields) {
  const db = getDb();
  const sets = [];
  const values = [];

  if (fields.status !== undefined) { sets.push('status = ?'); values.push(fields.status); }
  if (fields.completed_at !== undefined) { sets.push('completed_at = ?'); values.push(fields.completed_at); }
  if (fields.total_collected !== undefined) { sets.push('total_collected = ?'); values.push(fields.total_collected); }
  if (fields.per_source_counts !== undefined) { sets.push('per_source_counts = ?'); values.push(JSON.stringify(fields.per_source_counts)); }
  if (fields.scraper_errors !== undefined) { sets.push('scraper_errors = ?'); values.push(JSON.stringify(fields.scraper_errors)); }

  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE pipeline_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

module.exports = { deduplicateAndInsert, createPipelineRun, updatePipelineRun };
