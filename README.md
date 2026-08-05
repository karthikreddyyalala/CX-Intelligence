# CX Intelligence

An AI-powered customer-experience intelligence platform for Avis car rental. It
collects public reviews from five platforms, analyses every one with AI, and
turns 1,800+ scattered reviews into decisions a Customer Experience team can act
on — **by branch, by employee, and by customer identity.**

Most review dashboards tell you *what* customers said. This one also tells you
*where* they said it, *who* they praised or blamed, and *whether two angry
reviews are secretly the same person.*

---

## What it does

| Module | Question it answers |
|--------|--------------------|
| **Platform Intelligence** | How is the brand doing across Google, Trustpilot, App Store, Play Store, Reddit? |
| **Pain Points** | What are customers actually complaining about, ranked by impact? |
| **Revenue at Risk** | What is poor CX costing us, in dollars? |
| **Location Intelligence** | Which of our 30 branches need help, worst-first? |
| **Branch vs Policy heatmap** | Is a complaint a *local* problem (send someone) or a *company-wide* one (fix the policy)? |
| **People Intelligence** | Which employees do customers praise by name? Which are named in complaints? |
| **Identity Intelligence** | If one angry customer posts under different names on different platforms, can we detect it? |

---

## Identity Intelligence — how it works

The standout feature. Public review sites have no login we can see, so we can
never be *certain* two reviews are the same person. Instead the system gathers
**signals**, scores them, and asks an AI to make the final call — always showing
its evidence.

### Layer 1 — Signal detection (pure code, no AI, instant)

Four independent detectors run over the review corpus:

- **Same incident** — different names, near-identical story. Uses **TF-IDF +
  cosine similarity** (see below).
- **Multi-branch** — one name reviewing several branches within a few days
  (one bad day bouncing a customer between locations).
- **Rating burst** — one name spraying empty star ratings across branches in a
  week with no text: a ratings-inflation campaign, not a customer journey.
- **Cross-platform** — the same name appearing on more than one platform.

### The algorithm — TF-IDF + cosine similarity

**TF-IDF** = *Term Frequency × Inverse Document Frequency.* It is a numerical
statistic that measures how *important* a word is to one review, relative to all
reviews.

- A word like **"the"** appears in almost every review → its weight is ~0. It
  tells us nothing.
- A phrase like **"half-tank fuel rule"** appears in only a couple of reviews →
  its weight is very high. It is highly distinctive.

Each review becomes a vector of these weighted words. We then compute **cosine
similarity** — the angle between two vectors. Angle near 0° → the reviews use
the same distinctive language → probably the same incident. We flag pairs above
28% similarity that *also* share a branch or a date, because similar wording
alone is weak (angry customers reuse phrases) and only becomes meaningful when
combined with shared circumstance.

> TF-IDF is a 50-year-old, industry-standard technique — the same maths behind
> search engines and plagiarism detectors.

### Layer 2 — AI verification (Claude)

Only the strongest clusters are sent to the model, which reads the actual review
text and returns a verdict (`same-person` / `same-incident` / `unrelated` /
`unclear`), a confidence score, and its reasoning. The model is instructed to be
skeptical: a shared complaint *type* is not evidence; a shared specific *detail*
is.

### Layer 3 — Storage

Verdicts are cached in an `identity_verdicts` table keyed by a stable cluster
hash, so the dashboard reads instantly and the model is never asked the same
question twice.

**The result:** three reviews under three different names, on three different
platforms, that mention the same branch, same week, and same unusual detail get
surfaced as *one customer, one incident* — with a confidence score and the
quotes that prove it.

---

## Architecture

```
 Google Maps ─┐
 Trustpilot  ─┤
 App Store   ─┼─► Scrapers (Apify) ─► SQLite ─► AI Analysis (Claude) ─► REST API ─► React dashboard
 Play Store  ─┤                                  (sentiment, themes,
 Reddit      ─┘                                   employees, identity)
```

- **Scraping** — [Apify](https://apify.com) actors for Google Maps, Trustpilot,
  Play Store, Reddit; Apple's free RSS feed for the App Store (no credits).
- **AI** — Anthropic Claude (Haiku) for sentiment, theme tagging, employee-name
  extraction, and identity verification.
- **Everything shown is *counted* from real reviews.** Financial figures use
  assumptions entered in the UI — nothing is invented.

## Tech stack

- **Frontend** — React 18, Vite, Tailwind CSS, Recharts, Lucide icons
- **Backend** — Node.js, Express, better-sqlite3
- **AI** — Anthropic Claude via `@anthropic-ai/sdk`
- **Scraping** — Apify (`apify-client`)

---

## Running locally

**Prerequisites:** Node.js 18+, an Apify token, and an Anthropic API key.

```bash
# 1. Install dependencies (root, backend, frontend via workspaces)
npm install

# 2. Configure secrets
cp .env.example .env
#    then edit .env and paste in your real APIFY_TOKEN and ANTHROPIC_API_KEY

# 3. Start both servers (backend :3001, frontend :5173)
npm run dev
```

Open http://localhost:5173.

### Populating data

The SQLite database is **not** committed (it is git-ignored). To fill it:

```bash
# Scrape fresh reviews from all live sources
node backend/src/scraper.js

# Run AI analysis (sentiment, themes, employee names)
node backend/src/analyzer.js
```

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `APIFY_TOKEN` | Authenticates the Apify review scrapers |
| `ANTHROPIC_API_KEY` | Authenticates Claude for AI analysis |
| `PORT` | Backend port (default `3001`) |

> **Security:** `.env` is git-ignored and must never be committed. In production,
> set these as server environment variables in your host's dashboard, never in
> code.

---

## Project status

Built as an internship project and continuing under active development. Next on
the roadmap: Sprout Social integration (social mentions), competitor
benchmarking (Hertz / Enterprise / Budget), and a weekly email briefing.
