'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./db');

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// Public-reply etiquette differs per channel — a Google/Trustpilot response is a
// public brand voice; an App Store reply is a developer response. Kept short.
const CHANNEL_HINT = {
  'Trustpilot': 'a public Trustpilot business reply',
  'Google Maps': 'a public Google review response from the business',
  'App Store': 'an App Store developer response',
  'Google Play': 'a Google Play developer response',
  'Reddit': 'a genuine, non-corporate Reddit comment from an Avis rep (Reddit dislikes copy-paste PR speak)',
};

/**
 * Draft an on-brand public response to a single real review.
 * Tone adapts to sentiment/rating: warm thanks for praise, empathetic
 * resolution path for complaints. Returns the draft plus its tone label.
 */
async function draftReply(reviewId) {
  const db = getDb();
  const r = db.prepare(
    `SELECT source, author, text, rating, date, sentiment FROM reviews WHERE id = ?`
  ).get(reviewId);
  if (!r) return { error: 'Review not found.' };

  const channel = CHANNEL_HINT[r.source] || 'a public reply from the business';
  const stance = r.sentiment === 'positive'
    ? 'The customer is happy. Thank them warmly and specifically; reinforce what they liked. Do NOT apologize.'
    : r.sentiment === 'neutral'
      ? 'The customer is mixed. Acknowledge the good, own the gap, and offer a concrete way to make it right.'
      : 'The customer is unhappy. Lead with genuine empathy, take ownership without excuses, name the specific problem they raised, and give one concrete next step to resolve it.';

  const prompt = `You draft public responses for the Avis customer experience team. Write ${channel} to the review below.

RULES:
- ${stance}
- Reference the SPECIFIC issue or praise in their words — never generic ("we value your feedback" alone is banned).
- Warm, human, and concise: 2–4 sentences. No corporate filler, no emojis, no exclamation-mark spam.
- For complaints, give ONE concrete resolution path (e.g. invite them to reach Avis Customer Care with their rental/confirmation number) — do not over-promise refunds or outcomes you can't guarantee.
- Sign off simply as the Avis team where the channel expects it; on Reddit, sound like a real person, not a press release.
- Output ONLY the reply text — no preamble, no quotes around it, no notes.

REVIEW (${r.source}${r.rating ? ` · ${r.rating}★` : ''} · ${r.sentiment}):
${r.author || 'A customer'}: "${(r.text || '').replace(/\s+/g, ' ').slice(0, 700)}"`;

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });
    const reply = (resp.content[0]?.text || '').trim().replace(/^["']|["']$/g, '');
    return { reply, tone: r.sentiment, source: r.source, author: r.author };
  } catch (e) {
    return { error: `Draft unavailable: ${e.message}` };
  }
}

module.exports = { draftReply };
