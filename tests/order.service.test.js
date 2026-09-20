'use strict';

jest.mock('../src/modules/orders/order.repository');
jest.mock('../src/modules/audit/audit.service');
jest.mock('../src/modules/inventory/inventory.service');
jest.mock('../src/modules/customers/customer.service');

const repo = require('../src/modules/orders/order.repository');
const inventoryService = require('../src/modules/inventory/inventory.service');
const customerService = require('../src/modules/customers/customer.service');
const service = require('../src/modules/orders/order.service');
const { canTransition } = require('../src/modules/orders/order.transitions');

const REQ = { user: { id: 'staff-1', roles: ['staff'], permissions: ['orders:update'] } };

function order(overrides = {}) {
  return {
    id: 'order-1', orderNumber: 'ORD1', customerId: 'cust-1', status: 'PENDING', totalAmount: '1500.00',
    items: [{ variantId: 'v1', quantity: 2 }], toJSON() { return { ...this, toJSON: undefined }; }, ...overrides,
  };
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.update.mockResolvedValue(undefined);
  repo.createHistory.mockResolvedValue({});
});

describe('transition table', () => {
  it('allows the documented happy path', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PROCESSING')).toBe(true);
    expect(canTransition('DELIVERED', 'RETURN_REQUESTED')).toBe(true);
    expect(canTransition('RETURNED', 'REFUNDED')).toBe(true);
  });

  it('rejects a jump that skips steps', () => {
    expect(canTransition('PENDING', 'SHIPPED')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
  });
});

describe('transition side effects', () => {
  it('rejects an invalid transition with 409 and performs no side effects', async () => {
    repo.findByIdForUpdate.mockResolvedValue(order({ status: 'PENDING' }));
    await expect(service.transition(REQ, 'order-1', 'SHIPPED')).rejects.toMatchObject({ statusCode: 409 });
    expect(inventoryService.commit).not.toHaveBeenCalled();
  });

  it('commits stock and updates customer stats on CONFIRMED', async () => {
    repo.findByIdForUpdate.mockResolvedValue(order({ status: 'PENDING' }));
    repo.findById.mockResolvedValue(order({ status: 'CONFIRMED' }));

    await service.transition(REQ, 'order-1', 'CONFIRMED');

    expect(inventoryService.commit).toHaveBeenCalledWith(expect.objectContaining({ variantId: 'v1', quantity: 2, referenceType: 'ORDER', referenceId: 'order-1' }));
    expect(customerService.applyOrderStats).toHaveBeenCalledWith('cust-1', expect.objectContaining({ deltaSpend: 1500, deltaOrderCount: 1 }));
  });

  it('releases (not restocks) reserved stock when cancelling from PENDING', async () => {
    repo.findByIdForUpdate.mockResolvedValue(order({ status: 'PENDING' }));
    repo.findById.mockResolvedValue(order({ status: 'CANCELLED' }));

    await service.transition(REQ, 'order-1', 'CANCELLED');

    expect(inventoryService.release).toHaveBeenCalledWith(expect.objectContaining({ variantId: 'v1', quantity: 2 }));
    expect(inventoryService.restock).not.toHaveBeenCalled();
    expect(customerService.applyOrderStats).not.toHaveBeenCalled();
  });

  it('restocks and reverses customer stats when cancelling a confirmed order', async () => {
    repo.findByIdForUpdate.mockResolvedValue(order({ status: 'CONFIRMED' }));
    repo.findById.mockResolvedValue(order({ status: 'CANCELLED' }));

    await service.transition(REQ, 'order-1', 'CANCELLED');

    expect(inventoryService.restock).toHaveBeenCalled();
    expect(customerService.applyOrderStats).toHaveBeenCalledWith('cust-1', expect.objectContaining({ deltaSpend: -1500, deltaOrderCount: -1 }));
  });

  it('restocks on RETURNED', async () => {
    repo.findByIdForUpdate.mockResolvedValue(order({ status: 'RETURN_APPROVED' }));
    repo.findById.mockResolvedValue(order({ status: 'RETURNED' }));

    await service.transition(REQ, 'order-1', 'RETURNED');
    expect(inventoryService.restock).toHaveBeenCalled();
  });

  it('404s an unknown order', async () => {
    repo.findByIdForUpdate.mockResolvedValue(null);
    await expect(service.transition(REQ, 'ghost', 'CONFIRMED')).rejects.toMatchObject({ statusCode: 404 });
  });
});
