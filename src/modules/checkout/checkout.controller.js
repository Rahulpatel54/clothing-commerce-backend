'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./checkout.service');

const checkout = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /checkout:
   *   post:
   *     tags: [Checkout]
   *     summary: Place an order from the signed-in customer's current cart
   *     description: Idempotent when an Idempotency-Key header is supplied. Computes shipping, tax, coupons/promotions and an optional wallet redemption entirely server-side; reserves stock per line before creating the order, all inside one transaction.
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: header, name: Idempotency-Key, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [addressId]
   *             properties:
   *               addressId: { type: string, format: uuid }
   *               couponCode: { type: string }
   *               useWalletBalance: { type: boolean, default: false }
   *     responses:
   *       201: { description: Order placed }
   *       400: { description: Empty cart, or no customer profile on this account }
   *       404: { description: Shipping address not found }
   *       409: { description: An item became unavailable, or the idempotency key was reused with a different payload }
   */
  const result = await service.checkout(req, { ...req.body, idempotencyKey: req.headers['idempotency-key'] });
  return success(res, { data: result, message: 'Order placed', statusCode: 201 });
});

module.exports = { checkout };
