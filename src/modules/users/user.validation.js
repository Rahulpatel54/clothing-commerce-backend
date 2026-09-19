'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();
const roles = Joi.array().items(Joi.string().max(50)).min(1).max(10);

module.exports = {
  list: {
    query: Joi.object({
      page: Joi.number().min(1),
      limit: Joi.number().min(1).max(100),
      search: Joi.string().max(120).trim(),
      status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'),
      role: Joi.string().max(50),
      sort: Joi.string().valid('createdAt', 'email', 'lastLoginAt').default('createdAt'),
      order: Joi.string().valid('ASC', 'DESC').default('DESC'),
    }),
  },
  byId: { params: Joi.object({ id }) },
  create: {
    body: Joi.object({
      email: Joi.string().email().max(255).lowercase().trim().required(),
      password: Joi.string().min(8).max(128).required(),
      firstName: Joi.string().max(100).trim(),
      lastName: Joi.string().max(100).trim(),
      phone: Joi.string().max(20),
      status: Joi.string().valid('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION'),
      roles,
    }),
  },
  update: {
    params: Joi.object({ id }),
    body: Joi.object({
      firstName: Joi.string().max(100).trim(),
      lastName: Joi.string().max(100).trim(),
      phone: Joi.string().max(20).allow(null),
    }).min(1),
  },
  changeStatus: {
    params: Joi.object({ id }),
    body: Joi.object({
      status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION').required(),
      reason: Joi.string().max(255),
    }),
  },
  assignRoles: { params: Joi.object({ id }), body: Joi.object({ roles: roles.required() }) },
};