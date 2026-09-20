'use strict';

const Joi = require('joi');

const variantId = Joi.string().uuid().required();

module.exports = {
  byVariant: { params: Joi.object({ variantId }) },
  movements: { query: Joi.object({ variantId: Joi.string().uuid(), page: Joi.number().min(1), limit: Joi.number().min(1).max(100) }) },
  receive: { body: Joi.object({ variantId, quantity: Joi.number().integer().min(1).required(), referenceType: Joi.string().max(50), referenceId: Joi.string().max(100), note: Joi.string().max(255) }) },
  damage: { body: Joi.object({ variantId, quantity: Joi.number().integer().min(1).required(), note: Joi.string().max(255) }) },
  adjust: { body: Joi.object({ variantId, delta: Joi.number().integer().invalid(0).required(), note: Joi.string().max(255) }) },
  reserveRelease: { body: Joi.object({ variantId, quantity: Joi.number().integer().min(1).required(), referenceType: Joi.string().max(50), referenceId: Joi.string().max(100) }) },
};
