'use strict';

jest.mock('../src/modules/customers/customer.repository');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/customers/customer.repository');
const service = require('../src/modules/customers/customer.service');

const OWNER = { user: { id: 'user-1', roles: ['customer'], permissions: [] }, headers: {}, ip: '127.0.0.1', id: 'req-1' };
const STAFF = { user: { id: 'staff-1', roles: ['staff'], permissions: ['customers:read', 'customers:update'] }, headers: {}, ip: '127.0.0.1', id: 'req-2' };
const STRANGER = { user: { id: 'user-9', roles: ['customer'], permissions: [] }, headers: {}, ip: '127.0.0.1', id: 'req-3' };

function customer(overrides = {}) {
  const row = {
    id: 'cust-1',
    userId: 'user-1',
    totalSpend: '4500.00',
    orderCount: 3,
    marketingEmail: true,
    marketingSms: true,
    marketingWhatsapp: false,
    ...overrides,
  };
  row.toJSON = () => ({ ...row });
  row.averageOrderValue = () => (row.orderCount ? Number((Number(row.totalSpend) / row.orderCount).toFixed(2)) : 0);
  return row;
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.findById.mockResolvedValue(customer());
});

describe('access scoping', () => {
  it('lets the owner read their own profile', async () => {
    await expect(service.get(OWNER, 'cust-1')).resolves.toMatchObject({ id: 'cust-1' });
  });

  it('lets staff with the permission read any profile', async () => {
    await expect(service.get(STAFF, 'cust-1')).resolves.toMatchObject({ id: 'cust-1' });
  });

  it('blocks another customer with 403', async () => {
    await expect(service.get(STRANGER, 'cust-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('404s an unknown customer', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.get(STAFF, 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('derived statistics', () => {
  it('computes AOV instead of trusting a stored value', async () => {
    const result = await service.get(OWNER, 'cust-1');
    expect(result.stats).toMatchObject({ totalSpend: 4500, orderCount: 3, averageOrderValue: 1500 });
  });

  it('reports zero AOV with no orders', async () => {
    repo.findById.mockResolvedValue(customer({ totalSpend: '0.00', orderCount: 0 }));
    const result = await service.get(OWNER, 'cust-1');
    expect(result.stats.averageOrderValue).toBe(0);
  });

  it('refuses to write spend statistics from a request payload', async () => {
    repo.update.mockResolvedValue(undefined);

    await service.update(OWNER, 'cust-1', { notes: 'VIP', totalSpend: 999999, orderCount: 500, lastPurchaseAt: new Date() });

    const written = repo.update.mock.calls[0][1];
    expect(written).toEqual({ notes: 'VIP' });
    expect(written.totalSpend).toBeUndefined();
  });
});

describe('marketing preferences', () => {
  it('stamps an opt-out when every channel is switched off', async () => {
    repo.update.mockResolvedValue(undefined);

    await service.setMarketingPreferences(OWNER, 'cust-1', {
      marketingEmail: false,
      marketingSms: false,
      marketingWhatsapp: false,
    });

    expect(repo.update.mock.calls[0][1].marketingOptOutAt).toBeInstanceOf(Date);
  });

  it('clears the opt-out when a channel is switched back on', async () => {
    repo.update.mockResolvedValue(undefined);

    await service.setMarketingPreferences(OWNER, 'cust-1', {
      marketingEmail: true,
      marketingSms: false,
      marketingWhatsapp: false,
    });

    expect(repo.update.mock.calls[0][1].marketingOptOutAt).toBeNull();
  });
});

describe('address default invariants', () => {
  it('makes the first address the default for shipping and billing', async () => {
    repo.countAddresses.mockResolvedValue(0);
    repo.createAddress.mockImplementation(async (payload) => ({ id: 'addr-1', ...payload }));

    const address = await service.addAddress(OWNER, 'cust-1', { city: 'Ahmedabad' });

    expect(address.isDefaultShipping).toBe(true);
    expect(address.isDefaultBilling).toBe(true);
  });

  it('clears the previous default when a later address claims it', async () => {
    repo.countAddresses.mockResolvedValue(2);
    repo.createAddress.mockImplementation(async (payload) => ({ id: 'addr-3', ...payload }));

    await service.addAddress(OWNER, 'cust-1', { city: 'Surat', isDefaultShipping: true });

    expect(repo.clearDefaults).toHaveBeenCalledWith('cust-1', 'isDefaultShipping', 'addr-3', 'tx');
    expect(repo.clearDefaults).not.toHaveBeenCalledWith('cust-1', 'isDefaultBilling', 'addr-3', 'tx');
  });

  it('does not make a later address default by accident', async () => {
    repo.countAddresses.mockResolvedValue(1);
    repo.createAddress.mockImplementation(async (payload) => ({ id: 'addr-2', ...payload }));

    const address = await service.addAddress(OWNER, 'cust-1', { city: 'Rajkot' });

    expect(address.isDefaultShipping).toBe(false);
    expect(address.isDefaultBilling).toBe(false);
  });

  it('promotes a remaining address when the default is deleted', async () => {
    const target = { id: 'addr-1', isDefaultShipping: true, isDefaultBilling: true, toJSON: () => ({ id: 'addr-1' }) };
    const survivor = { id: 'addr-2', isDefaultShipping: false, isDefaultBilling: false };
    repo.findAddress.mockResolvedValue(target);
    repo.destroyAddress.mockResolvedValue(undefined);
    repo.listAddresses.mockResolvedValue([survivor]);

    await service.removeAddress(OWNER, 'cust-1', 'addr-1');

    expect(repo.updateAddress).toHaveBeenCalledWith(survivor, { isDefaultShipping: true, isDefaultBilling: true }, 'tx');
  });

  it('404s an address belonging to a different customer', async () => {
    repo.findAddress.mockResolvedValue(null);

    await expect(service.removeAddress(OWNER, 'cust-1', 'addr-x')).rejects.toMatchObject({ statusCode: 404 });
  });
});