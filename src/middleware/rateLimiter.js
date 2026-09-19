'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const build = (options = {}) =>
  rateLimit({
    windowMs: config.security.rateLimit.windowMs,
    max: config.security.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (req, res) =>
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
        requestId: req.id,
      }),
    ...options,
  });

module.exports = {
  globalLimiter: build(),
  // Stricter bucket for login / password reset / OTP, used from the auth phase onward.
  authLimiter: build({ windowMs: 15 * 60 * 1000, max: 10 }),
};
