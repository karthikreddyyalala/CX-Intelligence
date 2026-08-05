'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./db');

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

const STOP = new Set(['the', 'and', 'are', 'for', 'our', 'with', 'that', 'this', 'what', 'why', 'how', 'about', 'from', 'they', 'their', 'them', 'were', 'was', 'has', 'have', 'who', 'when', 'which', 'into', 'over', 'more', 'most', 'should', 'could', 'would', 'week', 'month', 'days', 'day', 'customers', 'customer', 'reviews', 'review', 'avis', 'people', 'saying', 'say']);

function tokens(q) {
  return [...new Set((q || '').toLowerCase().match(/[a-z']{4,}/g) || [])].filter(w => !STOP.has(w));
}

/**
 * Retrieve the most relevant real reviews for a question, hand them to Claude
 * as an evidence pack, and return an executive answer with cited quotes.
 */
async function askAnalyst(question) {
  const db = getDb();
  const words = tokens(question);

  // Candidate pool: analyzed reviews with text, last 45 days.
  const cutoff = new Date(Date.now() - 45 * 864e5).toISOString();
  const pool = db.prepare(`
    SELECT source, author, text, rating, date, sentiment, themes, url
    FROM reviews
    WHERE analyzed_at IS NOT NULL AND text IS NOT NULL AND text != '' AND date >= ?
  `).all(cutoff);

  // Score by keyword overlap in text + themes; recency + negativity nudge.
  const scored = pool.map(r => {
    const hay = (r.text + ' ' + (r.themes || '')).toLowerCase();
    let s = words.reduce((a, w) => a + (hay.includes(w) ? 2 : 0), 0);
    if (r.sentiment === 'negative') s += 0.5;
    return { r, s };
  }).sort((a, b) => b.s - a.s);

  const anyMatch = scored.some(x => x.s >= 2);
  const picked = (anyMatch ? scored.filter(x => x.s > 0) : scored).slice(0, 28).map(x => x.r);

  // Aggregate context
  const dist = db.prepare(`SELECT sentiment, COUNT(*) c FROM reviews WHERE analyzed_at IS NOT NULL GROUP BY sentiment`).all();
  const pains = db.prepare(`SELECT theme_name, impact_score, frequency, negative_ratio FROM pain_points ORDER BY impact_score DESC LIMIT 6`).all();
  const bySource = db.prepare(`SELECT source, COUNT(*) c, ROUND(AVG(rating),2) avg FROM reviews WHERE analyzed_at IS NOT NULL GROUP BY source ORDER BY c DESC`).all();

  const evidence = picked.map((r, i) =>
    `[#${i + 1} · ${r.source} · ${r.rating ? r.rating + '★' : 'no rating'} · ${(r.date || '').slice(0, 10)} · ${r.sentiment}] ${r.author}: "${(r.text || '').replace(/\s+/g, ' ').slice(0, 240)}"`
  ).join('\n');

  const prompt = `You are the CX Intelligence analyst for Avis. Answer the executive's question using ONLY the review evidence and stats below. Be direct, specific, and quantitative. Ground every claim in the data; quote 2–4 short snippets as proof. If the data doesn't cover it, say so briefly.

QUESTION: ${question}

SENTIMENT (analyzed): ${dist.map(d => `${d.sentiment}=${d.c}`).join(', ')}
PER-PLATFORM (count, avg rating): ${bySource.map(s => `${s.source} ${s.c}@${s.avg ?? 'n/a'}`).join(' | ')}
TOP PAIN POINTS: ${pains.map(p => `${p.theme_name} (impact ${p.impact_score}, ${p.frequency}×, ${Math.round(p.negative_ratio * 100)}% neg)`).join('; ') || 'none'}

REVIEW EVIDENCE:
${evidence || '(no matching reviews)'}

Respond ONLY as JSON:
{"answer": "<2-4 tight sentences of executive analysis>", "citations": [{"n": <evidence number>, "source": "<platform>", "author": "<name>", "quote": "<<=110 char quote>"}]}`;

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = resp.content[0].text.trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      // Attach source urls to citations where we can match them
      const byN = new Map(picked.map((r, i) => [i + 1, r]));
      const citations = (parsed.citations || []).slice(0, 4).map(c => {
        const src = byN.get(c.n);
        return { source: c.source, author: c.author, quote: c.quote, url: src?.url || null };
      });
      return { answer: parsed.answer || text, citations, evidenceCount: picked.length };
    }
    return { answer: text, citations: [], evidenceCount: picked.length };
  } catch (e) {
    return { answer: `Analyst unavailable: ${e.message}`, citations: [], evidenceCount: picked.length, error: true };
  }
}

module.exports = { askAnalyst };
