'use strict';

const repo = require('./notification.repository');
const emailChannel = require('./channels/email.channel');
const smsChannel = require('./channels/sms.channel');
const whatsappChannel = require('./channels/whatsapp.channel');
const pushChannel = require('./channels/push.channel');
const eventBus = require('./event.bus');
const audit = require('../audit/audit.service');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const config = require('../../config');

const MARKETING_TYPES = new Set(['BACK_IN_STOCK', 'NEW_DROP', 'ABANDONED_CART', 'REVIEW_REMINDER']);

const CHANNEL_ADAPTERS = {
  EMAIL: emailChannel,
  SMS: smsChannel,
  WHATSAPP: whatsappChannel,
  PUSH: pushChannel,
};

class NotificationService {
  constructor() {
    this.registerDomainEvents();
  }

  isMarketing(type) {
    return MARKETING_TYPES.has(type);
  }

  async sendNotification({
    customerId = null,
    type,
    channel,
    recipient,
    title,
    body,
    metadata = {},
    force = false,
  }) {
    if (!CHANNEL_ADAPTERS[channel]) {
      throw ApiError.badRequest(`Unsupported channel: ${channel}`);
    }

    let customer = null;
    if (customerId) {
      customer = await repo.findCustomerWithUser(customerId);
    }

    // Resolve recipient if omitted but customer is provided
    let finalRecipient = recipient;
    if (!finalRecipient && customer && customer.user) {
      if (channel === 'EMAIL') finalRecipient = customer.user.email;
      if (channel === 'SMS' || channel === 'WHATSAPP') finalRecipient = customer.user.phone;
    }

    if (!finalRecipient) {
      throw ApiError.badRequest(`Recipient is required for channel ${channel}`);
    }

    // Check marketing opt-in compliance
    if (!force && this.isMarketing(type) && customer) {
      if (customer.marketingOptOutAt) {
        return repo.create({
          customerId,
          type,
          channel,
          recipient: finalRecipient,
          title,
          body,
          metadata,
          status: 'CANCELLED',
          errorMessage: 'Customer has opted out of all marketing communications',
        });
      }
      if (channel === 'EMAIL' && !customer.marketingEmail) {
        return repo.create({
          customerId,
          type,
          channel,
          recipient: finalRecipient,
          title,
          body,
          metadata,
          status: 'CANCELLED',
          errorMessage: 'Customer opted out of marketing emails',
        });
      }
      if (channel === 'SMS' && !customer.marketingSms) {
        return repo.create({
          customerId,
          type,
          channel,
          recipient: finalRecipient,
          title,
          body,
          metadata,
          status: 'CANCELLED',
          errorMessage: 'Customer opted out of marketing SMS',
        });
      }
      if (channel === 'WHATSAPP' && !customer.marketingWhatsapp) {
        return repo.create({
          customerId,
          type,
          channel,
          recipient: finalRecipient,
          title,
          body,
          metadata,
          status: 'CANCELLED',
          errorMessage: 'Customer opted out of marketing WhatsApp',
        });
      }
    }

    const notification = await repo.create({
      customerId,
      type,
      channel,
      recipient: finalRecipient,
      title,
      body,
      metadata,
      status: 'PENDING',
    });

    try {
      const adapter = CHANNEL_ADAPTERS[channel];
      const result = await adapter.send({ recipient: finalRecipient, title, body, metadata });
      return repo.update(notification.id, {
        status: 'SENT',
        sentAt: new Date(),
        metadata: { ...metadata, deliveryResult: result },
      });
    } catch (err) {
      logger.error({ err, notificationId: notification.id }, 'Notification delivery failed');
      return repo.update(notification.id, {
        status: 'FAILED',
        errorMessage: err.message,
      });
    }
  }

  async listNotifications(req, filters) {
    const isStaff = req.user && (req.user.roles?.includes('admin') || req.user.roles?.includes('staff'));
    if (!isStaff) {
      // Must be customer scoped
      filters.customerId = req.user.customerId;
    }
    return repo.list(filters);
  }

  async getNotificationById(req, id) {
    const notification = await repo.findById(id);
    if (!notification) throw ApiError.notFound('Notification not found');

    const isStaff = req.user && (req.user.roles?.includes('admin') || req.user.roles?.includes('staff'));
    if (!isStaff && notification.customerId !== req.user.customerId) {
      throw ApiError.forbidden('Access to notification denied');
    }

    return notification;
  }

  async retryNotification(req, id) {
    const notification = await repo.findById(id);
    if (!notification) throw ApiError.notFound('Notification not found');
    if (notification.status === 'SENT') throw ApiError.conflict('Notification has already been sent');
    if (notification.status === 'CANCELLED') throw ApiError.conflict('Cannot retry a cancelled notification');

    const adapter = CHANNEL_ADAPTERS[notification.channel];
    if (!adapter) throw ApiError.badRequest(`Unknown channel ${notification.channel}`);

    try {
      const result = await adapter.send({
        recipient: notification.recipient,
        title: notification.title,
        body: notification.body,
        metadata: notification.metadata,
      });

      const updated = await repo.update(notification.id, {
        status: 'SENT',
        sentAt: new Date(),
        errorMessage: null,
        metadata: { ...notification.metadata, retryResult: result },
      });

      await audit.record(req, {
        action: 'notification.retry',
        entityType: 'Notification',
        entityId: id,
        after: { status: 'SENT' },
      });

      return updated;
    } catch (err) {
      await repo.update(notification.id, {
        status: 'FAILED',
        errorMessage: err.message,
      });
      throw err;
    }
  }

  registerDomainEvents() {
    eventBus.on('ORDER_CONFIRMED', async (payload) => {
      try {
        const { order, customer } = payload;
        await this.sendNotification({
          customerId: customer?.id || order.customerId,
          type: 'ORDER_CONFIRMED',
          channel: 'EMAIL',
          recipient: customer?.user?.email || order.shippingAddress?.email,
          title: `Order Confirmed: ${order.orderNumber}`,
          body: `Thank you for your order! Your total is ${order.grandTotal}. We are preparing your shipment.`,
          metadata: { orderId: order.id, orderNumber: order.orderNumber },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling ORDER_CONFIRMED notification');
      }
    });

    eventBus.on('PAYMENT_SUCCESS', async (payload) => {
      try {
        const { payment, order, customer } = payload;
        await this.sendNotification({
          customerId: customer?.id || order?.customerId,
          type: 'PAYMENT_SUCCESS',
          channel: 'EMAIL',
          recipient: customer?.user?.email,
          title: `Payment Received: ${payment.amount} ${payment.currency}`,
          body: `We have received your payment of ${payment.amount} ${payment.currency} for order ${order?.orderNumber || ''}.`,
          metadata: { paymentId: payment.id, orderId: order?.id },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling PAYMENT_SUCCESS notification');
      }
    });

    eventBus.on('ORDER_SHIPPED', async (payload) => {
      try {
        const { order, customer, trackingNumber, trackingUrl } = payload;
        await this.sendNotification({
          customerId: customer?.id || order.customerId,
          type: 'ORDER_SHIPPED',
          channel: 'EMAIL',
          recipient: customer?.user?.email,
          title: `Order Shipped: ${order.orderNumber}`,
          body: `Your order has been shipped! Tracking number: ${trackingNumber || 'N/A'}. Track here: ${trackingUrl || 'N/A'}.`,
          metadata: { orderId: order.id, trackingNumber },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling ORDER_SHIPPED notification');
      }
    });

    eventBus.on('ORDER_DELIVERED', async (payload) => {
      try {
        const { order, customer } = payload;
        await this.sendNotification({
          customerId: customer?.id || order.customerId,
          type: 'ORDER_DELIVERED',
          channel: 'EMAIL',
          recipient: customer?.user?.email,
          title: `Order Delivered: ${order.orderNumber}`,
          body: `Your order has been delivered! We hope you love your new clothes.`,
          metadata: { orderId: order.id },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling ORDER_DELIVERED notification');
      }
    });

    eventBus.on('REWARD_EARNED', async (payload) => {
      try {
        const { customer, amount, reason } = payload;
        await this.sendNotification({
          customerId: customer.id,
          type: 'REWARD_EARNED',
          channel: 'EMAIL',
          recipient: customer.user?.email,
          title: `You earned ${amount} reward points!`,
          body: `Great news! You earned ${amount} reward points for ${reason || 'your loyalty'}.`,
          metadata: { amount, reason },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling REWARD_EARNED notification');
      }
    });

    eventBus.on('REWARD_EXPIRING', async (payload) => {
      try {
        const { customer, amount, expiresAt } = payload;
        await this.sendNotification({
          customerId: customer.id,
          type: 'REWARD_EXPIRING',
          channel: 'EMAIL',
          recipient: customer.user?.email,
          title: `Reminder: ${amount} points are expiring soon`,
          body: `You have ${amount} points expiring on ${new Date(expiresAt).toLocaleDateString()}. Use them before they expire!`,
          metadata: { amount, expiresAt },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling REWARD_EXPIRING notification');
      }
    });

    eventBus.on('REFERRAL_SUCCESS', async (payload) => {
      try {
        const { referrer, refereeName, rewardAmount } = payload;
        await this.sendNotification({
          customerId: referrer.id,
          type: 'REFERRAL_SUCCESS',
          channel: 'EMAIL',
          recipient: referrer.user?.email,
          title: `Referral Reward: ${rewardAmount} points added!`,
          body: `Your friend ${refereeName || 'A friend'} made their first purchase using your referral code. You earned ${rewardAmount} points!`,
          metadata: { rewardAmount },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling REFERRAL_SUCCESS notification');
      }
    });

    eventBus.on('LOW_STOCK_ALERT', async (payload) => {
      try {
        const { product, variant, availableQty, threshold } = payload;
        await this.sendNotification({
          customerId: null,
          type: 'LOW_STOCK_ALERT',
          channel: 'EMAIL',
          recipient: config.seed.adminEmail,
          title: `Low Stock Alert: ${product?.name || product?.title || 'Variant'} (${variant?.sku || 'SKU'})`,
          body: `SKU ${variant?.sku} has reached low stock: ${availableQty} units remaining (threshold: ${threshold}).`,
          metadata: { variantId: variant?.id, productId: product?.id, availableQty, threshold },
          force: true,
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling LOW_STOCK_ALERT notification');
      }
    });

    eventBus.on('ABANDONED_CART', async (payload) => {
      try {
        const { customer, cartId, itemsCount } = payload;
        await this.sendNotification({
          customerId: customer.id,
          type: 'ABANDONED_CART',
          channel: 'EMAIL',
          recipient: customer.user?.email,
          title: 'You left something behind in your shopping bag!',
          body: `You have ${itemsCount} items waiting in your bag. Complete your checkout before items sell out!`,
          metadata: { cartId, itemsCount },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling ABANDONED_CART notification');
      }
    });

    eventBus.on('REVIEW_REMINDER', async (payload) => {
      try {
        const { customer, order } = payload;
        await this.sendNotification({
          customerId: customer.id,
          type: 'REVIEW_REMINDER',
          channel: 'EMAIL',
          recipient: customer.user?.email,
          title: 'How did your clothes fit? Leave a review and earn points!',
          body: `We hope you are enjoying your order ${order.orderNumber}. Share your feedback and photos to earn reward points.`,
          metadata: { orderId: order.id },
        });
      } catch (err) {
        logger.error({ err }, 'Failed handling REVIEW_REMINDER notification');
      }
    });
  }
}

module.exports = new NotificationService();
