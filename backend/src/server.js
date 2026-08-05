'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const { runMigrations } = require('./db');

// Routes
const reviewsRouter = require('./routes/reviews');
const insightsRouter = require('./routes/insights');
const pipelineRouter = require('./routes/pipeline');
const exportRouter = require('./routes/export');

const app = express();
// Hardcoded: the dev-server harness injects a PORT env var for the frontend's
// port (5173), which would otherwise collide since concurrently shares env
// between the backend and frontend child processes.
const PORT = 3001;

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
