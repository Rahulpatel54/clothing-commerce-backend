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

const getCart = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /cart:
   *   get:
   *     tags: [Cart]
   *     summary: Get the current cart (guest via X-Session-Id, or the signed-in customer)
   *     parameters: [{ in: header, name: X-Session-Id, schema: { type: string } }]
   *     responses:
   *       200: { description: Cart with server-recomputed totals }
   */
  return success(res, { data: await service.getCart(context(req)) });
});

const addItem = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /cart/items:
   *   post:
   *     tags: [Cart]
   *     summary: Add a variant to the cart, or increase its quantity
   *     parameters: [{ in: header, name: X-Session-Id, schema: { type: string } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [variantId]
   *             properties: { variantId: { type: string, format: uuid }, quantity: { type: integer, minimum: 1, maximum: 50, default: 1 } }
   *     responses:
   *       201: { description: Item added }
   *       409: { description: Not enough stock available }
   */
  return success(res, { data: await service.addItem(context(req), req.body), message: 'Item added', statusCode: 201 });
});

const updateItem = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /cart/items/{variantId}:
   *   patch:
   *     tags: [Cart]
   *     summary: Set the exact quantity for a line item (0 removes it)
   *     parameters:
   *       - { in: path, name: variantId, required: true, schema: { type: string, format: uuid } }
   *       - { in: header, name: X-Session-Id, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object, required: [quantity], properties: { quantity: { type: integer, minimum: 0, maximum: 50 } } }
   *     responses:
   *       200: { description: Cart updated }
   *       404: { description: Item not in cart }
   */
  return success(res, { data: await service.updateItemQuantity(context(req), req.params.variantId, req.body.quantity), message: 'Cart updated' });
});

const removeItem = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /cart/items/{variantId}:
   *   delete:
   *     tags: [Cart]
   *     summary: Remove a line item
   *     parameters:
   *       - { in: path, name: variantId, required: true, schema: { type: string, format: uuid } }
   *       - { in: header, name: X-Session-Id, schema: { type: string } }
   *     responses:
   *       200: { description: Item removed }
   */
  return success(res, { data: await service.removeItem(context(req), req.params.variantId), message: 'Item removed' });
});

const clear = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /cart:
   *   delete:
   *     tags: [Cart]
   *     summary: Empty the cart
   *     parameters: [{ in: header, name: X-Session-Id, schema: { type: string } }]
   *     responses:
   *       200: { description: Cart cleared }
   */
  return success(res, { data: await service.clear(context(req)), message: 'Cart cleared' });
});

module.exports = { getCart, addItem, updateItem, removeItem, clear };
