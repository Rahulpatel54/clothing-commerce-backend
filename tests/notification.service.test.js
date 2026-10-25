'use strict';

jest.mock('../src/modules/notifications/notification.repository');
jest.mock('../src/modules/audit/audit.service');
jest.mock('../src/modules/notifications/channels/email.channel');
jest.mock('../src/modules/notifications/channels/sms.channel');

const repo = require('../src/modules/notifications/notification.repository');
const audit = require('../src/modules/audit/audit.service');
const emailChannel = require('../src/modules/notifications/channels/email.channel');
const service = require('../src/modules/notifications/notification.service');
const ApiError = require('../src/utils/ApiError');

function sampleCustomer(overrides = {}) {
  return {
    id: 'cust-101',
    marketingEmail: true,
    marketingSms: true,
    marketingWhatsapp: false,
    user: {
      id: 'user-101',
      email: 'customer@example.com',
      phone: '+15551234567',
      firstName: 'Jane',
      lastName: 'Doe',
    },
    ...overrides,
  };
}

function sampleNotification(overrides = {}) {
  return {
    id: 'notif-1',
    customerId: 'cust-101',
    type: 'ORDER_CONFIRMED',
    channel: 'EMAIL',
    recipient: 'customer@example.com',
    title: 'Order Confirmed',
    body: 'Your order has been placed',
    status: 'PENDING',
    errorMessage: null,
    metadata: {},
    sentAt: null,
    update: jest.fn().mockImplementation(async (data) => Object.assign(sampleNotification(overrides), data)),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.findCustomerWithUser.mockResolvedValue(sampleCustomer());
  repo.create.mockImplementation(async (data) => sampleNotification(data));
  repo.update.mockImplementation(async (id, data) => sampleNotification({ id, ...data }));
  emailChannel.send.mockResolvedValue({ success: true, messageId: 'msg-123' });
  audit.record.mockResolvedValue({});
});

describe('Notification Service', () => {
  it('sends an email notification successfully and marks status SENT', async () => {
    const res = await service.sendNotification({
      customerId: 'cust-101',
      type: 'ORDER_CONFIRMED',
      channel: 'EMAIL',
      title: 'Order Placed',
      body: 'Thanks for your order',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-101',
        recipient: 'customer@example.com',
        status: 'PENDING',
      })
    );
    expect(emailChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'customer@example.com',
        title: 'Order Placed',
      })
    );
    expect(repo.update).toHaveBeenCalledWith('notif-1', expect.objectContaining({ status: 'SENT' }));
  });

  it('marks status FAILED when channel delivery encounters an error', async () => {
    emailChannel.send.mockRejectedValueOnce(new Error('SMTP timeout'));

    const res = await service.sendNotification({
      customerId: 'cust-101',
      type: 'ORDER_CONFIRMED',
      channel: 'EMAIL',
      title: 'Order Placed',
      body: 'Thanks for your order',
    });

    expect(repo.update).toHaveBeenCalledWith(
      'notif-1',
      expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'SMTP timeout',
      })
    );
  });

  it('cancels marketing notification if customer has opted out of marketing emails', async () => {
    repo.findCustomerWithUser.mockResolvedValueOnce(sampleCustomer({ marketingEmail: false }));

    const res = await service.sendNotification({
      customerId: 'cust-101',
      type: 'ABANDONED_CART',
      channel: 'EMAIL',
      title: 'You left items in your cart',
      body: 'Come back and finish checkout',
    });

    expect(emailChannel.send).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'CANCELLED',
        errorMessage: 'Customer opted out of marketing emails',
      })
    );
  });

  it('allows transactional notifications even if customer opted out of marketing emails', async () => {
    repo.findCustomerWithUser.mockResolvedValueOnce(sampleCustomer({ marketingEmail: false }));

    const res = await service.sendNotification({
      customerId: 'cust-101',
      type: 'ORDER_CONFIRMED',
      channel: 'EMAIL',
      title: 'Order Placed',
      body: 'Order details here',
    });

    expect(emailChannel.send).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('notif-1', expect.objectContaining({ status: 'SENT' }));
  });

  it('scopes notification list to customer if caller is not staff/admin', async () => {
    repo.list.mockResolvedValue({ total: 1, page: 1, limit: 20, items: [] });
    const req = { user: { id: 'u-1', customerId: 'cust-101', roles: ['customer'] } };

    await service.listNotifications(req, {});
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-101' }));
  });

  it('prevents customer from viewing another customer notification (IDOR protection)', async () => {
    repo.findById.mockResolvedValue(sampleNotification({ customerId: 'cust-other' }));
    const req = { user: { id: 'u-1', customerId: 'cust-101', roles: ['customer'] } };

    await expect(service.getNotificationById(req, 'notif-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows admin to retry a failed notification', async () => {
    repo.findById.mockResolvedValue(sampleNotification({ status: 'FAILED' }));
    const req = { user: { id: 'u-admin', roles: ['admin'] } };

    const result = await service.retryNotification(req, 'notif-1');
    expect(emailChannel.send).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('notif-1', expect.objectContaining({ status: 'SENT' }));
    expect(audit.record).toHaveBeenCalledWith(req, expect.objectContaining({ action: 'notification.retry' }));
  });
});
