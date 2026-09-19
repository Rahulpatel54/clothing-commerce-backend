'use strict';

const pino = require('pino');
const config = require('./index');

module.exports = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  base: { service: 'commerce-backend', env: config.env },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
});
