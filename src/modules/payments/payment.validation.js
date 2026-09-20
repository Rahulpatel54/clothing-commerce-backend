'use strict';

const Joi = require('joi');

module.exports = {
  initiate: {
    params: Joi.object({ orderId: Joi.string().uuid().required() }),
    body: Joi.object({ method: Joi.string().max(30) }),
  },
  refund: {
    params: Joi.object({ paymentId: Joi.string().uuid().required() }),
    body: Joi.object({ amount: Joi.number().min(0.01), reason: Joi.string().max(255) }),
  },
};
