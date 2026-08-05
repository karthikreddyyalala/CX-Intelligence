'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./db');

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function analyzeBatch(reviews) {
  const prompt = JSON.stringify(
    reviews.map(r => ({ id: r.id, source: r.source, text: (r.text || '').slice(0, 500), rating: r.rating }))
  );

  const systemPrompt = `You are a customer experience analyst. Analyze customer reviews and return ONLY valid JSON.
For each review extract:
- sentiment: exactly "positive", "neutral", or "negative"
- themes: array of 1-5 short topic labels (e.g. "wait time", "staff attitude", "billing", "app experience", "product quality")
- employees: array of STAFF MEMBERS named in the text, each {"name": "...", "sentiment": "positive|negative"}

Rules for "employees" — precision matters far more than recall:
- Only include a person the reviewer clearly identifies as an employee who served them
  (e.g. "Erica was super helpful", "the manager Ralph refused", "ask for Nandi").
- Use the name exactly as written, trimmed to the given name and any initial
  ("Luke C" stays "Luke C"). Capitalise normally.
- "sentiment" is how the reviewer felt about THAT PERSON, which can differ from the
  review overall (a happy agent inside an otherwise angry review stays "positive").
- NEVER include: the brand ("Avis"), places or airports ("Dallas", "JFK"), the
  reviewer themselves, generic words ("Staff", "Everyone", "Service", "They"),
  or a name you inferred rather than read.
- If nobody is named, return an empty array. An empty array is the correct and
  expected answer for most reviews.

Return this exact JSON format:
{"analyses": [{"id": "...", "sentiment": "positive|neutral|negative", "themes": ["topic1", "topic2"], "employees": [{"name": "Erica", "sentiment": "positive"}]}]}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,  // headroom for the per-review employee array
        system: systemPrompt,
        messages: [{ role: 'user', content: `Analyze these reviews:\n${prompt}` }],
      });
      const text = response.content[0].text.trim();
      // Extract JSON even if wrapped in markdown code blocks
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.analyses || [];
    } catch (e) {
      console.error(`  [Analyzer] Attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt < 2) await sleep(1000 * Math.pow(2, attempt));
    }
  }
  console.error('  [Analyzer] Batch failed after 3 retries, skipping.');
  return [];
}

// Words the model occasionally returns as a "name" despite the prompt. Dropping
// them here keeps one bad batch from polluting the people leaderboard.
const NOT_A_NAME = new Set([
  'avis', 'staff', 'everyone', 'they', 'them', 'service', 'team', 'manager',
  'agent', 'employee', 'rep', 'representative', 'associate', 'driver', 'anonymous',
  'customer', 'guy', 'lady', 'gentleman', 'this', 'that', 'there', 'car', 'rental',
]);

/** Keep only entries that look like a real person the reviewer actually named. */
function cleanEmployees(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const e of raw) {
    const name = String(e?.name ?? '').trim().replace(/\s+/g, ' ');
    // Letters, spaces, apostrophes and hyphens only; 2–24 chars; not a stop word.
    if (!/^[A-Za-z][A-Za-z'’\-. ]{1,23}$/.test(name)) continue;
    if (NOT_A_NAME.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, sentiment: e.sentiment === 'negative' ? 'negative' : 'positive' });
  }
  return out;
}

async function analyzeUnprocessed() {
  const db = getDb();
  // `employees_at IS NULL` also picks up rows analyzed before staff extraction
  // existed, so an older corpus gets the new field without a full re-analysis.
  const unprocessed = db.prepare(`
    SELECT id, source, text, rating FROM reviews
    WHERE (analyzed_at IS NULL OR employees_at IS NULL) AND text IS NOT NULL AND text != ''
    ORDER BY scraped_at ASC
  `).all();

  if (unprocessed.length === 0) {
    console.log('[Analyzer] No unprocessed reviews.');
    return 0;
  }

  console.log(`[Analyzer] Processing ${unprocessed.length} reviews in batches of 30...`);

  const updateStmt = db.prepare(`
    UPDATE reviews SET sentiment = @sentiment, themes = @themes, analyzed_at = @analyzed_at,
                       employees = @employees, employees_at = @employees_at
    WHERE id = @id
  `);

  const BATCH_SIZE = 30;
  let analyzed = 0;

  for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
    const batch = unprocessed.slice(i, i + BATCH_SIZE);
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(unprocessed.length / BATCH_SIZE)}...`);

    const results = await analyzeBatch(batch);
    const resultMap = new Map(results.map(r => [r.id, r]));

    const updateMany = db.transaction(() => {
      for (const review of batch) {
        const result = resultMap.get(review.id);
        if (result) {
          const now = new Date().toISOString();
          updateStmt.run({
            id: review.id,
            sentiment: result.sentiment || 'neutral',
            themes: JSON.stringify(result.themes || ['general feedback']),
            analyzed_at: now,
            employees: JSON.stringify(cleanEmployees(result.employees)),
            employees_at: now,
          });
          analyzed++;
        }
      }
    });
    updateMany();
  }

  console.log(`[Analyzer] Done. Analyzed ${analyzed} reviews.`);
  return analyzed;
}

module.exports = { analyzeUnprocessed, analyzeBatch };
