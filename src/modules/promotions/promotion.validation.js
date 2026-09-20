'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();

const ruleBody = Joi.object({
  ruleType: Joi.string().valid('PRODUCT_INCLUDE', 'PRODUCT_EXCLUDE', 'CATEGORY_INCLUDE', 'CATEGORY_EXCLUDE').required(),
  targetId: Joi.string().uuid().required(),
});

module.exports = {
  list: { query: Joi.object({ page: Joi.number().min(1), limit: Joi.number().min(1).max(100), isActive: Joi.boolean() }) },
  byId: { params: Joi.object({ id }) },
  create: {
    body: Joi.object({
      name: Joi.string().max(150).required(),
      description: Joi.string().max(500),
      type: Joi.string().valid('PERCENTAGE', 'FIXED').required(),
      value: Joi.number().min(0).required(),
      minOrderAmount: Joi.number().min(0),
      maxDiscountAmount: Joi.number().min(0).allow(null),
      startsAt: Joi.date().iso(),
      endsAt: Joi.date().iso(),
      isActive: Joi.boolean(),
      stackable: Joi.boolean(),
      firstOrderOnly: Joi.boolean(),
      customerId: Joi.string().uuid().allow(null),
      priority: Joi.number().integer(),
      rules: Joi.array().items(ruleBody).max(50),
    }),
  },
  update: {
    params: Joi.object({ id }),
    body: Joi.object({
      name: Joi.string().max(150), description: Joi.string().max(500), value: Joi.number().min(0),
      minOrderAmount: Joi.number().min(0), maxDiscountAmount: Joi.number().min(0).allow(null),
      startsAt: Joi.date().iso().allow(null), endsAt: Joi.date().iso().allow(null),
      isActive: Joi.boolean(), stackable: Joi.boolean(), firstOrderOnly: Joi.boolean(), priority: Joi.number().integer(),
    }).min(1),
  },
  createCoupon: {
    params: Joi.object({ id }),
    body: Joi.object({
      code: Joi.string().max(32).required(),
      usageLimit: Joi.number().integer().min(1).allow(null),
      usageLimitPerCustomer: Joi.number().integer().min(1).default(1),
      isActive: Joi.boolean(),
    }),
  },
  evaluate: {
    body: Joi.object({
      couponCode: Joi.string().max(32),
    }),
  },
};
