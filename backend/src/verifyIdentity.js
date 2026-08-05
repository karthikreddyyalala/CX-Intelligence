'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./db');
const { getIdentityClusters, ensureTable } = require('./identity');

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Second opinion on the statistically-found clusters. The heuristics in
 * identity.js surface candidates; the model reads the actual reviews and rules
 * on each one. Verdicts are stored so the dashboard never waits on (or pays
 * for) an API call at read time. Idempotent: verified clusters are skipped.
 */

const SYSTEM = `You are a fraud/identity analyst for a customer-review platform.
You are given small clusters of reviews that automated heuristics flagged as
possibly written by the same person (under different display names, on different
platforms, or across different store branches).

For each cluster, decide:
- verdict: "same-person" (same author, near-certain), "same-incident" (one event,
  possibly companions or one person on two accounts), "unrelated" (coincidence),
  or "unclear".
- confidence: 0-100, your honest probability that the verdict is right.
- reasoning: 1-2 sentences citing CONCRETE overlaps (shared specific details,
  identical unusual phrasing, timing) or the lack of them. Generic complaints
  that thousands of renters share (long waits, rude staff, no car available)
  are NOT evidence of identity on their own.

Be skeptical. A shared complaint type is weak; a shared specific detail
(the same odd car model, the same named agent, the same invented phrase) is strong.

Return ONLY valid JSON: {"results":[{"clusterId":"...","verdict":"...","confidence":0,"reasoning":"..."}]}`;

async function main() {
  const db = getDb();
  ensureTable(db);
  const { clusters } = getIdentityClusters();

  const pending = clusters.filter(c => !c.ai && c.score >= 0.55).slice(0, 25);
  if (!pending.length) {
    console.log('[Verify] Nothing new to verify.');
    return;
  }
  console.log(`[Verify] Sending ${pending.length} cluster(s) to the model…`);

  const payload = pending.map(c => ({
    clusterId: c.clusterId,
    flaggedBecause: c.signals,
    reviews: c.reviews.map(r => ({
      platform: r.source, displayName: r.author, stars: r.rating,
      date: r.date, branch: r.location, text: r.text,
    })),
  }));

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  });

  const match = response.content[0].text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in model response');
  const { results } = JSON.parse(match[0]);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO identity_verdicts (cluster_id, verdict, confidence, reasoning, verified_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  let saved = 0;
  for (const r of results || []) {
    if (!r.clusterId || !r.verdict) continue;
    stmt.run(r.clusterId, r.verdict, Math.round(r.confidence || 0), r.reasoning || '', now);
    saved++;
  }
  console.log(`[Verify] Stored ${saved} verdict(s).`);
}

if (require.main === module) {
  main().catch(e => { console.error('[Verify] Fatal:', e.message); process.exit(1); });
}
module.exports = { main };
