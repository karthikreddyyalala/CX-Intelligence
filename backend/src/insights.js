'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateInsightSummary() {
  const db = getDb();
  const now = new Date();
  const windowEnd = now.toISOString().slice(0, 10);
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Gather stats
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative
    FROM reviews WHERE date >= ? AND date <= ? AND analyzed_at IS NOT NULL
  `).get(windowStart, windowEnd + 'T23:59:59Z');

  const painPoints = db.prepare(`
    SELECT theme_name, impact_score, frequency, negative_ratio
    FROM pain_points WHERE window_start = ? AND window_end = ?
    ORDER BY impact_score DESC LIMIT 5
  `).all(windowStart, windowEnd);

  const sourceStats = db.prepare(`
    SELECT source, COUNT(*) as count,
      ROUND(AVG(rating), 1) as avg_rating,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count
    FROM reviews WHERE date >= ? AND date <= ? AND analyzed_at IS NOT NULL
    GROUP BY source ORDER BY count DESC
  `).all(windowStart, windowEnd + 'T23:59:59Z');

  // Sample negative reviews for context
  const sampleNegative = db.prepare(`
    SELECT source, text FROM reviews
    WHERE sentiment = 'negative' AND date >= ? AND date <= ?
    ORDER BY RANDOM() LIMIT 10
  `).all(windowStart, windowEnd + 'T23:59:59Z');

  const total = totalRow?.total || 0;
  const sentimentDist = {
    positive: totalRow?.positive || 0,
    neutral: totalRow?.neutral || 0,
    negative: totalRow?.negative || 0,
  };

  const prompt = `You are a Chief Customer Experience Officer writing a weekly brief for a VP of Customer Service.

DATA FOR THE LAST 30 DAYS:
- Total reviews collected: ${total}
- Positive: ${sentimentDist.positive} (${total > 0 ? Math.round(sentimentDist.positive / total * 100) : 0}%)
- Neutral: ${sentimentDist.neutral} (${total > 0 ? Math.round(sentimentDist.neutral / total * 100) : 0}%)
- Negative: ${sentimentDist.negative} (${total > 0 ? Math.round(sentimentDist.negative / total * 100) : 0}%)

PLATFORM BREAKDOWN:
${sourceStats.map(s => `- ${s.source}: ${s.count} reviews, avg rating: ${s.avg_rating || 'N/A'}, negative: ${s.negative_count}`).join('\n')}

TOP PAIN POINTS:
${painPoints.length > 0 ? painPoints.map((p, i) => `${i + 1}. "${p.theme_name}" — impact score ${p.impact_score}/100, mentioned ${p.frequency} times, ${Math.round(p.negative_ratio * 100)}% negative`).join('\n') : 'No significant pain points detected yet.'}

SAMPLE NEGATIVE FEEDBACK:
${sampleNegative.map(r => `- [${r.source}]: "${(r.text || '').slice(0, 150)}"`).join('\n')}

Write a 3-paragraph executive summary in plain business language:
1. Overall customer sentiment health (what's the state of our customer experience?)
2. Key problems customers are experiencing (be specific, use the data)
3. Top 3 recommended actions leadership should take immediately

Be direct, specific, and use the actual numbers. No fluff.`;

  let narrativeText = 'No AI summary available yet. Run the pipeline to generate insights.';

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    narrativeText = response.content[0].text.trim();
  } catch (e) {
    console.error('[Insights] Claude API error:', e.message);
  }

  // Build top recommendations from pain points
  const topRecommendations = painPoints.slice(0, 3).map((p, i) => ({
    rank: i + 1,
    action: `Address "${p.theme_name}" — ${p.frequency} customers affected, ${Math.round(p.negative_ratio * 100)}% negative`,
    impactScore: p.impact_score,
  }));

  const id = uuidv4();
  db.prepare(`
    INSERT INTO insight_summaries (id, generated_at, window_start, window_end, total_review_count, sentiment_distribution, top_pain_points, top_recommendations, narrative_text)
    VALUES (@id, @generated_at, @window_start, @window_end, @total_review_count, @sentiment_distribution, @top_pain_points, @top_recommendations, @narrative_text)
  `).run({
    id,
    generated_at: new Date().toISOString(),
    window_start: windowStart,
    window_end: windowEnd,
    total_review_count: total,
    sentiment_distribution: JSON.stringify(sentimentDist),
    top_pain_points: JSON.stringify(painPoints),
    top_recommendations: JSON.stringify(topRecommendations),
    narrative_text: narrativeText,
  });

  console.log('[Insights] Summary generated.');
  return { id, narrativeText, sentimentDist, painPoints, topRecommendations };
}

module.exports = { generateInsightSummary };
