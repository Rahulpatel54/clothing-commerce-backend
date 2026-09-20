'use strict';

/**
 * Payment provider seam. Every concrete adapter (mock, Razorpay, Stripe, ...)
 * implements this shape so payment.service never branches on which gateway is live.
 *
 * Contract:
 *   name                                         -> string
 *   createPayment({ amount, currency, orderId })  -> { providerPaymentId, checkoutUrl? , raw }
 *   verifyWebhookSignature(rawBody, signature)    -> boolean
 *   parseWebhookEvent(payload)                    -> { eventId, providerPaymentId, status, amount }
 *   refund({ providerPaymentId, amount })         -> { providerRefundId, raw }
 */
class PaymentProvider {
  get name() { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async createPayment({ amount, currency, orderId }) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  verifyWebhookSignature(rawBody, signature) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  parseWebhookEvent(payload) { throw new Error('not implemented'); }
  // eslint-disable-next-line no-unused-vars
  async refund({ providerPaymentId, amount }) { throw new Error('not implemented'); }
}

module.exports = PaymentProvider;
