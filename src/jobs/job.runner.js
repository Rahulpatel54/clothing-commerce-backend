'use strict';

const { Op } = require('sequelize');
const logger = require('../config/logger');
const config = require('../config');
const eventBus = require('../modules/notifications/event.bus');

class JobRunner {
  constructor() {
    this.intervals = [];
    this.isRunning = false;
  }

  getModels() {
    return require('../models');
  }

  /**
   * Deactivate expired promotions & coupons
   */
  async runCouponExpirationJob() {
    try {
      const { Promotion, Coupon } = this.getModels();
      const now = new Date();

      const expiredPromotions = await Promotion.findAll({
        where: {
          isActive: true,
          endsAt: { [Op.ne]: null, [Op.lt]: now },
        },
      });

      let promoCount = 0;
      let couponCount = 0;

      for (const promo of expiredPromotions) {
        await promo.update({ isActive: false });
        promoCount++;

        const [updatedCoupons] = await Coupon.update(
          { isActive: false },
          { where: { promotionId: promo.id, isActive: true } }
        );
        couponCount += updatedCoupons;
      }

      logger.info({ promoCount, couponCount }, '[JobRunner] Coupon & Promotion expiration completed');
      return { promoCount, couponCount };
    } catch (err) {
      logger.error({ err }, '[JobRunner] Coupon expiration failed');
      throw err;
    }
  }

  /**
   * Scan wallet credits expiring within 48h to alert customers
   */
  async runRewardExpirationJob() {
    try {
      const { WalletTransaction, Wallet, Customer, User } = this.getModels();
      const now = new Date();
      const in48Hours = new Date(Date.now() + 48 * 60 * 60 * 1000);

      // Find transactions expiring within the next 48 hours
      const expiring = await WalletTransaction.findAll({
        where: {
          expiresAt: {
            [Op.between]: [now, in48Hours],
          },
          type: {
            [Op.in]: WalletTransaction.CREDIT_TYPES || [
              'PURCHASE_CREDIT',
              'REFERRAL_CREDIT',
              'UGC_CREDIT',
              'BIRTHDAY_CREDIT',
              'CAMPAIGN_CREDIT',
              'COMPENSATION_CREDIT',
            ],
          },
        },
        include: [
          {
            model: Wallet,
            as: 'wallet',
            include: [
              {
                model: Customer,
                as: 'customer',
                include: [{ model: User, as: 'user' }],
              },
            ],
          },
        ],
      });

      let alertedCount = 0;
      for (const tx of expiring) {
        if (tx.wallet && tx.wallet.customer) {
          eventBus.emit('REWARD_EXPIRING', {
            customer: tx.wallet.customer,
            amount: tx.amount,
            expiresAt: tx.expiresAt,
          });
          alertedCount++;
        }
      }

      logger.info({ alertedCount }, '[JobRunner] Reward expiration check completed');
      return { alertedCount };
    } catch (err) {
      logger.error({ err }, '[JobRunner] Reward expiration job failed');
      throw err;
    }
  }

  /**
   * Scan active carts untouched for > 24 hours
   */
  async runAbandonedCartJob() {
    try {
      const { Cart, CartItem, Customer, User } = this.getModels();
      const now = Date.now();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);

      const carts = await Cart.findAll({
        where: {
          status: 'ACTIVE',
          customerId: { [Op.ne]: null },
          updatedAt: {
            [Op.between]: [twoDaysAgo, oneDayAgo],
          },
        },
        include: [
          {
            model: CartItem,
            as: 'items',
            required: true,
          },
          {
            model: Customer,
            as: 'customer',
            include: [{ model: User, as: 'user' }],
          },
        ],
      });

      let abandonedCount = 0;
      for (const cart of carts) {
        if (cart.customer && cart.items && cart.items.length > 0) {
          eventBus.emit('ABANDONED_CART', {
            customer: cart.customer,
            cartId: cart.id,
            itemsCount: cart.items.length,
          });
          abandonedCount++;
        }
      }

      logger.info({ abandonedCount }, '[JobRunner] Abandoned cart check completed');
      return { abandonedCount };
    } catch (err) {
      logger.error({ err }, '[JobRunner] Abandoned cart job failed');
      throw err;
    }
  }

  /**
   * Alert admins on low stock variants (physical - reserved <= threshold)
   */
  async runLowStockAlertJob(threshold = 5) {
    try {
      const { Inventory, ProductVariant, Product } = this.getModels();

      const inventories = await Inventory.findAll({
        include: [
          {
            model: ProductVariant,
            as: 'variant',
            include: [{ model: Product, as: 'product' }],
          },
        ],
      });

      let lowStockCount = 0;
      for (const inv of inventories) {
        const available = Math.max(0, Number(inv.physical) - Number(inv.reserved));
        if (available <= threshold && inv.variant) {
          eventBus.emit('LOW_STOCK_ALERT', {
            product: inv.variant.product,
            variant: inv.variant,
            availableQty: available,
            threshold,
          });
          lowStockCount++;
        }
      }

      logger.info({ lowStockCount }, '[JobRunner] Low stock alert check completed');
      return { lowStockCount };
    } catch (err) {
      logger.error({ err }, '[JobRunner] Low stock alert job failed');
      throw err;
    }
  }

  /**
   * Remind customers to review delivered items after 7 days
   */
  async runReviewReminderJob() {
    try {
      const { Order, Customer, User } = this.getModels();
      const now = Date.now();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

      const deliveredOrders = await Order.findAll({
        where: {
          status: 'DELIVERED',
          deliveredAt: {
            [Op.between]: [fourteenDaysAgo, sevenDaysAgo],
          },
        },
        include: [
          {
            model: Customer,
            as: 'customer',
            include: [{ model: User, as: 'user' }],
          },
        ],
      });

      let reminderCount = 0;
      for (const order of deliveredOrders) {
        if (order.customer) {
          eventBus.emit('REVIEW_REMINDER', {
            customer: order.customer,
            order,
          });
          reminderCount++;
        }
      }

      logger.info({ reminderCount }, '[JobRunner] Review reminder check completed');
      return { reminderCount };
    } catch (err) {
      logger.error({ err }, '[JobRunner] Review reminder job failed');
      throw err;
    }
  }

  /**
   * Prune idempotency keys older than 72 hours
   */
  async runIdempotencyPrunerJob() {
    try {
      const { IdempotencyKey } = this.getModels();
      const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const prunedCount = await IdempotencyKey.destroy({
        where: {
          createdAt: { [Op.lt]: cutoff },
        },
      });
      logger.info({ prunedCount }, '[JobRunner] Idempotency keys pruned');
      return { prunedCount };
    } catch (err) {
      logger.error({ err }, '[JobRunner] Idempotency pruner failed');
      throw err;
    }
  }

  /**
   * Start recurring background jobs safely with error isolation
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('[JobRunner] Starting background job schedulers');

    // Run every hour
    const hourly = setInterval(async () => {
      try {
        await this.runCouponExpirationJob();
      } catch (e) {
        /* isolated */
      }
      try {
        await this.runRewardExpirationJob();
      } catch (e) {
        /* isolated */
      }
    }, 60 * 60 * 1000);

    // Run every 6 hours
    const sixHourly = setInterval(async () => {
      try {
        await this.runAbandonedCartJob();
      } catch (e) {
        /* isolated */
      }
      try {
        await this.runLowStockAlertJob();
      } catch (e) {
        /* isolated */
      }
      try {
        await this.runReviewReminderJob();
      } catch (e) {
        /* isolated */
      }
    }, 6 * 60 * 60 * 1000);

    // Run once daily
    const daily = setInterval(async () => {
      try {
        await this.runIdempotencyPrunerJob();
      } catch (e) {
        /* isolated */
      }
    }, 24 * 60 * 60 * 1000);

    this.intervals.push(hourly, sixHourly, daily);
  }

  stop() {
    this.intervals.forEach((timer) => clearInterval(timer));
    this.intervals = [];
    this.isRunning = false;
    logger.info('[JobRunner] Background job schedulers stopped');
  }
}

module.exports = new JobRunner();
