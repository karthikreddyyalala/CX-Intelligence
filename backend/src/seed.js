/**
 * DEMO SEED — populates the database with realistic sample reviews
 * for demonstration purposes. Run with: node src/seed.js
 */
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { runMigrations } = require('./db');
const { deduplicateAndInsert, createPipelineRun, updatePipelineRun } = require('./ingest');

const SAMPLE_REVIEWS = [
  // Google Maps
  { source: 'Google Maps', author: 'Sarah M.', text: 'Absolutely love this place! Staff was incredibly helpful and the service was top-notch. Will definitely come back.', rating: 5, date: daysAgo(1) },
  { source: 'Google Maps', author: 'John D.', text: 'Waited over 45 minutes just to speak with someone. The wait times here are completely unacceptable. Very frustrating experience.', rating: 2, date: daysAgo(1) },
  { source: 'Google Maps', author: 'Emily R.', text: 'The app keeps crashing every time I try to check my account balance. This is the third time this week. Please fix this!', rating: 1, date: daysAgo(2) },
  { source: 'Google Maps', author: 'Mike T.', text: 'Great customer service experience. The representative was patient and resolved my billing issue quickly.', rating: 4, date: daysAgo(2) },
  { source: 'Google Maps', author: 'Lisa K.', text: 'Got charged twice for the same transaction. When I called to complain, I was put on hold for 30 minutes and then disconnected.', rating: 1, date: daysAgo(3) },
  { source: 'Google Maps', author: 'David W.', text: 'Average experience. Nothing exceptional but nothing terrible either. The new online portal is a bit confusing to navigate.', rating: 3, date: daysAgo(3) },
  { source: 'Google Maps', author: 'Anna P.', text: 'Billing is always a nightmare. Unexplained charges every month and customer service just reads from a script.', rating: 2, date: daysAgo(4) },
  { source: 'Google Maps', author: 'Chris L.', text: 'Fast and efficient service. Got my issue resolved in under 10 minutes. Really impressed!', rating: 5, date: daysAgo(4) },
  { source: 'Google Maps', author: 'Rachel B.', text: 'The mobile app is broken. Cannot login, cannot view statements, cannot do anything. When will this be fixed??', rating: 1, date: daysAgo(5) },
  { source: 'Google Maps', author: 'Tom H.', text: 'Staff was rude and dismissive when I raised a concern. Did not feel heard or valued as a customer at all.', rating: 2, date: daysAgo(5) },

  // Trustpilot
  { source: 'Trustpilot', author: 'Jennifer S.', text: 'Excellent service overall. The team went above and beyond to help me. Five stars well deserved!', rating: 5, date: daysAgo(1) },
  { source: 'Trustpilot', author: 'Mark A.', text: 'Billing errors keep appearing on my account. This has happened 4 times in 6 months. Very unprofessional.', rating: 1, date: daysAgo(2) },
  { source: 'Trustpilot', author: 'Susan G.', text: 'Long wait times every single time I call. Minimum 30 minute hold before even reaching a human being.', rating: 2, date: daysAgo(2) },
  { source: 'Trustpilot', author: 'Robert N.', text: 'The mobile app experience has significantly improved. Love the new interface! Very intuitive now.', rating: 4, date: daysAgo(3) },
  { source: 'Trustpilot', author: 'Patricia F.', text: 'Cannot believe how rude the support staff was. Talked over me the entire time and did not solve my problem.', rating: 1, date: daysAgo(3) },
  { source: 'Trustpilot', author: 'Kevin M.', text: 'Great company with reliable service. Minor issue with app login was resolved quickly by support.', rating: 4, date: daysAgo(4) },
  { source: 'Trustpilot', author: 'Nancy T.', text: 'App crashes constantly. I have uninstalled and reinstalled 3 times. Still the same problem. Very poor quality.', rating: 1, date: daysAgo(5) },
  { source: 'Trustpilot', author: 'Steven C.', text: 'Dispute resolution process is extremely slow. Been waiting 3 weeks for a simple billing correction.', rating: 2, date: daysAgo(6) },
  { source: 'Trustpilot', author: 'Linda H.', text: 'Smooth experience from start to finish. The onboarding process was clear and staff were very knowledgeable.', rating: 5, date: daysAgo(7) },
  { source: 'Trustpilot', author: 'Daniel R.', text: 'Terrible wait times on the phone. 45 minutes on hold just to ask a simple question. This is ridiculous.', rating: 1, date: daysAgo(8) },

  // Yelp
  { source: 'Yelp', author: 'Amanda V.', text: 'Overall good experience. Staff is friendly and the process was straightforward. Would recommend.', rating: 4, date: daysAgo(2) },
  { source: 'Yelp', author: 'Brian S.', text: 'The wait time was completely unreasonable. Sat waiting for over an hour while staff chatted with each other.', rating: 1, date: daysAgo(3) },
  { source: 'Yelp', author: 'Cynthia J.', text: 'Mysterious billing charges keep appearing. Nobody can explain them. Switching providers next month.', rating: 1, date: daysAgo(4) },
  { source: 'Yelp', author: 'Eric P.', text: 'Pretty good service. Had to wait a bit but the staff were helpful once I got through. App works fine for me.', rating: 3, date: daysAgo(5) },
  { source: 'Yelp', author: 'Fiona K.', text: 'Outstanding customer service! They really care about solving your problem. Quick, efficient, friendly.', rating: 5, date: daysAgo(6) },
  { source: 'Yelp', author: 'George W.', text: 'Staff attitude was very poor. Made me feel like I was bothering them just by being there. Very disappointing.', rating: 2, date: daysAgo(7) },

  // Reddit
  { source: 'Reddit', author: 'u/frustrated_customer', text: 'Has anyone else noticed that the app keeps crashing after the latest update? I cannot access my account at all. This is a huge problem.', rating: null, date: daysAgo(1) },
  { source: 'Reddit', author: 'u/daily_user_2024', text: 'The wait times for customer service have gotten so much worse recently. Spent 40 minutes on hold yesterday just for a basic question.', rating: null, date: daysAgo(2) },
  { source: 'Reddit', author: 'u/happycustomer99', text: 'Actually had a great experience today! New staff member was super helpful and solved everything quickly. Not all bad!', rating: null, date: daysAgo(3) },
  { source: 'Reddit', author: 'u/billing_nightmare', text: 'Getting charged for services I never signed up for. When you call to dispute, they put you on infinite hold. Class action lawsuit incoming?', rating: null, date: daysAgo(4) },
  { source: 'Reddit', author: 'u/tech_savvy_user', text: 'The app is completely broken on iOS 17. Login screen just freezes. No fix after 2 weeks of reporting this bug.', rating: null, date: daysAgo(5) },

  // Facebook
  { source: 'Facebook', author: 'Maria Johnson', text: 'Love the new improvements! The service has gotten so much better in the last few months. Keep it up!', rating: 5, date: daysAgo(1) },
  { source: 'Facebook', author: 'James Brown', text: 'Absolutely terrible experience. Wait time was over an hour, billing was wrong, and staff was rude. Zero stars if I could.', rating: 1, date: daysAgo(2) },
  { source: 'Facebook', author: 'Catherine Davis', text: 'The customer service team is fantastic! They really listened and helped me figure out my billing issue. Very satisfied.', rating: 5, date: daysAgo(3) },
  { source: 'Facebook', author: 'Ryan Wilson', text: 'App experience is awful. Crashes all the time. Cannot access my account without it freezing. When will this be fixed?', rating: 2, date: daysAgo(4) },

  // ConsumerAffairs
  { source: 'ConsumerAffairs', author: 'Margaret T.', text: 'I was charged three times for the same service and getting a refund has been an absolute nightmare. Going on 6 weeks now.', rating: 1, date: daysAgo(3) },
  { source: 'ConsumerAffairs', author: 'William K.', text: 'Staff are consistently rude and unhelpful. Asked a simple question and was treated like I was being unreasonable.', rating: 1, date: daysAgo(5) },
  { source: 'ConsumerAffairs', author: 'Dorothy R.', text: 'The wait times are outrageous. My elderly mother called for help and was on hold for over an hour. Completely unacceptable.', rating: 1, date: daysAgo(7) },
  { source: 'ConsumerAffairs', author: 'Harold L.', text: 'Service has improved noticeably in the last quarter. My recent experience was positive and efficient.', rating: 4, date: daysAgo(10) },

  // Twitter/X
  { source: 'Twitter/X', author: '@angry_customer_1', text: '@YourBrand your app has been broken for 5 days now!! I cannot access my account and no one is responding to my support tickets!!', rating: null, date: daysAgo(1) },
  { source: 'Twitter/X', author: '@customer_voice', text: '@YourBrand thank you for the quick response! Got my issue resolved within the hour. This is how customer service should work!', rating: null, date: daysAgo(2) },
  { source: 'Twitter/X', author: '@billing_issues', text: '@YourBrand I have been waiting 3 weeks for a billing correction. Every time I call I get a different answer. This is unacceptable.', rating: null, date: daysAgo(3) },
  { source: 'Twitter/X', author: '@longtime_user', text: 'After 5 years with @YourBrand finally thinking of switching. Wait times and app issues have gotten worse every month.', rating: null, date: daysAgo(4) },

  // Older reviews for trend data
  { source: 'Google Maps', author: 'Old Customer 1', text: 'Billing problem last month was very stressful. Took weeks to resolve.', rating: 2, date: daysAgo(20) },
  { source: 'Google Maps', author: 'Old Customer 2', text: 'Great service as always! Staff went above and beyond.', rating: 5, date: daysAgo(18) },
  { source: 'Trustpilot', author: 'Old Customer 3', text: 'App was crashing a lot last month. Seems better now but still concerning.', rating: 2, date: daysAgo(22) },
  { source: 'Trustpilot', author: 'Old Customer 4', text: 'Wait times are getting longer and longer. Used to be 5 minutes, now its 30+.', rating: 2, date: daysAgo(15) },
  { source: 'Yelp', author: 'Old Customer 5', text: 'Really happy with the improvements lately. Billing is accurate and staff are friendlier.', rating: 4, date: daysAgo(25) },
  { source: 'Facebook', author: 'Old Customer 6', text: 'Charged for something I cancelled months ago. Still fighting to get it reversed.', rating: 1, date: daysAgo(12) },
  { source: 'Reddit', author: 'u/old_user_2024', text: 'The customer service quality has really declined over the past few months. Rude staff and long waits.', rating: null, date: daysAgo(14) },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

async function seed() {
  console.log('[Seed] Starting demo data seed...');
  runMigrations();
  const runId = createPipelineRun();

  const { inserted, skipped } = deduplicateAndInsert(SAMPLE_REVIEWS, runId);

  updatePipelineRun(runId, {
    status: 'complete',
    completed_at: new Date().toISOString(),
    total_collected: inserted,
    per_source_counts: SAMPLE_REVIEWS.reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {}),
    scraper_errors: [],
  });

  console.log(`[Seed] Done! Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log('[Seed] Now run: node src/server.js');
  console.log('[Seed] Then in another terminal: POST http://localhost:3001/api/pipeline/run');
  console.log('[Seed] This triggers Claude to analyze all seeded reviews.');
}

seed().catch(e => { console.error('[Seed] Error:', e.message); process.exit(1); });
