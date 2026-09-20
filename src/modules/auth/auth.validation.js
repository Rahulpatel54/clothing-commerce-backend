'use strict';

const Joi = require('joi');

const password = Joi.string()
  .min(8).max(128)
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/\d/, 'digit')
  .required()
  .messages({ 'string.pattern.name': 'password must contain at least one {#name} character' });

const email = Joi.string().email().max(255).lowercase().trim().required();

module.exports = {
  register: {
    body: Joi.object({
      email, password,
      firstName: Joi.string().max(100).trim(),
      lastName: Joi.string().max(100).trim(),
      phone: Joi.string().max(20).pattern(/^[0-9+\-\s()]+$/),
      referralCode: Joi.string().max(32),
    }),
  },
  login: { body: Joi.object({ email, password: Joi.string().max(128).required() }) },
  refresh: { body: Joi.object({ refreshToken: Joi.string().max(512).required() }) },
  logout: { body: Joi.object({ refreshToken: Joi.string().max(512).required() }) },
  requestPasswordReset: { body: Joi.object({ email }) },
  confirmPasswordReset: { body: Joi.object({ token: Joi.string().max(512).required(), password }) },
};
