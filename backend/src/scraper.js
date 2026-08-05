'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { ApifyClient } = require('apify-client');
const { deduplicateAndInsert, createPipelineRun, updatePipelineRun } = require('./ingest');
const { runMigrations } = require('./db');

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

// ─── AVIS — REAL, VERIFIED-WORKING APIFY SOURCES ───────────────────────────
// Only sources confirmed to return clean, on-topic, linkable Avis reviews on the
// current plan are run live. Others need paid/approved actors and stay seeded.
const TARGETS = {
  trustpilot: ['https://www.trustpilot.com/review/avis.com'],
  googleMaps: ['https://www.google.com/maps/search/Avis+Car+Rental+New+York'],
  googlePlay: 'com.avis.androidapp',   // Avis Car Rental app — feeds "app experience"
  reddit: ['Avis car rental', 'Avis rental experience'],
  appStore: '308342527',               // Avis iOS app — free Apple RSS, no Apify/credits
};

const MAX_PER_SOURCE = 250;  // how many to pull per channel
const RECENCY_DAYS = 90;     // window to keep (VoC standard is 30–90 days)
const KEEP_CAP = 250;        // max reviews retained per source after filtering

function normalize(source, author, text, rating, date, url) {
  return {
    source,
    author: author || 'Anonymous',
    text: text || '',
    rating: rating || null,
    // Store the calendar day only. Sources hand back a mix of "2026-07-24" and
    // full ISO timestamps, and mixing the two splits every group-by-day query.
    date: date ? String(date).slice(0, 10) : null,
    url: url || null,
  };
}

// Reddit dates come as epoch seconds/ms or ISO strings; never throw on a bad one.
function redditDate(r) {
  const raw = r.created_utc ?? r.createdAt ?? r.created ?? r.date;
  if (raw == null) return new Date().toISOString();
  const n = Number(raw);
  const d = !Number.isNaN(n) && n > 0 ? new Date(n > 1e12 ? n : n * 1000) : new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function scrapeTrustpilot(errors) {
  if (!TARGETS.trustpilot?.length) return [];
  console.log('  → Trustpilot (live)…');
  try {
    const run = await client.actor('automation-lab/trustpilot').call({
      companyUrls: TARGETS.trustpilot,       // plain strings — the actor parses domains
      maxReviews: MAX_PER_SOURCE,
      includeCompanyInfo: false,
    }, { waitSecs: 300 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    // Keep the actor's per-review permalink (/reviews/<id>) — it resolves fine in
    // a real browser. Trustpilot answers automated requests with 403, so a curl
    // check reads as "dead link" when the page is actually live; don't be fooled
    // into replacing these with the company page again.
    const companyUrl = 'https://www.trustpilot.com/review/avis.com';
    return items.map(r => normalize('Trustpilot', r.authorName, r.text, r.rating, r.publishedDate,
      r.reviewUrl || companyUrl));
  } catch (e) { errors.push({ source: 'Trustpilot', error: e.message }); return []; }
}

async function scrapeGoogleMaps(errors) {
  if (!TARGETS.googleMaps?.length) return [];
  console.log('  → Google Maps (live)…');
  try {
    const run = await client.actor('compass/google-maps-reviews-scraper').call({
      startUrls: TARGETS.googleMaps.map(url => ({ url })),
      maxReviews: MAX_PER_SOURCE,
      reviewsSort: 'newest',
      language: 'en',
    }, { waitSecs: 300 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items.map(r => normalize('Google Maps', r.name, r.text, r.stars, r.publishedAtDate, r.reviewUrl));
  } catch (e) { errors.push({ source: 'Google Maps', error: e.message }); return []; }
}

async function scrapeGooglePlay(errors) {
  if (!TARGETS.googlePlay) return [];
  console.log('  → Google Play app reviews (live)…');
  try {
    const run = await client.actor('neatrat/google-play-store-reviews-scraper').call({
      appIdOrUrl: TARGETS.googlePlay,
      maxReviews: MAX_PER_SOURCE,
      sortBy: 'newest',
    }, { waitSecs: 300 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const appUrl = `https://play.google.com/store/apps/details?id=${TARGETS.googlePlay}`;
    return items.map(r => normalize('Google Play', r.reviewer, r.body, r.rating, r.date, appUrl));
  } catch (e) { errors.push({ source: 'Google Play', error: e.message }); return []; }
}

async function scrapeReddit(errors) {
  if (!TARGETS.reddit?.length) return [];
  console.log('  → Reddit mentions (live)…');
  try {
    const run = await client.actor('fatihtahta/reddit-scraper-search-fast').call({
      queries: TARGETS.reddit,
      sort: 'new',
      scrapeComments: false,
    }, { waitSecs: 300 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 80 });
    return items
      // Reddit search is fuzzy — require the brand within ~30 chars of a rental
      // context so we skip false positives (French "avis" = "opinion", "advisor").
      .filter(r => {
        const t = `${r.title || ''} ${r.body || ''}`.toLowerCase();
        return /avis.{0,30}(car|rental|rent|vehicle|hertz|budget|enterprise)|(car rental|rental car|rented|rent a car|car hire|vehicle).{0,30}avis/.test(t);
      })
      .map(r => {
        const text = [r.title, r.body].filter(Boolean).join(' — ');
        return normalize('Reddit', r.author, text, null, redditDate(r), r.url || r.canonical_url);
      });
  } catch (e) { errors.push({ source: 'Reddit', error: e.message }); return []; }
}

// FREE — Apple's public RSS feed. No Apify, no key, no credit usage.
async function scrapeAppStore(errors) {
  if (!TARGETS.appStore) return [];
  console.log('  → App Store reviews (free Apple RSS)…');
  try {
    const out = [];
    for (let page = 1; page <= 4; page++) {
      const res = await fetch(`https://itunes.apple.com/us/rss/customerreviews/id=${TARGETS.appStore}/sortBy=mostRecent/page=${page}/json`);
      if (!res.ok) break;
      const j = await res.json();
      const entries = ((j.feed && j.feed.entry) || []).filter(e => e['im:rating']);
      if (!entries.length) break;
      for (const e of entries) {
        const rating = parseInt(e['im:rating']?.label, 10) || null;
        const text = [e.title?.label, e.content?.label].filter(Boolean).join(' — ');
        // Apple exposes a real per-review timestamp in `updated`, e.g.
        // "2026-07-01T19:24:54-07:00". Keep the date exactly as Apple states it —
        // converting to UTC would push evening Pacific reviews into the next day.
        const date = e.updated?.label ? e.updated.label.slice(0, 10) : null;
        // Reliable public reviews page (the RSS per-review link opens iTunes, not the web).
        const url = `https://apps.apple.com/us/app/id${TARGETS.appStore}?see-all=reviews`;
        out.push(normalize('App Store', e.author?.name?.label, text, rating, date, url));
      }
    }
    return out;
  } catch (e) { errors.push({ source: 'App Store', error: e.message }); return []; }
}

const LIVE_SCRAPERS = {
  trustpilot: scrapeTrustpilot,
  googleMaps: scrapeGoogleMaps,
  googlePlay: scrapeGooglePlay,
  reddit: scrapeReddit,
  appStore: scrapeAppStore,
};

function dedupe(reviews) {
  const seen = new Set();
  return reviews.filter(r => {
    const key = `${r.source}-${r.author}-${(r.text || '').slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Keep the most recent window; fall back to newest N if the window is thin.
function keepRecent(reviews) {
  const cutoff = Date.now() - RECENCY_DAYS * 864e5;
  const withDates = reviews
    .filter(r => r.date && !isNaN(Date.parse(r.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const recent = withDates.filter(r => Date.parse(r.date) >= cutoff);
  const pool = recent.length >= 10 ? recent : (withDates.length ? withDates : reviews);
  return pool.slice(0, KEEP_CAP);
}

/**
 * Run the live Apify sources, dedupe, keep the recent window, and persist.
 * @param {string[]} sources  which live sources to run (default: all live ones)
 */
async function runScraper(sources = Object.keys(LIVE_SCRAPERS)) {
  runMigrations();
  const runId = createPipelineRun();
  console.log(`\n[Scraper] Live sweep ${runId} · sources: ${sources.join(', ')}`);
  const errors = [];
  const results = [];

  for (const key of sources) {
    const fn = LIVE_SCRAPERS[key];
    if (!fn) continue;
    try { results.push(...(await fn(errors))); }
    catch (e) { errors.push({ source: key, error: e.message }); }
  }

  // Apply the recency window per source so a high-volume channel (Google) doesn't
  // crowd out lower-volume ones (Reddit) that mention the brand less often.
  const bySource = {};
  for (const r of dedupe(results)) (bySource[r.source] ||= []).push(r);
  const clean = Object.values(bySource).flatMap(list => keepRecent(list));
  const { inserted, skipped } = deduplicateAndInsert(clean, runId);

  const perSource = {};
  for (const r of clean) perSource[r.source] = (perSource[r.source] || 0) + 1;

  updatePipelineRun(runId, {
    status: 'complete',
    completed_at: new Date().toISOString(),
    total_collected: inserted,
    per_source_counts: perSource,
    scraper_errors: errors,
  });

  console.log(`[Scraper] Done. Scraped: ${results.length}, kept: ${clean.length}, inserted: ${inserted}, skipped: ${skipped}, errors: ${errors.length}`);
  return { runId, inserted, skipped, perSource, errors };
}

module.exports = { runScraper };

if (require.main === module) {
  if (!process.env.APIFY_TOKEN) { console.error('Missing APIFY_TOKEN'); process.exit(1); }
  runScraper().catch(e => { console.error('[Scraper] Fatal:', e.message); process.exit(1); });
}
