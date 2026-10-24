'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();

module.exports = {
  submit: {
    body: Joi.object({
      orderId: id,
      productId: Joi.string().uuid(),
      platform: Joi.string().valid('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'PINTEREST', 'TWITTER', 'OTHER').required(),
      mediaType: Joi.string().valid('IMAGE', 'VIDEO', 'POST', 'STORY', 'REEL').required(),
      mediaUrl: Joi.string().uri().required(),
      postUrl: Joi.string().uri().allow('', null),
      caption: Joi.string().max(2000).allow('', null),
    }),
  },

  verify: {
    params: Joi.object({ id }),
    body: Joi.object({
      status: Joi.string().valid('APPROVED', 'REJECTED').required(),
      rewardAmount: Joi.number().positive().max(10000),
      rejectionReason: Joi.string().max(1000).allow('', null),
    }),
  },

  byId: {
    params: Joi.object({ id }),
  },

  listSubmissions: {
    query: Joi.object({
      customerId: Joi.string().uuid(),
      orderId: Joi.string().uuid(),
      status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED'),
      orderVerified: Joi.boolean(),
      adminVerified: Joi.boolean(),
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100),
    }),
  },

  listRewards: {
    query: Joi.object({
      customerId: Joi.string().uuid(),
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100),
    }),
  },
};
