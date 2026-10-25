'use strict';

const customerService = require('../src/modules/customers/customer.service');
const orderService = require('../src/modules/orders/order.service');
const notificationService = require('../src/modules/notifications/notification.service');
const customerRepo = require('../src/modules/customers/customer.repository');
const orderRepo = require('../src/modules/orders/order.repository');
const notificationRepo = require('../src/modules/notifications/notification.repository');

jest.mock('../src/modules/customers/customer.repository');
jest.mock('../src/modules/orders/order.repository');
jest.mock('../src/modules/notifications/notification.repository');
jest.mock('../src/modules/audit/audit.service');

describe('Security & IDOR Isolation Test Suite', () => {
  const customerA = { id: 'user-A', userId: 'user-A', roles: ['customer'], customerId: 'cust-A' };
  const customerB = { id: 'user-B', userId: 'user-B', roles: ['customer'], customerId: 'cust-B' };
  const adminUser = { id: 'admin-1', roles: ['admin'] };

  beforeEach(() => {
    jest.clearAllMocks();
    customerRepo.transaction.mockImplementation(async (fn) => fn('mock-tx'));
  });

  describe('Customer Address IDOR', () => {
    it('blocks Customer A from modifying an address owned by Customer B', async () => {
      const customerOfB = { id: 'cust-B', userId: 'user-B' };
      customerRepo.findById.mockResolvedValue(customerOfB);

      const reqA = { user: customerA };
      await expect(
        customerService.updateAddress(reqA, 'cust-B', 'addr-B', { street1: 'Hacked Street' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows Admin to manage customer addresses', async () => {
      const customerOfB = { id: 'cust-B', userId: 'user-B' };
      const addressOfB = {
        id: 'addr-B',
        customerId: 'cust-B',
        toJSON: () => ({ id: 'addr-B', street1: 'Old Street' }),
      };

      customerRepo.findById.mockResolvedValue(customerOfB);
      customerRepo.findAddress.mockResolvedValue(addressOfB);
      customerRepo.updateAddress.mockResolvedValue(addressOfB);

      const reqAdmin = { user: adminUser };
      const updated = await customerService.updateAddress(reqAdmin, 'cust-B', 'addr-B', { street1: 'Admin Updated' });
      expect(updated).toBeDefined();
    });
  });

  describe('Order IDOR', () => {
    it('blocks Customer A from accessing Customer B order details', async () => {
      const orderOfB = { id: 'ord-B', customerId: 'cust-B', customer: { userId: 'user-B' }, orderNumber: 'ORD-B-101' };
      orderRepo.findById.mockResolvedValue(orderOfB);

      const reqA = { user: customerA };
      await expect(orderService.get(reqA, 'ord-B')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows Customer A to access their own order', async () => {
      const orderOfA = { id: 'ord-A', customerId: 'cust-A', customer: { userId: 'user-A' }, orderNumber: 'ORD-A-101' };
      orderRepo.findById.mockResolvedValue(orderOfA);

      const reqA = { user: customerA };
      const res = await orderService.get(reqA, 'ord-A');
      expect(res.id).toBe('ord-A');
    });
  });

  describe('Notification IDOR', () => {
    it('blocks Customer A from accessing Customer B notification', async () => {
      const notificationOfB = { id: 'notif-B', customerId: 'cust-B', title: 'Private alert' };
      notificationRepo.findById.mockResolvedValue(notificationOfB);

      const reqA = { user: customerA };
      await expect(notificationService.getNotificationById(reqA, 'notif-B')).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});
