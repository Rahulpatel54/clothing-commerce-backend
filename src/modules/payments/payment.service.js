'use strict';

const ApiError = require('../../utils/ApiError');
const provider = require('../../integrations/payments');
const repo = require('./payment.repository');
const orderRepo = require('../orders/order.repository');
const orderService = require('../orders/order.service');

const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

// Starts a payment for an order: creates the gateway-side intent and a local
// CREATED row that the webhook will move forward. Refuses a second payment
// attempt while one is already in flight or already captured for this order.
const initiate = async (req, orderId, { method } = {}) => {
  const order = await orderRepo.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentStatus === 'PAID') throw ApiError.conflict('This order has already been paid');

  const existing = await repo.listForOrder(orderId);
  const active = existing.find((p) => ['CREATED', 'AUTHORIZED', 'CAPTURED'].includes(p.status));
  if (active) {
    if (active.status === 'CAPTURED') throw ApiError.conflict('This order has already been paid');
    if (active.status === 'CREATED' && active.providerPaymentId) {
      return {
        paymentId: active.id,
        providerPaymentId: active.providerPaymentId,
        checkoutUrl: (active.rawResponse && active.rawResponse.checkoutUrl) || `https://mock-gateway.test/pay/${active.providerPaymentId}`,
      };
    }
  }

  const { providerPaymentId, checkoutUrl, raw } = await provider.createPayment({ amount: order.totalAmount, currency: 'INR', orderId: order.id });

  const payment = await repo.create({
    orderId: order.id, provider: provider.name, providerPaymentId, amount: order.totalAmount, currency: 'INR', method, status: 'CREATED', rawResponse: raw,
  });

  return { paymentId: payment.id, providerPaymentId, checkoutUrl };
};

/**
 * Webhook entry point. Verifies the signature against the raw body (never the
 * parsed object, so re-serialization can't change the outcome), dedupes by
 * event id so the same delivery applied twice is a no-op, and cross-checks the
 * amount against the order before trusting a CAPTURED status.
 */
const handleWebhook = async (rawBody, signature, payload) => {
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.unauthorized('Invalid webhook signature');
  }

  const event = provider.parseWebhookEvent(payload);

  return repo.transaction(async (t) => {
    const payment = await repo.findByProviderPaymentId(event.providerPaymentId, t);
    if (!payment) throw ApiError.notFound('Unknown payment');

    // Terminal/refunded states must never be mutated by late incoming webhooks
    if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
      return { ok: true, deduped: true };
    }

    if ((payment.processedEvents || []).includes(event.eventId)) {
      if (payment.status === 'CAPTURED') {
        const order = await orderRepo.findById(payment.orderId, t);
        if (order && order.status === 'PENDING') {
          return { ok: true, deduped: true, needsTransition: true };
        }
      }
      return { ok: true, deduped: true };
    }

    // A captured payment cannot be reverted to FAILED by a late/out-of-order failed webhook
    if (payment.status === 'CAPTURED' && event.status === 'failed') {
      await repo.update(payment, { processedEvents: [...(payment.processedEvents || []), event.eventId] }, t);
      return { ok: true, deduped: true };
    }

    const order = await orderRepo.findById(payment.orderId, t);
    if (Math.abs(Number(order.totalAmount) - event.amount) > 0.01) {
      await repo.update(payment, { status: 'FAILED', processedEvents: [...(payment.processedEvents || []), event.eventId] }, t);
      throw ApiError.conflict('Webhook amount does not match the order total');
    }

    const nextStatus = event.status === 'captured' ? 'CAPTURED' : event.status === 'failed' ? 'FAILED' : payment.status;
    await repo.update(payment, { status: nextStatus, processedEvents: [...(payment.processedEvents || []), event.eventId] }, t);

    if (nextStatus === 'CAPTURED') {
      await orderRepo.update(order, { paymentStatus: 'PAID' }, t);
    }

    return { ok: true, status: nextStatus };
  }).then(async (result) => {
    if (result.status === 'CAPTURED' || result.needsTransition) {
      const payment = await repo.findByProviderPaymentId(event.providerPaymentId);
      if (payment) {
        const order = await orderRepo.findById(payment.orderId);
        if (order && order.status === 'PENDING') {
          try {
            await orderService.transition({ user: null }, order.id, 'CONFIRMED', 'Payment captured');
          } catch (err) {
            const logger = require('../../config/logger');
            logger.error({ err, orderId: order.id }, 'Order transition to CONFIRMED on payment capture failed');
          }
        }
      }
    }
    return result;
  });
};

const refund = async (req, paymentId, { amount, reason }) => {
  return repo.transaction(async (t) => {
    const payment = await repo.findByIdForUpdate(paymentId, t);
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status !== 'CAPTURED' && payment.status !== 'PARTIALLY_REFUNDED') throw ApiError.conflict('Only a captured payment can be refunded');

    const alreadyRefunded = await totalRefunded(paymentId, t);
    const refundAmount = amount != null ? Number(amount) : round2(Number(payment.amount) - alreadyRefunded);
    if (refundAmount <= 0 || round2(alreadyRefunded + refundAmount) > round2(payment.amount)) {
      throw ApiError.badRequest('Refund amount exceeds the amount available to refund');
    }

    const { providerRefundId } = await provider.refund({ providerPaymentId: payment.providerPaymentId, amount: refundAmount });
    const refundRow = await repo.createRefund({ paymentId, amount: refundAmount, reason, status: 'COMPLETED', providerRefundId, actorUserId: req.user && req.user.id }, t);

    const nowRefunded = round2(alreadyRefunded + refundAmount);
    const paymentStatus = nowRefunded >= round2(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await repo.update(payment, { status: paymentStatus }, t);

    const order = await orderRepo.findById(payment.orderId, t);
    const orderUpdates = { paymentStatus: paymentStatus === 'REFUNDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED' };
    if (paymentStatus === 'REFUNDED' && order && order.status === 'RETURNED') {
      orderUpdates.status = 'REFUNDED';
    }
    await orderRepo.update(order, orderUpdates, t);

    return refundRow;
  });
};

async function totalRefunded(paymentId, transaction) {
  if (typeof repo.listRefundsForPayment === 'function') {
    const res = await repo.listRefundsForPayment(paymentId, transaction);
    if (Array.isArray(res)) {
      return res.reduce((sum, r) => sum + Number(r.amount), 0);
    }
  }
  const db = require('../../models');
  if (db && db.Refund && typeof db.Refund.findAll === 'function') {
    const rows = await db.Refund.findAll({ where: { paymentId, status: 'COMPLETED' }, transaction });
    return (rows || []).reduce((sum, r) => sum + Number(r.amount), 0);
  }
  return 0;
}

module.exports = { initiate, handleWebhook, refund };
