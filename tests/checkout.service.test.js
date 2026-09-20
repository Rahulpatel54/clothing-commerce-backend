'use strict';

jest.mock('../src/modules/cart/cart.repository');
jest.mock('../src/modules/cart/cart.service');
jest.mock('../src/modules/customers/customer.repository');
jest.mock('../src/modules/inventory/inventory.service');
jest.mock('../src/modules/promotions/promotion.service');
jest.mock('../src/modules/orders/order.service');
jest.mock('../src/models', () => ({
  sequelize: { transaction: jest.fn((fn) => fn('tx')) },
  Setting: { findOne: jest.fn().mockResolvedValue(null) },
  IdempotencyKey: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async (payload) => ({ ...payload, update: jest.fn() })) },
}));

const cartRepo = require('../src/modules/cart/cart.repository');
const cartService = require('../src/modules/cart/cart.service');
const customerRepo = require('../src/modules/customers/customer.repository');
const inventoryService = require('../src/modules/inventory/inventory.service');
const promotionService = require('../src/modules/promotions/promotion.service');
const orderService = require('../src/modules/orders/order.service');
const service = require('../src/modules/checkout/checkout.service');

const REQ = { user: { id: 'user-1' }, headers: {} };

function variant(overrides = {}) {
  return { id: 'v1', sku: 'SKU-1', size: 'M', color: 'Black', price: null, costPrice: '100.00', isActive: true, product: { id: 'p1', name: 'Tee', price: '500.00', status: 'ACTIVE', categoryId: 'c1', costPrice: '100.00' }, ...overrides };
}

beforeEach(() => {
  customerRepo.findByUserId.mockResolvedValue({ id: 'cust-1', userId: 'user-1' });
  cartService.getOrCreateCart.mockResolvedValue({ id: 'cart-1' });
  cartRepo.listItems.mockResolvedValue([{ variantId: 'v1', quantity: 2, variant: variant() }]);
  customerRepo.findAddress.mockResolvedValue({ id: 'addr-1', toJSON: () => ({ id: 'addr-1', city: 'Ahmedabad' }) });
  promotionService.evaluate.mockResolvedValue({ discount: 0, breakdown: [], coupon: null });
  inventoryService.reserve.mockResolvedValue({});
  orderService.createFromCheckout.mockResolvedValue({ id: 'order-1', toJSON: () => ({ id: 'order-1' }) });
  orderService.present.mockImplementation((o) => o);
  cartRepo.update.mockResolvedValue(undefined);
});

describe('checkout', () => {
  it('computes totals server-side and reserves stock per line', async () => {
    const result = await service.checkout(REQ, { addressId: 'addr-1' });

    expect(inventoryService.reserve).toHaveBeenCalledWith(expect.objectContaining({ variantId: 'v1', quantity: 2 }), 'tx');
    expect(orderService.createFromCheckout).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 1000, customerId: 'cust-1' }), 'tx');
    expect(result.order).toEqual({ id: 'order-1' });
  });

  it('rejects checkout with an empty cart', async () => {
    cartRepo.listItems.mockResolvedValue([]);
    await expect(service.checkout(REQ, { addressId: 'addr-1' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('404s an address that does not belong to the customer', async () => {
    customerRepo.findAddress.mockResolvedValue(null);
    await expect(service.checkout(REQ, { addressId: 'addr-x' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses checkout when a cart line is no longer purchasable', async () => {
    cartRepo.listItems.mockResolvedValue([{ variantId: 'v1', quantity: 1, variant: variant({ product: { id: 'p1', name: 'Tee', status: 'ARCHIVED' } }) }]);
    await expect(service.checkout(REQ, { addressId: 'addr-1' })).rejects.toMatchObject({ statusCode: 409 });
    expect(inventoryService.reserve).not.toHaveBeenCalled();
  });

  it('applies a coupon discount to the order total', async () => {
    promotionService.evaluate.mockResolvedValue({ discount: 100, breakdown: [{ promotionId: 'promo-1', discount: 100 }], coupon: { id: 'coupon-1', code: 'SAVE100' } });
    promotionService.redeemCoupon = jest.fn().mockResolvedValue(undefined);

    const result = await service.checkout(REQ, { addressId: 'addr-1', couponCode: 'SAVE100' });

    expect(result.discount).toBe(100);
    expect(promotionService.redeemCoupon).toHaveBeenCalledWith('coupon-1', 'cust-1', 'order-1', 100, 'tx');
    expect(orderService.createFromCheckout).toHaveBeenCalledWith(expect.objectContaining({ discountAmount: 100, couponCode: 'SAVE100' }), 'tx');
  });

  it('marks the cart CONVERTED after a successful checkout', async () => {
    await service.checkout(REQ, { addressId: 'addr-1' });
    expect(cartRepo.update).toHaveBeenCalledWith({ id: 'cart-1' }, { status: 'CONVERTED' }, 'tx');
  });
});
