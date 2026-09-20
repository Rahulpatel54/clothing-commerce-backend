'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();

const addressBody = {
  label: Joi.string().max(50),
  recipientName: Joi.string().max(150).required(),
  phone: Joi.string().max(20).required(),
  line1: Joi.string().max(255).required(),
  line2: Joi.string().max(255).allow(null, ''),
  landmark: Joi.string().max(150).allow(null, ''),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).required(),
  postalCode: Joi.string().max(20).required(),
  country: Joi.string().length(2).uppercase().default('IN'),
  isDefaultShipping: Joi.boolean(),
  isDefaultBilling: Joi.boolean(),
};

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().min(1),
      limit: Joi.number().min(1).max(100),
      search: Joi.string().max(120).trim(),
      tag: Joi.string().max(50),
      acquisitionSource: Joi.string().max(50),
      minSpend: Joi.number().min(0),
      sort: Joi.string().valid('createdAt', 'totalSpend', 'orderCount', 'lastPurchaseAt').default('createdAt'),
      order: Joi.string().valid('ASC', 'DESC').default('DESC'),
    }),
  },
  byId: { params: Joi.object({ id }) },
  update: {
    params: Joi.object({ id }),
    body: Joi.object({
      dateOfBirth: Joi.date().iso().less('now'),
      gender: Joi.string().max(20),
      acquisitionSource: Joi.string().max(50),
      notes: Joi.string().max(2000),
      tags: Joi.array().items(Joi.string().max(50)).max(20),
    }).min(1),
  },
  marketing: {
    params: Joi.object({ id }),
    body: Joi.object({
      marketingEmail: Joi.boolean().required(),
      marketingSms: Joi.boolean().required(),
      marketingWhatsapp: Joi.boolean().required(),
    }),
  },
  listAddresses: { params: Joi.object({ id }) },
  addAddress: { params: Joi.object({ id }), body: Joi.object(addressBody) },
  updateAddress: {
    params: Joi.object({ id, addressId: Joi.string().uuid().required() }),
    body: Joi.object({ ...addressBody, recipientName: Joi.string().max(150), phone: Joi.string().max(20), line1: Joi.string().max(255), city: Joi.string().max(100), state: Joi.string().max(100), postalCode: Joi.string().max(20) }).min(1),
  },
  removeAddress: { params: Joi.object({ id, addressId: Joi.string().uuid().required() }) },
};
