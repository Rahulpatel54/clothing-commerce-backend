'use strict';

const Joi = require('joi');

module.exports = {
  checkout: {
    body: Joi.object({
      addressId: Joi.string().uuid().required(),
      couponCode: Joi.string().max(32),
      useWalletBalance: Joi.boolean().default(false),
    }),
  },
};
