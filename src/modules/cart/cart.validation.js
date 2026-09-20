'use strict';

const Joi = require('joi');

module.exports = {
  addItem: { body: Joi.object({ variantId: Joi.string().uuid().required(), quantity: Joi.number().integer().min(1).max(50).default(1) }) },
  updateItem: { params: Joi.object({ variantId: Joi.string().uuid().required() }), body: Joi.object({ quantity: Joi.number().integer().min(0).max(50).required() }) },
  removeItem: { params: Joi.object({ variantId: Joi.string().uuid().required() }) },
};
