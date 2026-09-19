'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { sequelize, connect } = require('./config/sequelize');

let server;

async function start() {
  await connect();
  logger.info('Database connection established');

  server = app.listen(config.port, () => {
    logger.info(`API listening on port ${config.port} (${config.env})`);
    logger.info(`Docs available at http://localhost:${config.port}/docs`);
  });
}

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
  process.exit(0);
}

['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
