'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const ApiError = require('../../utils/ApiError');
const customerRepo = require('../customers/customer.repository');
const service = require('./referral.service');

const getMyCode = catchAsync(async (req, res) => {
  const customer = await customerRepo.findByUserId(req.user.id);
  if (!customer) throw ApiError.badRequest('No customer profile for this account');
  const referral = await service.getOrCreateCode(customer.id);
  return success(res, { data: { code: referral.code } });
});

const validate = catchAsync(async (req, res) =>
  success(res, { data: await service.validateAndReward(req.body.refereeUserId, { fraudSignals: req.body.fraudSignals }), message: 'Referral validated' })
);

module.exports = { getMyCode, validate };
