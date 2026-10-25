'use strict';

const Joi = require('joi');

const dateRange = {
  query: Joi.object({
    startDate: Joi.string().isoDate(),
    endDate: Joi.string().isoDate(),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

module.exports = {
  dateRange,
};
