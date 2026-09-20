'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const schema = require('./checkout.validation');
const controller = require('./checkout.controller');

const router = express.Router();

/**
 * @openapi
 * /checkout:
 *   post:
 *     tags: [Checkout]
 *     summary: Place an order from the signed-in customer's current cart
 *     description: Idempotent when an Idempotency-Key header is supplied. Computes shipping, tax, coupons/promotions and an optional wallet redemption entirely server-side; reserves stock per line before creating the order.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: Idempotency-Key, schema: { type: string } }
 *     responses:
 *       201: { description: Order placed }
 *       409: { description: An item became unavailable, or the idempotency key was reused with a different payload }
 */
router.post('/', authenticate, validate(schema.checkout), controller.checkout);

module.exports = router;
