'use strict';

jest.mock('../src/modules/cart/cart.repository');
jest.mock('../src/modules/inventory/inventory.service');

const repo = require('../src/modules/cart/cart.repository');
const inventoryService = require('../src/modules/inventory/inventory.service');
const service = require('../src/modules/cart/cart.service');

function cart(overrides = {}) {
  return { id: 'cart-1', customerId: null, sessionId: 'sess-1', status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000), ...overrides };
}

function variant(overrides = {}) {
  return { id: 'v1', price: null, isActive: true, product: { id: 'p1', name: 'Tee', slug: 'tee', price: '999.00', status: 'ACTIVE' }, ...overrides };
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.listItems.mockResolvedValue([]);
});

describe('getOrCreateCart', () => {
  it('creates a new cart for a first-time guest session', async () => {
    repo.findActiveBySession.mockResolvedValue(null);
    repo.create.mockImplementation(async (payload) => cart(payload));

    const result = await service.getOrCreateCart({ sessionId: 'sess-new' });
    expect(result.sessionId).toBe('sess-new');
    expect(repo.create).toHaveBeenCalled();
  });

  it('reuses an existing active cart', async () => {
    const existing = cart();
    repo.findActiveBySession.mockResolvedValue(existing);
    const result = await service.getOrCreateCart({ sessionId: 'sess-1' });
    expect(result.id).toBe('cart-1');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('treats an expired cart as gone and opens a fresh one', async () => {
    repo.findActiveBySession.mockResolvedValue(cart({ expiresAt: new Date(Date.now() - 1000) }));
    repo.create.mockImplementation(async (payload) => cart({ id: 'cart-2', ...payload }));

    const result = await service.getOrCreateCart({ sessionId: 'sess-1' });
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'cart-1' }), { status: 'EXPIRED' }, 'tx');
    expect(result.id).toBe('cart-2');
  });

  it('requires a customer or session', async () => {
    await expect(service.getOrCreateCart({})).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('addItem', () => {
  beforeEach(() => {
    repo.findActiveBySession.mockResolvedValue(cart());
    repo.findVariantWithProduct.mockResolvedValue(variant());
    inventoryService.getStock.mockResolvedValue({ available: 10 });
  });

  it('adds a new line item, snapshotting the current price', async () => {
    repo.findItem.mockResolvedValue(null);
    repo.createItem.mockResolvedValue({ id: 'ci-1' });

    await service.addItem({ sessionId: 'sess-1' }, { variantId: 'v1', quantity: 2 });

    expect(repo.createItem).toHaveBeenCalledWith(expect.objectContaining({ variantId: 'v1', quantity: 2, priceAtAdd: 999 }), 'tx');
  });

  it('sums quantity onto an existing line, capped at the per-variant limit', async () => {
    repo.findItem.mockResolvedValue({ id: 'ci-1', quantity: service.MAX_QTY - 1 });
    repo.updateItem.mockResolvedValue(undefined);

    await service.addItem({ sessionId: 'sess-1' }, { variantId: 'v1', quantity: 5 });

    const written = repo.updateItem.mock.calls[0][1];
    expect(written.quantity).toBe(service.MAX_QTY);
  });

  it('refuses to add more than is in stock', async () => {
    inventoryService.getStock.mockResolvedValue({ available: 1 });
    repo.findItem.mockResolvedValue(null);

    await expect(service.addItem({ sessionId: 'sess-1' }, { variantId: 'v1', quantity: 5 })).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createItem).not.toHaveBeenCalled();
  });

  it('refuses to add a variant whose product is not active', async () => {
    repo.findVariantWithProduct.mockResolvedValue(variant({ product: { id: 'p1', status: 'DRAFT', price: '999.00' } }));
    await expect(service.addItem({ sessionId: 'sess-1' }, { variantId: 'v1', quantity: 1 })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('present() totals', () => {
  it('always recomputes line totals from the live price, never the client', async () => {
    repo.findActiveBySession.mockResolvedValue(cart());
    repo.listItems.mockResolvedValue([
      { id: 'ci-1', variantId: 'v1', quantity: 2, priceAtAdd: '500.00', variant: variant({ price: '600.00' }) },
    ]);

    const result = await service.getCart({ sessionId: 'sess-1' });
    expect(result.items[0].priceChanged).toBe(true);
    expect(result.items[0].lineTotal).toBe(1200); // 2 * current price (600), not the stale 500
    expect(result.subtotal).toBe(1200);
  });

  it('flags items whose product has gone inactive', async () => {
    repo.findActiveBySession.mockResolvedValue(cart());
    repo.listItems.mockResolvedValue([
      { id: 'ci-1', variantId: 'v1', quantity: 1, priceAtAdd: '999.00', variant: variant({ product: { id: 'p1', status: 'ARCHIVED', price: '999.00' } }) },
    ]);

    const result = await service.getCart({ sessionId: 'sess-1' });
    expect(result.items[0].available).toBe(false);
    expect(result.hasUnavailableItems).toBe(true);
  });
});

describe('updateItemQuantity', () => {
  it('removes the line when quantity is set to 0', async () => {
    repo.findActiveBySession.mockResolvedValue(cart());
    repo.findItem.mockResolvedValue({ id: 'ci-1' });

    await service.updateItemQuantity({ sessionId: 'sess-1' }, 'v1', 0);
    expect(repo.destroyItem).toHaveBeenCalled();
  });

  it('404s when the variant is not in the cart', async () => {
    repo.findActiveBySession.mockResolvedValue(cart());
    repo.findItem.mockResolvedValue(null);
    await expect(service.updateItemQuantity({ sessionId: 'sess-1' }, 'v1', 3)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('mergeGuestCart', () => {
  it('folds guest items into the customer cart and retires the guest cart', async () => {
    const guestCart = cart({ id: 'guest-1' });
    const customerCart = cart({ id: 'cust-cart-1', customerId: 'cust-1', sessionId: null });

    repo.findActiveBySession.mockResolvedValueOnce(guestCart);
    repo.findActiveByCustomer.mockResolvedValue(null);
    repo.create.mockResolvedValue(customerCart);
    repo.listItems.mockImplementation(async (cartId) => (cartId === 'guest-1' ? [{ variantId: 'v1', quantity: 2, priceAtAdd: '999.00' }] : []));
    repo.findItem.mockResolvedValue(null);

    await service.mergeGuestCart({ sessionId: 'sess-1', customerId: 'cust-1' });

    expect(repo.createItem).toHaveBeenCalledWith(expect.objectContaining({ cartId: 'cust-cart-1', variantId: 'v1', quantity: 2 }), 'tx');
    expect(repo.update).toHaveBeenCalledWith(guestCart, { status: 'MERGED' }, 'tx');
  });

  it('does nothing when there is no guest cart', async () => {
    repo.findActiveBySession.mockResolvedValue(null);
    const result = await service.mergeGuestCart({ sessionId: 'sess-none', customerId: 'cust-1' });
    expect(result).toBeNull();
  });
});
