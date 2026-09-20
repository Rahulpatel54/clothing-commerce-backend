'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./payment.service');

const initiate = catchAsync(async (req, res) => success(res, { data: await service.initiate(req, req.params.orderId, req.body), message: 'Payment initiated', statusCode: 201 }));

const webhook = catchAsync(async (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const result = await service.handleWebhook(req.rawBody, signature, req.body);
  return success(res, { data: result });
});

const refund = catchAsync(async (req, res) => success(res, { data: await service.refund(req, req.params.paymentId, req.body), message: 'Refund processed' }));

module.exports = { initiate, webhook, refund };
