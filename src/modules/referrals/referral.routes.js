'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./referral.validation');
const controller = require('./referral.controller');

const router = express.Router();
router.use(authenticate);

/**
 * @openapi
 * /referrals/me:
 *   get:
 *     tags: [Referrals]
 *     summary: The signed-in customer's own referral code (created on first request)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Referral code }
 */
router.get('/me', controller.getMyCode);

/**
 * @openapi
 * /referrals/validate:
 *   post:
 *     tags: [Referrals]
 *     summary: Validate a referral and issue the reward once eligible (staff/system)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Referral validated and rewarded }
 *       409: { description: Not yet eligible, already rewarded, or flagged for review }
 */
router.post('/validate', authorize('referrals:update'), validate(schema.validate), controller.validate);

module.exports = router;
