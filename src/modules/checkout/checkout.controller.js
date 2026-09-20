'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./checkout.service');

const checkout = catchAsync(async (req, res) => {
  const result = await service.checkout(req, { ...req.body, idempotencyKey: req.headers['idempotency-key'] });
  return success(res, { data: result, message: 'Order placed', statusCode: 201 });
});

module.exports = { checkout };
