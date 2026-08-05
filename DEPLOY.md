# Deploying CX Intelligence

The app is built to run as **one service**: the Node/Express backend serves the
API *and* the built React app, so there is a single URL to share. The demo
database ships with the repo, so the live site has data immediately.

## Deploy to Railway (recommended, ~10 minutes)

### 1. Create the project
1. Go to <https://railway.app> and sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → select
   `karthikreddyyalala/CX-Intelligence`.
3. Railway reads `railway.json` and runs:
   - **Build:** `npm install --include=dev && npm run build`
   - **Start:** `npm start`

### 2. Set environment variables
In the service's **Variables** tab, add:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `APIFY_TOKEN` | your Apify token |

> Do **not** set `NODE_ENV=production` — it would skip the dev dependencies
> (Vite) needed to build the frontend. `railway.json` already forces a correct
> install, but leaving `NODE_ENV` unset is the safe default.
>
> You do **not** need to set `PORT`. Railway assigns it and the server binds to
> it automatically.

### 3. Get the public URL
**Settings → Networking → Generate Domain.** Railway gives you something like
`https://cx-intelligence-production.up.railway.app`. That single link is the
whole dashboard — share it.

## What the keys are for

- The dashboard **reads** the shipped database with no keys at all.
- The keys are only needed if someone clicks **Run AI Analysis** / re-scrapes,
  which regenerates data live. For a pure demo they are optional, but set them
  so every button works.

## Redeploying

Push to `main` and Railway redeploys automatically. The shipped database is part
of each deploy; if you refresh the data locally
(`node backend/src/scraper.js && node backend/src/analyzer.js`), commit the
updated `backend/data/cx_dashboard.db` to publish it.

## Notes

- **Never commit `.env`.** It is git-ignored. Secrets live only in the host's
  Variables tab.
- The database lives in the deployed image. Runtime writes (e.g. a re-scrape)
  persist until the next deploy. For durable writable storage, attach a Railway
  volume and set `DB_PATH` to a file inside it.
