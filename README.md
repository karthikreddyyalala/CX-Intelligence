# CX Intelligence Dashboard

**Live demo:** https://cx-dashboard-backend-production.up.railway.app

---

## What this is

During my AI Enablement internship at Avis Budget Group, I thought it would be useful to show the team what we could do with the public customer feedback that already exists across Google, Trustpilot, the App Store, and Reddit. Customers are writing detailed reviews on these platforms every day and I wanted to explore how we could turn that into something actionable for the CX team.

So I built this as a personal initiative to show a concrete example of what that could look like.

This is a proof-of-concept dashboard that collects public reviews from five platforms, runs them through AI analysis, and turns 1,600+ scattered reviews into something a CX team can actually act on. It answers questions like: which branch is getting the worst reviews, which employees are customers praising by name, and which complaints are likely to turn into chargebacks.

The data is real. Every number you see is counted from actual customer reviews scraped from public sources. Nothing is estimated or made up.

---

## What it shows

**Executive Pulse**
A single view of brand health across all five platforms: Google Maps, Trustpilot, App Store, Google Play, and Reddit. Sentiment breakdown, total review count, and the newest review date.

**Dispute Radar**
This is the part I am most proud of. I built a detector that reads the text of every complaint and finds the ones where a customer named a specific dollar amount they are disputing. It then scores each one by how likely it is to escalate into a chargeback, a BBB case, or legal action, using signals like whether the customer mentioned "Chase Bank", "lawsuit", or "filing a dispute". The result is a ranked worklist of 63 complaints totaling $20,513 in disputed charges, sorted from most critical to least. Some of those reviews even include the customer's booking reference number, which means any analyst with system access could look that rental up immediately and call the customer before the chargeback hits.

**Pain Points**
The recurring complaints ranked by how negative and how frequent they are. This is your fix-first list.

**Revenue at Risk**
A calculator that translates complaint volume into dollars. The logic comes from a well-known consumer affairs statistic: for every customer who complains, roughly 26 others have the same experience and say nothing. You enter your own assumption for what a customer is worth and every figure updates.

**Location Intelligence**
All 30 branches ranked worst-first by their review scores. You can click any branch and see the exact complaints behind its score.

**People Intelligence**
Customers often name specific employees in their reviews, both in praise and in complaints. This section surfaces the staff who are getting called out by name for great service.

**Identity Intelligence**
One angry customer can post on every platform under a different name and make one bad experience look like four separate complaints. This feature detects likely duplicates using TF-IDF and cosine similarity to find reviews that describe the same incident in the same language, then asks Claude to verify the match and explain its reasoning. It keeps the numbers honest.

**Ask Anything**
A plain-English interface where you can type any question about the reviews and Claude answers from the actual data with quotes.

---

## How it works technically

```
Google Maps
Trustpilot
App Store    -->  Apify scrapers  -->  SQLite  -->  Claude AI analysis  -->  REST API  -->  React dashboard
Google Play
Reddit
```

Each review goes through Claude for sentiment scoring, theme tagging, and employee name extraction. The identity resolution layer runs TF-IDF cosine similarity across the full corpus and passes the strongest clusters to Claude for a final verdict.

**Tech stack:**

- Frontend: React 18, Vite, Tailwind CSS, Recharts, Lucide icons
- Backend: Node.js, Express, better-sqlite3
- AI: Anthropic Claude via the official SDK
- Scraping: Apify actors for Google Maps, Trustpilot, Play Store, and Reddit. Apple App Store uses the free RSS feed.

---

## Running it locally

You need Node.js 18+, an Apify token, and an Anthropic API key.

```bash
npm install

cp .env.example .env
# Add your APIFY_TOKEN and ANTHROPIC_API_KEY to the .env file

npm run dev
```

Open http://localhost:5173.

The SQLite database is not committed to git. To fill it with data:

```bash
node backend/src/scraper.js
node backend/src/analyzer.js
```

---

## Why I built this

I wanted to show that the information a company needs to fix its customer experience problems is almost always already public. Customers are writing it out in detail, with booking references and dollar amounts, on platforms the company owns accounts on. The gap is not data, it is a system that reads it.

This is a POC built to prove that point. The analysis is real, the reviews are real, and the disputes are real. It is not connected to any internal Avis system and was built entirely with public data and my own time.

---

## Environment variables

| Variable | Purpose |
|---|---|
| APIFY_TOKEN | Authenticates the Apify review scrapers |
| ANTHROPIC_API_KEY | Authenticates Claude for AI analysis |
| PORT | Backend port, defaults to 3001 |

The .env file is git-ignored and must never be committed.
