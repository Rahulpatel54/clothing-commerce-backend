'use strict';

const jobRunner = require('../src/jobs/job.runner');
const eventBus = require('../src/modules/notifications/event.bus');

describe('Background Jobs Engine', () => {
  let mockModels;

  beforeEach(() => {
    jest.clearAllMocks();

    mockModels = {
      Promotion: {
        findAll: jest.fn(),
      },
      Coupon: {
        update: jest.fn(),
      },
      WalletTransaction: {
        CREDIT_TYPES: ['PURCHASE_CREDIT'],
        findAll: jest.fn(),
      },
      Wallet: {},
      Cart: {
        findAll: jest.fn(),
      },
      CartItem: {},
      Customer: {},
      User: {},
      Inventory: {
        findAll: jest.fn(),
      },
      ProductVariant: {},
      Product: {},
      Order: {
        findAll: jest.fn(),
      },
    };

    jest.spyOn(jobRunner, 'getModels').mockReturnValue(mockModels);
  });

  describe('Coupon Expiration Job', () => {
    it('deactivates expired promotions and their associated coupons', async () => {
      const mockPromo = {
        id: 'promo-1',
        update: jest.fn().mockResolvedValue(true),
      };

      mockModels.Promotion.findAll.mockResolvedValue([mockPromo]);
      mockModels.Coupon.update.mockResolvedValue([2]); // 2 coupons updated

      const result = await jobRunner.runCouponExpirationJob();

      expect(mockPromo.update).toHaveBeenCalledWith({ isActive: false });
      expect(mockModels.Coupon.update).toHaveBeenCalledWith(
        { isActive: false },
        { where: { promotionId: 'promo-1', isActive: true } }
      );
      expect(result).toEqual({ promoCount: 1, couponCount: 2 });
    });
  });

  describe('Reward Expiration Job', () => {
    it('dispatches REWARD_EXPIRING event for expiring credits', async () => {
      const emitSpy = jest.spyOn(eventBus, 'emit');

      mockModels.WalletTransaction.findAll.mockResolvedValue([
        {
          id: 'tx-1',
          amount: '500.00',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          wallet: {
            customer: {
              id: 'cust-1',
              user: { email: 'vip@example.com' },
            },
          },
        },
      ]);

      const result = await jobRunner.runRewardExpirationJob();

      expect(result.alertedCount).toBe(1);
      expect(emitSpy).toHaveBeenCalledWith('REWARD_EXPIRING', expect.objectContaining({
        customer: expect.objectContaining({ id: 'cust-1' }),
        amount: '500.00',
      }));
    });
  });

  describe('Abandoned Cart Job', () => {
    it('dispatches ABANDONED_CART event for carts untouched for 24 hours', async () => {
      const emitSpy = jest.spyOn(eventBus, 'emit');

      mockModels.Cart.findAll.mockResolvedValue([
        {
          id: 'cart-1',
          items: [{ id: 'item-1' }],
          customer: { id: 'cust-1', user: { email: 'cart@example.com' } },
        },
      ]);

      const result = await jobRunner.runAbandonedCartJob();

      expect(result.abandonedCount).toBe(1);
      expect(emitSpy).toHaveBeenCalledWith('ABANDONED_CART', expect.objectContaining({
        cartId: 'cart-1',
        itemsCount: 1,
      }));
    });
  });

  describe('Low Stock Alert Job', () => {
    it('dispatches LOW_STOCK_ALERT event when available stock is below or equal to threshold', async () => {
      const emitSpy = jest.spyOn(eventBus, 'emit');

      mockModels.Inventory.findAll.mockResolvedValue([
        {
          id: 'inv-1',
          physical: 5,
          reserved: 2, // available = 3 (<= 5)
          variant: {
            id: 'var-1',
            sku: 'TSHIRT-BLK-M',
            product: { id: 'prod-1', title: 'Classic T-Shirt' },
          },
        },
        {
          id: 'inv-2',
          physical: 20,
          reserved: 0, // available = 20 (> 5)
          variant: { id: 'var-2', sku: 'TSHIRT-BLK-L' },
        },
      ]);

      const result = await jobRunner.runLowStockAlertJob(5);

      expect(result.lowStockCount).toBe(1);
      expect(emitSpy).toHaveBeenCalledWith('LOW_STOCK_ALERT', expect.objectContaining({
        availableQty: 3,
        threshold: 5,
      }));
    });
  });

  describe('Review Reminder Job', () => {
    it('dispatches REVIEW_REMINDER event for delivered orders', async () => {
      const emitSpy = jest.spyOn(eventBus, 'emit');

      mockModels.Order.findAll.mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'ORD-2026-1234',
          customer: { id: 'cust-1', user: { email: 'buyer@example.com' } },
        },
      ]);

      const result = await jobRunner.runReviewReminderJob();

      expect(result.reminderCount).toBe(1);
      expect(emitSpy).toHaveBeenCalledWith('REVIEW_REMINDER', expect.objectContaining({
        order: expect.objectContaining({ orderNumber: 'ORD-2026-1234' }),
      }));
    });
  });
});
