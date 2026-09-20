'use strict';

jest.mock('../src/modules/wishlist/wishlist.repository');
jest.mock('../src/modules/customers/customer.repository');
jest.mock('../src/modules/products/product.repository');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/wishlist/wishlist.repository');
const customerRepo = require('../src/modules/customers/customer.repository');
const productRepo = require('../src/modules/products/product.repository');
const service = require('../src/modules/wishlist/wishlist.service');

const OWNER = { user: { id: 'user-1', roles: ['customer'], permissions: [] } };
const STRANGER = { user: { id: 'user-9', roles: ['customer'], permissions: [] } };

beforeEach(() => {
  customerRepo.findById.mockResolvedValue({ id: 'cust-1', userId: 'user-1' });
});

describe('ownership', () => {
  it('lets the owner list their wishlist', async () => {
    repo.list.mockResolvedValue([]);
    await expect(service.list(OWNER, 'cust-1')).resolves.toEqual([]);
  });

  it('blocks another customer from viewing someone else\'s wishlist', async () => {
    await expect(service.list(STRANGER, 'cust-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('404s an unknown customer', async () => {
    customerRepo.findById.mockResolvedValue(null);
    await expect(service.list(OWNER, 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('add', () => {
  it('adds a product to the wishlist', async () => {
    productRepo.findById.mockResolvedValue({ id: 'p1', toPublicJSON: () => ({ id: 'p1', name: 'Tee' }) });
    repo.find.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 'wi-1', createdAt: new Date() });

    const result = await service.add(OWNER, 'cust-1', 'p1');
    expect(result.productId).toBe('p1');
    expect(repo.create).toHaveBeenCalledWith({ customerId: 'cust-1', productId: 'p1' });
  });

  it('is idempotent: adding an already-wishlisted product does not error or duplicate', async () => {
    productRepo.findById.mockResolvedValue({ id: 'p1', toPublicJSON: () => ({ id: 'p1' }) });
    repo.find.mockResolvedValue({ id: 'wi-existing', createdAt: new Date(), toJSON: () => ({ id: 'wi-existing', customerId: 'cust-1', productId: 'p1' }) });

    const result = await service.add(OWNER, 'cust-1', 'p1');
    expect(result.id).toBe('wi-existing');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('404s an unknown or unpublished product', async () => {
    productRepo.findById.mockResolvedValue(null);
    await expect(service.add(OWNER, 'cust-1', 'ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('remove', () => {
  it('removes an existing wishlist item', async () => {
    repo.find.mockResolvedValue({ id: 'wi-1', destroy: jest.fn() });
    await expect(service.remove(OWNER, 'cust-1', 'p1')).resolves.toEqual({ removed: true });
  });

  it('404s when the product is not on the wishlist', async () => {
    repo.find.mockResolvedValue(null);
    await expect(service.remove(OWNER, 'cust-1', 'p1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
