'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./payment.validation');
const controller = require('./payment.controller');

const router = express.Router();

/**
 * @openapi
 * /payments/orders/{orderId}/initiate:
 *   post:
 *     tags: [Payments]
 *     summary: Start a payment for an order
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       201: { description: Payment initiated }
 *       409: { description: Order already paid or has a payment in flight }
 */
router.post('/orders/:orderId/initiate', authenticate, validate(schema.initiate), controller.initiate);

/**
 * @openapi
 * /payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Provider webhook (signature-verified, replay-safe, idempotent)
 *     responses:
 *       200: { description: Event processed (or deduped as an already-seen replay) }
 *       401: { description: Invalid signature }
 */
router.post('/webhook', controller.webhook);

/**
 * @openapi
 * /payments/{paymentId}/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Refund a captured payment, in full or in part (staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: paymentId, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Refund processed }
 */
router.post('/:paymentId/refund', authenticate, authorize('payments:update'), validate(schema.refund), controller.refund);

module.exports = router;
