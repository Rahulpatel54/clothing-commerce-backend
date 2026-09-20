'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();

module.exports = {
  byCustomer: { params: Joi.object({ id }) },
  addItem: { params: Joi.object({ id }), body: Joi.object({ productId: Joi.string().uuid().required() }) },
  removeItem: { params: Joi.object({ id, productId: Joi.string().uuid().required() }) },
};
