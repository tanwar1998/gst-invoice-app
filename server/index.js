'use strict';

const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`GST invoice API listening on http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
