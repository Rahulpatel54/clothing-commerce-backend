'use strict';

jest.mock('../src/modules/payments/payment.repository');
jest.mock('../src/modules/orders/order.repository');
jest.mock('../src/modules/orders/order.service');
jest.mock('../src/integrations/payments', () => ({
  name: 'mock',
  createPayment: jest.fn(),
  verifyWebhookSignature: jest.fn(),
  parseWebhookEvent: jest.fn(),
  refund: jest.fn(),
}));

const repo = require('../src/modules/payments/payment.repository');
const orderRepo = require('../src/modules/orders/order.repository');
const orderService = require('../src/modules/orders/order.service');
const provider = require('../src/integrations/payments');
const service = require('../src/modules/payments/payment.service');

const REQ = { user: { id: 'staff-1' } };

function order(overrides = {}) {
  return { id: 'order-1', totalAmount: '1000.00', status: 'PENDING', paymentStatus: 'UNPAID', ...overrides };
}
function payment(overrides = {}) {
  return { id: 'pay-1', orderId: 'order-1', amount: '1000.00', status: 'CREATED', providerPaymentId: 'mock_pay_1', processedEvents: [], ...overrides };
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.listForOrder.mockResolvedValue([]);
});

describe('initiate', () => {
  it('creates a payment intent for an unpaid order', async () => {
    orderRepo.findById.mockResolvedValue(order());
    provider.createPayment.mockResolvedValue({ providerPaymentId: 'mock_pay_1', checkoutUrl: 'https://x', raw: {} });
    repo.create.mockResolvedValue({ id: 'pay-1' });

    const result = await service.initiate(REQ, 'order-1', { method: 'upi' });
    expect(result.paymentId).toBe('pay-1');
  });

  it('refuses to initiate a second payment for an already-paid order', async () => {
    orderRepo.findById.mockResolvedValue(order({ paymentStatus: 'PAID' }));
    await expect(service.initiate(REQ, 'order-1', {})).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses when a payment is already captured for this order', async () => {
    orderRepo.findById.mockResolvedValue(order());
    repo.listForOrder.mockResolvedValue([payment({ status: 'CAPTURED' })]);
    await expect(service.initiate(REQ, 'order-1', {})).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('webhook handling', () => {
  it('rejects a forged signature', async () => {
    provider.verifyWebhookSignature.mockReturnValue(false);
    await expect(service.handleWebhook('{}', 'bad-sig', {})).rejects.toMatchObject({ statusCode: 401 });
  });

  it('captures the payment and confirms the order when amounts match', async () => {
    provider.verifyWebhookSignature.mockReturnValue(true);
    provider.parseWebhookEvent.mockReturnValue({ eventId: 'evt-1', providerPaymentId: 'mock_pay_1', status: 'captured', amount: 1000 });
    repo.findByProviderPaymentId.mockResolvedValue(payment());
    orderRepo.findById.mockResolvedValue(order());
    orderService.transition.mockResolvedValue({});

    const result = await service.handleWebhook('raw', 'sig', { eventId: 'evt-1' });

    expect(result.status).toBe('CAPTURED');
    expect(orderRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-1' }), { paymentStatus: 'PAID' }, 'tx');
    expect(orderService.transition).toHaveBeenCalledWith(expect.anything(), 'order-1', 'CONFIRMED', 'Payment captured');
  });

  it('dedupes a webhook event delivered twice', async () => {
    provider.verifyWebhookSignature.mockReturnValue(true);
    provider.parseWebhookEvent.mockReturnValue({ eventId: 'evt-1', providerPaymentId: 'mock_pay_1', status: 'captured', amount: 1000 });
    repo.findByProviderPaymentId.mockResolvedValue(payment({ processedEvents: ['evt-1'], status: 'CAPTURED' }));

    const result = await service.handleWebhook('raw', 'sig', { eventId: 'evt-1' });
    expect(result.deduped).toBe(true);
    expect(orderRepo.update).not.toHaveBeenCalled();
  });

  it('fails the payment when the webhook amount does not match the order', async () => {
    provider.verifyWebhookSignature.mockReturnValue(true);
    provider.parseWebhookEvent.mockReturnValue({ eventId: 'evt-2', providerPaymentId: 'mock_pay_1', status: 'captured', amount: 50 });
    repo.findByProviderPaymentId.mockResolvedValue(payment());
    orderRepo.findById.mockResolvedValue(order());

    await expect(service.handleWebhook('raw', 'sig', { eventId: 'evt-2' })).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'pay-1' }), expect.objectContaining({ status: 'FAILED' }), 'tx');
  });

  it('404s an unknown provider payment id', async () => {
    provider.verifyWebhookSignature.mockReturnValue(true);
    provider.parseWebhookEvent.mockReturnValue({ eventId: 'evt-3', providerPaymentId: 'ghost', status: 'captured', amount: 1000 });
    repo.findByProviderPaymentId.mockResolvedValue(null);
    await expect(service.handleWebhook('raw', 'sig', { eventId: 'evt-3' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('refund', () => {
  it('refunds a captured payment in full by default', async () => {
    repo.findByIdForUpdate.mockResolvedValue(payment({ status: 'CAPTURED' }));
    const dbMock = require('../src/models');
    dbMock.Refund = { findAll: jest.fn().mockResolvedValue([]) };
    provider.refund.mockResolvedValue({ providerRefundId: 'mock_refund_1' });
    repo.createRefund.mockResolvedValue({ id: 'refund-1', amount: 1000 });
    orderRepo.findById.mockResolvedValue(order());

    const result = await service.refund(REQ, 'pay-1', {});
    expect(result.id).toBe('refund-1');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'pay-1' }), { status: 'REFUNDED' }, 'tx');
  });

  it('refuses to refund a payment that was never captured', async () => {
    repo.findByIdForUpdate.mockResolvedValue(payment({ status: 'CREATED' }));
    await expect(service.refund(REQ, 'pay-1', {})).rejects.toMatchObject({ statusCode: 409 });
  });
});
