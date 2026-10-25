'use strict';

const Joi = require('joi');

const sendNotificationSchema = Joi.object({
  customerId: Joi.string().uuid().allow(null).optional(),
  type: Joi.string().valid(
    'ORDER_CONFIRMED',
    'PAYMENT_SUCCESS',
    'ORDER_SHIPPED',
    'ORDER_DELIVERED',
    'REWARD_EARNED',
    'REWARD_EXPIRING',
    'REFERRAL_SUCCESS',
    'BACK_IN_STOCK',
    'NEW_DROP',
    'LOW_STOCK_ALERT',
    'ABANDONED_CART',
    'REVIEW_REMINDER'
  ).required(),
  channel: Joi.string().valid('EMAIL', 'SMS', 'WHATSAPP', 'PUSH').required(),
  recipient: Joi.string().max(255).optional(),
  title: Joi.string().max(255).required(),
  body: Joi.string().required(),
  metadata: Joi.object().optional(),
  force: Joi.boolean().default(false),
});

const listNotificationsSchema = Joi.object({
  customerId: Joi.string().uuid().optional(),
  status: Joi.string().valid('PENDING', 'SENT', 'FAILED', 'CANCELLED').optional(),
  type: Joi.string().optional(),
  channel: Joi.string().valid('EMAIL', 'SMS', 'WHATSAPP', 'PUSH').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  sendNotificationSchema,
  listNotificationsSchema,
};
