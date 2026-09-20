'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rateLimiter');
const schema = require('./auth.validation');
const controller = require('./auth.controller');

const router = express.Router();

router.post('/register', authLimiter, validate(schema.register), controller.register);
router.post('/login', authLimiter, validate(schema.login), controller.login);
router.post('/refresh', validate(schema.refresh), controller.refresh);
router.post('/logout', validate(schema.logout), controller.logout);
router.post('/password/reset-request', authLimiter, validate(schema.requestPasswordReset), controller.requestPasswordReset);
router.post('/password/reset', authLimiter, validate(schema.confirmPasswordReset), controller.confirmPasswordReset);
router.get('/me', authenticate, controller.me);

module.exports = router;
