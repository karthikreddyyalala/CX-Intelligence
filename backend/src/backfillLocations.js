'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { ApifyClient } = require('apify-client');
const { v4: uuidv4 } = require('uuid');
const { getDb, runMigrations } = require('./db');

/**
 * Backfills branch identity onto Google Maps reviews.
 *
 * The Maps scraper already returned full storefront metadata (address, city,
 * lat/lng, branch rating) for every review, but the original ingest dropped it
 * and kept only 296 of 1,499 rows. This re-reads the finished Apify datasets —
 * no new credits, no re-scrape — and both enriches existing rows and pulls in
 * the reviews that were left on the floor.
 *
 * Safe to re-run: rows are matched on the same dedupe key ingest.js uses
 * (source + author + first 80 chars), so a second pass updates instead of
 * duplicating.
 */

// Finished Google Maps review runs. Datasets expire on the free plan, so a
// missing one is logged and skipped rather than treated as fatal.
const DATASETS = ['B9lTA0ZyEiFjZE1D4', 'Ljs89L1zZAtz4nogt'];

// Airport counters behave nothing like neighbourhood branches — different
// staffing, hours, and customer mix — so they're flagged for separate analysis.
// Keyed by postal code because street names alone are ambiguous.
const AIRPORTS = {
  '11430': 'JFK Airport',
  '07114': 'EWR · Newark Airport',
  '11371': 'LGA · LaGuardia Airport',
  '75261': 'DFW Airport',
  '75235': 'DAL · Love Field',
};

/**
 * Short, readable branch label — an airport name, or the street it sits on.
 *
 * Google's `street` is often a full mailing line ("Columbus Square, 808 Columbus
 * Ave Apts - Garage"). The street address itself is the part people recognise,
 * so prefer the comma-segment that starts with a house number and drop unit
 * qualifiers, rather than truncating mid-word.
 */
function labelFor(item) {
  const airport = AIRPORTS[item.postalCode];
  if (airport) return airport;

  const raw = item.street || item.neighborhood || item.city || '';
  const segments = raw.split(',').map(s => s.trim()).filter(Boolean);
  const label = (segments.find(s => /^\d/.test(s)) || segments[0] || '')
    .replace(/\s+(?:-\s*)?(?:garage|suite|ste|unit|apt|floor|fl|level)\b.*$/i, '')
    .replace(/\s*-\s*$/, '')
    .trim();

  if (!label) return item.city || 'Unknown branch';
  return label.length > 30 ? `${label.slice(0, 29).trimEnd()}…` : label;
}

function locationFieldsFrom(item) {
  return {
    place_id: item.placeId || null,
    location_name: labelFor(item),
    address: item.address || null,
    city: item.city || null,
    state: item.state || null,
    neighborhood: item.neighborhood || null,
    lat: item.location?.lat ?? null,
    lng: item.location?.lng ?? null,
    location_rating: item.totalScore ?? null,
    location_review_count: item.reviewsCount ?? null,
    is_airport: AIRPORTS[item.postalCode] ? 1 : 0,
  };
}

async function fetchAll() {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const out = [];
  for (const id of DATASETS) {
    try {
      const { items } = await client.dataset(id).listItems();
      const usable = items.filter(r => r.placeId && r.address);
      console.log(`  dataset ${id}: ${items.length} items, ${usable.length} with branch data`);
      out.push(...usable);
    } catch (e) {
      console.warn(`  dataset ${id}: skipped (${e.message})`);
    }
  }
  return out;
}

async function backfill() {
  if (!process.env.APIFY_TOKEN) throw new Error('Missing APIFY_TOKEN');
  runMigrations();
  const db = getDb();

  console.log('[Backfill] Reading finished Apify datasets…');
  const items = await fetchAll();
  if (!items.length) {
    console.log('[Backfill] No branch data available. Nothing to do.');
    return { updated: 0, inserted: 0, locations: 0 };
  }

  // Match on Google's own review id where a row already carries one; fall back
  // to the legacy author + text-prefix key to adopt rows ingested before that
  // column existed. The prefix key is unreliable for text containing non-BMP
  // characters, which is exactly why review_id is now recorded.
  const findByReviewId = db.prepare(`SELECT id FROM reviews WHERE review_id = ?`);
  const findLegacy = db.prepare(
    `SELECT id FROM reviews WHERE source = 'Google Maps' AND review_id IS NULL
       AND author = ? AND substr(text, 1, 80) = ?`
  );

  const LOC_COLS = ['place_id', 'location_name', 'address', 'city', 'state', 'neighborhood',
    'lat', 'lng', 'location_rating', 'location_review_count', 'is_airport'];

  const updateStmt = db.prepare(`
    UPDATE reviews SET
      ${LOC_COLS.map(c => `${c} = @${c}`).join(', ')},
      review_id           = @review_id,
      owner_response_date = @owner_response_date,
      owner_response_text = @owner_response_text,
      published_at_exact  = @published_at_exact,
      url                 = COALESCE(@url, url)
    WHERE id = @id
  `);

  const insertStmt = db.prepare(`
    INSERT INTO reviews (
      id, source, author, text, rating, date, sentiment, themes,
      scraped_at, analyzed_at, pipeline_run_id, url, review_id,
      owner_response_date, owner_response_text, published_at_exact,
      ${LOC_COLS.join(', ')}
    ) VALUES (
      @id, 'Google Maps', @author, @text, @rating, @date, NULL, NULL,
      @scraped_at, NULL, NULL, @url, @review_id,
      @owner_response_date, @owner_response_text, @published_at_exact,
      ${LOC_COLS.map(c => `@${c}`).join(', ')}
    )
  `);

  let updated = 0, inserted = 0, skippedNoText = 0;
  const places = new Set();

  const run = db.transaction(() => {
    for (const item of items) {
      const text = (item.text || '').trim();
      // Star-only ratings carry no language to analyze, but they still count
      // toward a branch's score — keep them so location averages stay honest.
      const author = item.name || 'Anonymous';
      if (!text) skippedNoText++;

      const loc = locationFieldsFrom(item);
      places.add(loc.place_id);

      const shared = {
        ...loc,
        review_id: item.reviewId || null,
        owner_response_date: item.responseFromOwnerDate || null,
        owner_response_text: item.responseFromOwnerText || null,
        published_at_exact: item.publishedAtDate || null,
        url: item.reviewUrl || item.url || null,
      };

      const existing = (item.reviewId && findByReviewId.get(item.reviewId))
        || findLegacy.get(author, text.slice(0, 80));
      if (existing) {
        updateStmt.run({ ...shared, id: existing.id });
        updated++;
      } else {
        insertStmt.run({
          ...shared,
          id: uuidv4(),
          author,
          text,
          rating: item.stars ?? null,
          date: item.publishedAtDate ? item.publishedAtDate.slice(0, 10) : null,
          scraped_at: new Date().toISOString(),
        });
        inserted++;
      }
    }
  });
  run();

  // Google returns slightly different `street` strings for the same storefront
  // across records ("… Ave" vs "… Ave SUITE 106"), which would split one branch
  // into two rows in every grouped view. Collapse each place to a single
  // canonical label — the shortest, which is the one without unit qualifiers.
  const collapsed = db.prepare(`
    UPDATE reviews SET location_name = (
      SELECT r.location_name FROM reviews r
      WHERE r.place_id = reviews.place_id AND r.location_name IS NOT NULL
      ORDER BY length(r.location_name), r.location_name LIMIT 1
    )
    WHERE place_id IS NOT NULL
  `).run();

  console.log(`[Backfill] Done. Updated: ${updated}, inserted: ${inserted}, branches: ${places.size}` +
    (skippedNoText ? `, star-only (no text): ${skippedNoText}` : '') +
    ` · labels normalised on ${collapsed.changes} rows`);
  return { updated, inserted, locations: places.size };
}

module.exports = { backfill };

if (require.main === module) {
  backfill().catch(e => { console.error('[Backfill] Fatal:', e.message); process.exit(1); });
}
