'use strict';

const crypto = require('crypto');
const config = require('../../config');
const PaymentProvider = require('./provider.interface');

// A deterministic, offline stand-in for a real gateway (Razorpay/Stripe-shaped).
// Signs webhook payloads with HMAC-SHA256 exactly like a real provider would,
// so payment.service's signature verification path is exercised for real.
class MockPaymentProvider extends PaymentProvider {
  get name() { return 'mock'; }

  async createPayment({ amount, currency, orderId }) {
    const providerPaymentId = `mock_pay_${crypto.randomBytes(8).toString('hex')}`;
    return { providerPaymentId, checkoutUrl: `https://mock-gateway.test/pay/${providerPaymentId}`, raw: { amount, currency, orderId } };
  }

  sign(rawBody) {
    return crypto.createHmac('sha256', config.payments.webhookSecret).update(rawBody).digest('hex');
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const expected = this.sign(rawBody);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  parseWebhookEvent(payload) {
    return { eventId: payload.eventId, providerPaymentId: payload.providerPaymentId, status: payload.status, amount: Number(payload.amount) };
  }

  async refund({ providerPaymentId, amount }) {
    return { providerRefundId: `mock_refund_${crypto.randomBytes(8).toString('hex')}`, raw: { providerPaymentId, amount } };
  }
}

module.exports = new MockPaymentProvider();
