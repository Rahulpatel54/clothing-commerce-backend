'use strict';

const Joi = require('joi');

const idParam = Joi.object({
  id: Joi.string().uuid().required(),
});

const pnlReport = {
  query: Joi.object({
    startDate: Joi.string().isoDate(),
    endDate: Joi.string().isoDate(),
  }),
};

const traceRecords = {
  params: Joi.object({
    type: Joi.string().valid('orders', 'expenses').required(),
  }),
  query: Joi.object({
    startDate: Joi.string().isoDate(),
    endDate: Joi.string().isoDate(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const createPeriod = {
  body: Joi.object({
    name: Joi.string().trim().max(100).required(),
    startDate: Joi.string().isoDate().required(),
    endDate: Joi.string().isoDate().required(),
  }),
};

const listPeriods = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const closePeriod = {
  params: idParam,
};

module.exports = {
  pnlReport,
  traceRecords,
  createPeriod,
  listPeriods,
  closePeriod,
};
