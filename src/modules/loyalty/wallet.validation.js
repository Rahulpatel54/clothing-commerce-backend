'use strict';

const Joi = require('joi');

module.exports = {
  listTransactions: { query: Joi.object({ page: Joi.number().min(1), limit: Joi.number().min(1).max(100) }) },
  credit: {
    body: Joi.object({
      customerId: Joi.string().uuid().required(),
      type: Joi.string().valid('BIRTHDAY_CREDIT', 'CAMPAIGN_CREDIT', 'COMPENSATION_CREDIT', 'UGC_CREDIT').required(),
      amount: Joi.number().greater(0).required(),
      note: Joi.string().max(255),
      expiresInDays: Joi.number().integer().min(1),
    }),
  },
};
