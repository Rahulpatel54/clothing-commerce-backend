'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./cart.service');

// A shopper is identified by their bearer token when signed in, otherwise by an
// opaque X-Session-Id header the client generates and keeps for guest checkout.
function context(req) {
  const customerId = req.customerId || null;
  const sessionId = req.headers['x-session-id'] || null;
  return { customerId, sessionId };
}

const getCart = catchAsync(async (req, res) => success(res, { data: await service.getCart(context(req)) }));
const addItem = catchAsync(async (req, res) => success(res, { data: await service.addItem(context(req), req.body), message: 'Item added', statusCode: 201 }));
const updateItem = catchAsync(async (req, res) => success(res, { data: await service.updateItemQuantity(context(req), req.params.variantId, req.body.quantity), message: 'Cart updated' }));
const removeItem = catchAsync(async (req, res) => success(res, { data: await service.removeItem(context(req), req.params.variantId), message: 'Item removed' }));
const clear = catchAsync(async (req, res) => success(res, { data: await service.clear(context(req)), message: 'Cart cleared' }));

module.exports = { getCart, addItem, updateItem, removeItem, clear };
