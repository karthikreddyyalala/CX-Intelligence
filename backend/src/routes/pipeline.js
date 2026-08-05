'use strict';
const express = require('express');
const { getDb } = require('../db');
const { analyzeUnprocessed } = require('../analyzer');
const { calculatePainPoints } = require('../painPoints');
const { generateInsightSummary } = require('../insights');
const { createPipelineRun, updatePipelineRun } = require('../ingest');
const { runScraper } = require('../scraper');
const router = express.Router();

let isRunning = false;

// POST /api/pipeline/run — trigger AI analysis on existing scraped reviews
router.post('/run', async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ status: 'already_running', message: 'Pipeline is already running.' });
  }

  const runId = createPipelineRun();
  isRunning = true;
  res.json({ status: 'started', runId });

  // Full sweep: live Apify scrape → ingest → Claude analysis → pain points → brief.
  (async () => {
    let scrapeErrors = [];
    let scraped = 0;
    try {
      if (process.env.APIFY_TOKEN) {
        console.log('[Pipeline] Live Apify sweep…');
        const r = await runScraper();          // Trustpilot + Google Maps (real, recent)
        scraped = r.inserted;
        scrapeErrors = r.errors || [];
      } else {
        console.log('[Pipeline] No APIFY_TOKEN — analysis only.');
      }
    } catch (e) {
      console.error('[Pipeline] Scrape failed, continuing to analysis:', e.message);
      scrapeErrors.push({ source: 'scraper', error: e.message });
    }

    try {
      console.log('[Pipeline] Claude analysis…');
      const analyzed = await analyzeUnprocessed();
      calculatePainPoints();
      await generateInsightSummary();

      updatePipelineRun(runId, {
        status: 'complete',
        completed_at: new Date().toISOString(),
        total_collected: scraped || analyzed,
        per_source_counts: {},
        scraper_errors: scrapeErrors,
      });
      console.log(`[Pipeline] Complete. Scraped ${scraped}, analyzed ${analyzed}.`);
    } catch (e) {
      console.error('[Pipeline] Error:', e.message);
      updatePipelineRun(runId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        scraper_errors: [...scrapeErrors, { error: e.message }],
      });
    } finally {
      isRunning = false;
    }
  })();
});

// GET /api/pipeline/status
router.get('/status', (req, res) => {
  try {
    const db = getDb();
    const run = db.prepare(`
      SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT 1
    `).get();

    if (!run) return res.json({ status: 'idle', isRunning: false });

    res.json({
      ...run,
      per_source_counts: JSON.parse(run.per_source_counts || '{}'),
      scraper_errors: JSON.parse(run.scraper_errors || '[]'),
      isRunning,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
