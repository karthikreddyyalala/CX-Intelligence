'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
// Defaults to the committed demo database. A host can point elsewhere (e.g. a
// persistent volume) by setting DB_PATH.
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'cx_dashboard.db');

let _db = null;

function getDb() {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      author TEXT,
      text TEXT,
      rating REAL,
      date TEXT,
      sentiment TEXT,
      themes TEXT,
      scraped_at TEXT NOT NULL,
      analyzed_at TEXT,
      pipeline_run_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_source ON reviews(source);
    CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(date);
    CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
    CREATE INDEX IF NOT EXISTS idx_reviews_analyzed ON reviews(analyzed_at);
    CREATE INDEX IF NOT EXISTS idx_reviews_scraped ON reviews(scraped_at);

    CREATE TABLE IF NOT EXISTS pain_points (
      id TEXT PRIMARY KEY,
      theme_name TEXT NOT NULL,
      impact_score REAL NOT NULL,
      frequency INTEGER NOT NULL,
      negative_ratio REAL NOT NULL,
      window_start TEXT,
      window_end TEXT,
      identified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS insight_summaries (
      id TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      window_start TEXT,
      window_end TEXT,
      total_review_count INTEGER,
      sentiment_distribution TEXT,
      top_pain_points TEXT,
      top_recommendations TEXT,
      narrative_text TEXT
    );

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      total_collected INTEGER DEFAULT 0,
      per_source_counts TEXT DEFAULT '{}',
      scraper_errors TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'running'
    );
  `);

  // Additive migrations. Each column is added independently so an older DB
  // upgrades in place without a rebuild.
  const cols = db.prepare(`PRAGMA table_info(reviews)`).all().map(c => c.name);
  const addColumn = (name, type) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE reviews ADD COLUMN ${name} ${type}`);
  };

  addColumn('url', 'TEXT');

  // Owner-response data (Google Maps exposes it; other sources don't).
  addColumn('owner_response_date', 'TEXT');
  addColumn('owner_response_text', 'TEXT');
  addColumn('published_at_exact', 'TEXT');

  // Branch identity. Google Maps reviews are tied to a specific storefront, so
  // every metric can be cut by location instead of only by platform.
  addColumn('place_id', 'TEXT');        // stable Google place identifier
  addColumn('location_name', 'TEXT');   // short human label, e.g. "JFK Airport"
  addColumn('address', 'TEXT');
  addColumn('city', 'TEXT');
  addColumn('state', 'TEXT');
  addColumn('neighborhood', 'TEXT');
  addColumn('lat', 'REAL');
  addColumn('lng', 'REAL');
  addColumn('location_rating', 'REAL');  // Google's overall score for the branch
  addColumn('location_review_count', 'INTEGER');
  addColumn('is_airport', 'INTEGER');    // 1 = airport counter, 0 = neighbourhood

  // Google's own per-review identifier. A stable key beats matching on
  // author + text prefix, which desynchronises on non-BMP characters (JS slice
  // counts UTF-16 units, SQLite substr counts characters) and re-inserts dupes.
  addColumn('review_id', 'TEXT');

  // Staff named in the review text, extracted by the analyzer.
  // JSON: [{ "name": "Erica", "sentiment": "positive" }]
  addColumn('employees', 'TEXT');
  addColumn('employees_at', 'TEXT');     // when extraction ran; NULL = pending

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_city ON reviews(city);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_review_id
      ON reviews(review_id) WHERE review_id IS NOT NULL;
  `);

  // Older rows stored the source's raw timestamp ("2026-07-24T08:28:43.543Z")
  // while newer ones store the calendar day. Both sort correctly, but mixing
  // them splits any GROUP BY date. Truncating is lossless for reporting — the
  // exact instant is preserved separately in published_at_exact.
  const mixed = db.prepare(
    `UPDATE reviews SET date = substr(date, 1, 10) WHERE date LIKE '____-__-__T%'`
  ).run();
  if (mixed.changes) console.log(`[DB] Normalised ${mixed.changes} timestamp(s) to calendar dates.`);

  console.log('[DB] Migrations complete. DB at:', DB_PATH);
  return db;
}

module.exports = { getDb, runMigrations };
