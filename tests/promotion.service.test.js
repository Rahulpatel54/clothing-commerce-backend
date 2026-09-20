'use strict';

jest.mock('../src/modules/promotions/promotion.repository');

const repo = require('../src/modules/promotions/promotion.repository');
const service = require('../src/modules/promotions/promotion.service');

function promo(overrides = {}) {
  return {
    id: 'promo-1', name: 'Sale', type: 'PERCENTAGE', value: 10, minOrderAmount: 0, maxDiscountAmount: null,
    isActive: true, stackable: false, firstOrderOnly: false, customerId: null, startsAt: null, endsAt: null,
    rules: [], ...overrides,
  };
}

const LINES = [
  { productId: 'p1', categoryId: 'c1', lineTotal: 1000 },
  { productId: 'p2', categoryId: 'c2', lineTotal: 500 },
];

beforeEach(() => {
  repo.findAutomaticPromotions.mockResolvedValue([]);
  repo.customerOrderCount.mockResolvedValue(0);
  repo.countCustomerRedemptions.mockResolvedValue(0);
});

describe('automatic promotions', () => {
  it('applies a simple percentage discount off the whole order', async () => {
    repo.findAutomaticPromotions.mockResolvedValue([promo()]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.discount).toBe(150);
  });

  it('caps a percentage discount at maxDiscountAmount', async () => {
    repo.findAutomaticPromotions.mockResolvedValue([promo({ maxDiscountAmount: 50 })]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.discount).toBe(50);
  });

  it('skips a promotion below its minimum order amount', async () => {
    repo.findAutomaticPromotions.mockResolvedValue([promo({ minOrderAmount: 2000 })]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.discount).toBe(0);
  });

  it('restricts a discount to included products only', async () => {
    repo.findAutomaticPromotions.mockResolvedValue([
      promo({ type: 'PERCENTAGE', value: 20, rules: [{ ruleType: 'PRODUCT_INCLUDE', targetId: 'p1' }] }),
    ]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.discount).toBe(200); // 20% of the 1000 p1 line only
  });

  it('voids a promotion entirely if the cart contains an excluded product', async () => {
    repo.findAutomaticPromotions.mockResolvedValue([
      promo({ rules: [{ ruleType: 'PRODUCT_EXCLUDE', targetId: 'p2' }] }),
    ]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.discount).toBe(0);
  });

  it('skips a first-order-only promotion for a repeat customer', async () => {
    repo.customerOrderCount.mockResolvedValue(2);
    repo.findAutomaticPromotions.mockResolvedValue([promo({ firstOrderOnly: true })]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.discount).toBe(0);
  });

  it('stacks two stackable promotions but stops discount at the subtotal', async () => {
    repo.findAutomaticPromotions.mockResolvedValue([
      promo({ id: 'p-a', type: 'FIXED', value: 900, stackable: true }),
      promo({ id: 'p-b', type: 'FIXED', value: 900, stackable: true }),
    ]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.discount).toBe(1500);
  });

  it('a non-stackable automatic promotion applies alone even if others qualify', async () => {
    repo.findAutomaticPromotions.mockResolvedValue([
      promo({ id: 'p-solo', type: 'FIXED', value: 100, stackable: false, priority: 10 }),
      promo({ id: 'p-b', type: 'FIXED', value: 50, stackable: true }),
    ]);
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1' });
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].promotionId).toBe('p-solo');
  });
});

describe('coupons', () => {
  it('applies a valid coupon and reports it in the result', async () => {
    repo.findCouponByCode.mockResolvedValue({ id: 'coupon-1', code: 'SAVE10', isActive: true, usageLimit: null, usedCount: 0, usageLimitPerCustomer: 1, promotion: promo() });
    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1', couponCode: 'save10' });
    expect(result.coupon).toEqual({ id: 'coupon-1', code: 'SAVE10' });
    expect(result.discount).toBe(150);
  });

  it('rejects an unknown coupon code', async () => {
    repo.findCouponByCode.mockResolvedValue(null);
    await expect(service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1', couponCode: 'NOPE' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a coupon that has hit its global usage limit', async () => {
    repo.findCouponByCode.mockResolvedValue({ id: 'coupon-1', isActive: true, usageLimit: 5, usedCount: 5, usageLimitPerCustomer: 10, promotion: promo() });
    await expect(service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1', couponCode: 'X' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a coupon this customer has already redeemed up to their limit', async () => {
    repo.findCouponByCode.mockResolvedValue({ id: 'coupon-1', isActive: true, usageLimit: null, usedCount: 0, usageLimitPerCustomer: 1, promotion: promo() });
    repo.countCustomerRedemptions.mockResolvedValue(1);
    await expect(service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1', couponCode: 'X' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an expired coupon', async () => {
    repo.findCouponByCode.mockResolvedValue({ id: 'coupon-1', isActive: true, usageLimit: null, usedCount: 0, usageLimitPerCustomer: 1, promotion: promo({ endsAt: new Date(Date.now() - 1000) }) });
    await expect(service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1', couponCode: 'X' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('a non-stackable coupon suppresses automatic promotions', async () => {
    repo.findCouponByCode.mockResolvedValue({ id: 'coupon-1', isActive: true, usageLimit: null, usedCount: 0, usageLimitPerCustomer: 1, promotion: promo({ id: 'coupon-promo', stackable: false, type: 'FIXED', value: 100 }) });
    repo.findAutomaticPromotions.mockResolvedValue([promo({ id: 'auto-promo', type: 'FIXED', value: 50, stackable: true })]);

    const result = await service.evaluate({ lines: LINES, subtotal: 1500, customerId: 'cust-1', couponCode: 'X' });
    expect(result.breakdown).toEqual([{ promotionId: 'coupon-promo', name: 'Sale', discount: 100 }]);
  });
});
