'use strict';

const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const config = require('../src/config');
const mockProvider = require('../src/integrations/payments/mock.adapter');
const paymentService = require('../src/modules/payments/payment.service');
const repo = require('../src/modules/payments/payment.repository');
const orderRepo = require('../src/modules/orders/order.repository');
const orderService = require('../src/modules/orders/order.service');
const inventoryService = require('../src/modules/inventory/inventory.service');
const tokens = require('../src/modules/auth/token.service');
const authRepo = require('../src/modules/auth/auth.repository');

// Mocks for unit/integration isolation
jest.mock('../src/modules/auth/auth.repository');
jest.mock('../src/modules/users/rbac.service');
jest.mock('../src/modules/payments/payment.repository');
jest.mock('../src/modules/orders/order.repository');
jest.mock('../src/modules/orders/order.service');
jest.mock('../src/modules/inventory/inventory.service');

describe('Payment, Webhook & Refund Security and Logic Audit', () => {
  const staffToken = tokens.signAccessToken({
    id: 'staff-uuid-1',
    email: 'staff@example.com',
    roles: ['admin'],
    permissions: ['payments:update', 'orders:read'],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const rbac = require('../src/modules/users/rbac.service');
    rbac.permissionsFor.mockResolvedValue(new Set(['*']));
    authRepo.findUserById.mockResolvedValue({
      id: 'staff-uuid-1',
      email: 'staff@example.com',
      status: 'ACTIVE',
    });
    repo.transaction.mockImplementation(async (fn) => fn('mock-tx'));
    repo.listForOrder.mockResolvedValue([]);
  });

  describe('1. Webhook Signature Tampering & Raw Body Handling', () => {
    it('1.1 Rejects webhook with missing signature header with 401', async () => {
      const payload = { eventId: 'evt-1', providerPaymentId: 'pay-1', status: 'captured', amount: 100 };
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Invalid webhook signature/i);
    });

    it('1.2 Rejects webhook with forged/tampered signature header with 401', async () => {
      const payload = { eventId: 'evt-1', providerPaymentId: 'pay-1', status: 'captured', amount: 100 };
      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-webhook-signature', '0000000000000000000000000000000000000000000000000000000000000000')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toMatch(/Invalid webhook signature/i);
    });

    it('1.3 Handles undefined/non-string rawBody defensively in signature check', () => {
      expect(mockProvider.verifyWebhookSignature(undefined, 'some-signature')).toBe(false);
      expect(mockProvider.verifyWebhookSignature('', 'some-signature')).toBe(false);
      expect(mockProvider.verifyWebhookSignature(null, 'some-signature')).toBe(false);
    });
  });

  describe('2. Webhook Idempotency, Replay & State Machine Overwrite Hardening', () => {
    it('2.1 Properly dedupes replay of exact same webhook event', async () => {
      const payload = { eventId: 'evt-dedupe-1', providerPaymentId: 'mock_pay_1', status: 'captured', amount: 100 };
      const rawBody = JSON.stringify(payload);
      const signature = mockProvider.sign(rawBody);

      repo.findByProviderPaymentId.mockResolvedValue({
        id: 'p1',
        orderId: 'o1',
        status: 'CAPTURED',
        processedEvents: ['evt-dedupe-1'],
      });

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-webhook-signature', signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.data.deduped).toBe(true);
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('2.2 Hardened: Late "captured" webhook event does NOT overwrite a REFUNDED payment or order', async () => {
      const payload = { eventId: 'evt-late-capture', providerPaymentId: 'mock_pay_refunded', status: 'captured', amount: 100 };
      const rawBody = JSON.stringify(payload);
      const signature = mockProvider.sign(rawBody);

      const refundedPayment = {
        id: 'p-refunded',
        orderId: 'o-refunded',
        amount: '100.00',
        status: 'REFUNDED',
        processedEvents: ['evt-old'],
      };

      const orderRow = { id: 'o-refunded', totalAmount: '100.00', status: 'RETURNED', paymentStatus: 'REFUNDED' };

      repo.findByProviderPaymentId.mockResolvedValue(refundedPayment);
      orderRepo.findById.mockResolvedValue(orderRow);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-webhook-signature', signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.data.deduped).toBe(true);
      // Payment status must NOT be reverted back to CAPTURED
      expect(repo.update).not.toHaveBeenCalledWith(
        refundedPayment,
        expect.objectContaining({ status: 'CAPTURED' }),
        'mock-tx'
      );
      // Order paymentStatus must NOT be reverted back to PAID
      expect(orderRepo.update).not.toHaveBeenCalled();
    });

    it('2.3 Hardened: Late "failed" webhook event does NOT overwrite a CAPTURED payment', async () => {
      const payload = { eventId: 'evt-late-fail', providerPaymentId: 'mock_pay_captured', status: 'failed', amount: 100 };
      const rawBody = JSON.stringify(payload);
      const signature = mockProvider.sign(rawBody);

      const capturedPayment = {
        id: 'p-captured',
        orderId: 'o-captured',
        amount: '100.00',
        status: 'CAPTURED',
        processedEvents: ['evt-initial'],
      };

      const orderRow = { id: 'o-captured', totalAmount: '100.00', status: 'CONFIRMED', paymentStatus: 'PAID' };

      repo.findByProviderPaymentId.mockResolvedValue(capturedPayment);
      orderRepo.findById.mockResolvedValue(orderRow);

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-webhook-signature', signature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.data.deduped).toBe(true);
      // Payment status must NOT be reverted to FAILED
      expect(repo.update).not.toHaveBeenCalledWith(
        capturedPayment,
        expect.objectContaining({ status: 'FAILED' }),
        'mock-tx'
      );
    });
  });

  describe('3. Partial Refund & Over-Refund Guarding', () => {
    const validPaymentId = '11111111-1111-4111-8111-111111111111';

    it('3.1 Hardened: Over-refund by +0.01 is strictly blocked with 400', async () => {
      const capturedPayment = {
        id: validPaymentId,
        orderId: 'order-100',
        amount: '100.00',
        status: 'CAPTURED',
        providerPaymentId: 'mock_100',
      };
      repo.findByIdForUpdate.mockResolvedValue(capturedPayment);
      repo.listRefundsForPayment.mockResolvedValue([]);
      orderRepo.findById.mockResolvedValue({ id: 'order-100', totalAmount: '100.00' });

      // Requesting 100.01 on a 100.00 payment
      const res = await request(app)
        .post(`/api/v1/payments/${validPaymentId}/refund`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ amount: 100.01, reason: 'Over-refund test' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Refund amount exceeds the amount available to refund/i);
      expect(repo.createRefund).not.toHaveBeenCalled();
    });

    it('3.2 Rejects refund when requested amount exceeds available (e.g. $60 + $50 > $100)', async () => {
      const capturedPayment = {
        id: validPaymentId,
        orderId: 'order-100',
        amount: '100.00',
        status: 'PARTIALLY_REFUNDED',
        providerPaymentId: 'mock_100',
      };
      repo.findByIdForUpdate.mockResolvedValue(capturedPayment);
      repo.listRefundsForPayment.mockResolvedValue([{ amount: 60.00, status: 'COMPLETED' }]);

      // Attempt refund of $50 ($60 + $50 = $110 > $100)
      const res = await request(app)
        .post(`/api/v1/payments/${validPaymentId}/refund`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ amount: 50.00, reason: 'Excess refund' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/Refund amount exceeds the amount available to refund/i);
    });

    it('3.3 Hardened: Order status transitions to REFUNDED upon full refund of a RETURNED order', async () => {
      const capturedPayment = {
        id: validPaymentId,
        orderId: 'order-100',
        amount: '100.00',
        status: 'CAPTURED',
        providerPaymentId: 'mock_100',
      };
      const orderRow = { id: 'order-100', totalAmount: '100.00', status: 'RETURNED', paymentStatus: 'PAID' };

      repo.findByIdForUpdate.mockResolvedValue(capturedPayment);
      repo.listRefundsForPayment.mockResolvedValue([]);
      repo.createRefund.mockResolvedValue({ id: 'ref-full', amount: 100.00, status: 'COMPLETED' });
      orderRepo.findById.mockResolvedValue(orderRow);

      const res = await request(app)
        .post(`/api/v1/payments/${validPaymentId}/refund`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ amount: 100.00 });

      expect(res.status).toBe(200);
      expect(orderRepo.update).toHaveBeenCalledWith(
        orderRow,
        expect.objectContaining({ status: 'REFUNDED', paymentStatus: 'REFUNDED' }),
        'mock-tx'
      );
    });

    it('3.4 Hardened: In-flight payment reuses active CREATED payment instead of creating duplicate', async () => {
      orderRepo.findById.mockResolvedValue({ id: 'order-dup', totalAmount: '100.00', paymentStatus: 'UNPAID' });
      // Payment 1 is in-flight (CREATED)
      repo.listForOrder.mockResolvedValue([{ id: 'pay-flight-1', status: 'CREATED', providerPaymentId: 'mock_active', amount: '100.00' }]);

      const result = await paymentService.initiate({ user: { id: 'u1' } }, 'order-dup');

      // Returns existing payment details rather than creating new one
      expect(result.paymentId).toBe('pay-flight-1');
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('4. Mock & Provider Discrepancies', () => {
    it('4.1 Verifies mock adapter is default provider and interfaces are well defined', () => {
      const providers = require('../src/integrations/payments');
      expect(providers.name).toBe('mock');
    });

    it('4.2 Verifies mock adapter parses webhook payloads properly', () => {
      const parsed = mockProvider.parseWebhookEvent({
        eventId: 'evt_1',
        providerPaymentId: 'pay_1',
        status: 'captured',
        amount: '150.50',
      });

      expect(parsed).toEqual({
        eventId: 'evt_1',
        providerPaymentId: 'pay_1',
        status: 'captured',
        amount: 150.50,
      });
    });
  });
});
