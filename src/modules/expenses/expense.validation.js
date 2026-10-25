'use strict';

const Joi = require('joi');

const idParam = Joi.object({
  id: Joi.string().uuid().required(),
});

const createCategory = {
  body: Joi.object({
    name: Joi.string().trim().max(100).required(),
    slug: Joi.string().trim().max(100).lowercase(),
    description: Joi.string().allow('', null),
    isActive: Joi.boolean(),
  }),
};

const updateCategory = {
  params: idParam,
  body: Joi.object({
    name: Joi.string().trim().max(100),
    slug: Joi.string().trim().max(100).lowercase(),
    description: Joi.string().allow('', null),
    isActive: Joi.boolean(),
  }).min(1),
};

const listCategories = {
  query: Joi.object({
    includeInactive: Joi.boolean().default(false),
  }),
};

const createExpense = {
  body: Joi.object({
    categoryId: Joi.string().uuid().required(),
    amount: Joi.number().positive().precision(2).required(),
    date: Joi.string().isoDate().required(),
    vendor: Joi.string().trim().max(255).allow('', null),
    paymentMethod: Joi.string().trim().max(50).allow('', null),
    description: Joi.string().allow('', null),
    receiptUrl: Joi.string().uri().max(1024).allow('', null),
    isRecurring: Joi.boolean().default(false),
    recurringRule: Joi.object().allow(null),
    status: Joi.string().valid('PENDING', 'APPROVED', 'PAID', 'CANCELLED').default('PENDING'),
  }),
};

const updateExpense = {
  params: idParam,
  body: Joi.object({
    categoryId: Joi.string().uuid(),
    amount: Joi.number().positive().precision(2),
    date: Joi.string().isoDate(),
    vendor: Joi.string().trim().max(255).allow('', null),
    paymentMethod: Joi.string().trim().max(50).allow('', null),
    description: Joi.string().allow('', null),
    receiptUrl: Joi.string().uri().max(1024).allow('', null),
    isRecurring: Joi.boolean(),
    recurringRule: Joi.object().allow(null),
    status: Joi.string().valid('PENDING', 'APPROVED', 'PAID', 'CANCELLED'),
  }).min(1),
};

const listExpenses = {
  query: Joi.object({
    categoryId: Joi.string().uuid(),
    status: Joi.string().valid('PENDING', 'APPROVED', 'PAID', 'CANCELLED'),
    vendor: Joi.string().trim(),
    isRecurring: Joi.boolean(),
    startDate: Joi.string().isoDate(),
    endDate: Joi.string().isoDate(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const getExpense = {
  params: idParam,
};

const deleteExpense = {
  params: idParam,
};

module.exports = {
  createCategory,
  updateCategory,
  listCategories,
  createExpense,
  updateExpense,
  listExpenses,
  getExpense,
  deleteExpense,
};
