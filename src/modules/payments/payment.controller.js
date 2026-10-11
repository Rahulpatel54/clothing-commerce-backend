'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./payment.service');

const initiate = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /payments/orders/{orderId}/initiate:
   *   post:
   *     tags: [Payments]
   *     summary: Start a payment for an order
   *     description: Creates a gateway-side payment intent via the configured provider (mock by default) and a local CREATED row that the webhook will move forward.
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema: { type: object, properties: { method: { type: string, example: upi } } }
   *     responses:
   *       201: { description: Payment initiated }
   *       409: { description: Order already paid or has a payment in flight }
   */
  return success(res, { data: await service.initiate(req, req.params.orderId, req.body), message: 'Payment initiated', statusCode: 201 });
});

const webhook = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /payments/webhook:
   *   post:
   *     tags: [Payments]
   *     summary: Provider webhook (signature-verified, replay-safe, idempotent)
   *     description: Verifies X-Webhook-Signature against the raw request body, dedupes by the provider's event id, and cross-checks the amount against the order before trusting a captured status.
   *     parameters: [{ in: header, name: X-Webhook-Signature, required: true, schema: { type: string } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties: { eventId: { type: string }, providerPaymentId: { type: string }, status: { type: string, enum: [captured, failed] }, amount: { type: number } }
   *     responses:
   *       200: { description: Event processed (or deduped as an already-seen replay) }
   *       401: { description: Invalid signature }
   *       404: { description: Unknown provider payment id }
   *       409: { description: Amount does not match the order total }
   */
  const signature = req.headers['x-webhook-signature'];
  const result = await service.handleWebhook(req.rawBody, signature, req.body);
  return success(res, { data: result });
});

const refund = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /payments/{paymentId}/refund:
   *   post:
   *     tags: [Payments]
   *     summary: Refund a captured payment, in full or in part (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: paymentId, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               amount: { type: number, description: "Omit for a full refund of whatever remains uncaptured" }
   *               reason: { type: string }
   *     responses:
   *       200: { description: Refund processed }
   *       409: { description: Only a captured (or partially refunded) payment can be refunded }
   */
  return success(res, { data: await service.refund(req, req.params.paymentId, req.body), message: 'Refund processed' });
});

module.exports = { initiate, webhook, refund };
