'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const { runMigrations } = require('./db');

// Routes
const reviewsRouter = require('./routes/reviews');
const insightsRouter = require('./routes/insights');
const pipelineRouter = require('./routes/pipeline');
const exportRouter = require('./routes/export');

const app = express();
// The local dev harness shares env between the backend and frontend child
// processes and injects PORT=5173 (the frontend's port); binding the backend to
// that would collide. So ignore that one specific value, but honour any other
// PORT — which is how hosts like Railway tell us the port to bind in production.
const envPort = parseInt(process.env.PORT, 10);
const PORT = envPort && envPort !== 5173 ? envPort : 3001;

app.use(cors());
app.use(express.json());

// Run DB migrations on startup
runMigrations();

// Mount routes
app.use('/api/reviews', reviewsRouter);
app.use('/api', insightsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/export', exportRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production the same service serves the built React app. When frontend/dist
// exists (created by `npm run build`), serve it and fall back to index.html for
// client-side routes. In local dev the dist folder is absent and Vite serves the
// frontend on :5173, so this block is simply skipped.
const distDir = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
  console.log('[server] Serving built frontend from frontend/dist');
}

app.listen(PORT, () => {
  console.log(`\n🚀  CX Dashboard API running at http://localhost:${PORT}`);
  console.log(`   GET  /api/health`);
  console.log(`   GET  /api/reviews`);
  console.log(`   GET  /api/stats`);
  console.log(`   GET  /api/pain-points`);
  console.log(`   GET  /api/insight-summary`);
  console.log(`   GET  /api/source-ratings`);
  console.log(`   POST /api/pipeline/run`);
  console.log(`   GET  /api/pipeline/status`);
  console.log(`   GET  /api/export/csv\n`);
});

module.exports = app;
