'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().min(1), limit: Joi.number().min(1).max(100),
      status: Joi.string().valid('PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED'),
      customerId: Joi.string().uuid(),
    }),
  },
  byId: { params: Joi.object({ id }) },
  transition: {
    params: Joi.object({ id }),
    body: Joi.object({
      status: Joi.string().valid('PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNED', 'REFUNDED').required(),
      reason: Joi.string().max(255),
    }),
  },
};
