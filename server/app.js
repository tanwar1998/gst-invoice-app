'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const api = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

// In production the built React app is served by the same Express process.
const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  res.status(500).json({ error: 'Unexpected server error.' });
});

module.exports = app;
