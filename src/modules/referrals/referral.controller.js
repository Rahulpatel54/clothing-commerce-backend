'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const customerRepo = require('../customers/customer.repository');
const service = require('./referral.service');

const getMyCode = catchAsync(async (req, res) => {
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
  const customer = await customerRepo.findByUserId(req.user.id);
  if (!customer) throw ApiError.badRequest('No customer profile for this account');
  const referral = await service.getOrCreateCode(customer.id);
  return success(res, { data: { code: referral.code } });
});

const validate = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /referrals/validate:
   *   post:
   *     tags: [Referrals]
   *     summary: Validate a referral and issue the reward once eligible (staff/system)
   *     description: Requires the referee's order to be DELIVERED and the configured return window to have fully elapsed with no cancellation. Runs the fraud signals through a pluggable evaluator before crediting the referrer's wallet.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refereeUserId]
   *             properties:
   *               refereeUserId: { type: string, format: uuid }
   *               fraudSignals: { type: object, description: "e.g. { ipReused, phoneReused, deviceReused, addressReused, referralVelocity24h, accountAgeDays, priorCancellationRate, priorReturnRate }" }
   *     responses:
   *       200: { description: Referral validated and rewarded }
   *       400: { description: This user was not referred }
   *       409: { description: Not yet eligible, already rewarded, cancelled, or flagged for review }
   */
  return success(res, { data: await service.validateAndReward(req.body.refereeUserId, { fraudSignals: req.body.fraudSignals }), message: 'Referral validated' });
});

module.exports = { getMyCode, validate };
