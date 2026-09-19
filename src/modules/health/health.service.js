'use strict';

const { sequelize } = require('../../config/sequelize');
const config = require('../../config');

async function readiness() {
  const checks = { database: 'unknown', redis: config.redis.enabled ? 'unknown' : 'disabled' };

  try {
    await sequelize.authenticate();
    checks.database = 'ok';
  } catch (err) {
    checks.database = 'down';
  }

  const degraded = Object.values(checks).includes('down');
  return {
    status: degraded ? 'degraded' : 'ok',
    version: require('../../../package.json').version,
    env: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    checks,
  };
}

module.exports = { readiness };
