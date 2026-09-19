'use strict';

const Joi = require('joi');
const ApiError = require('../utils/ApiError');

const SEGMENTS = ['params', 'query', 'body'];

/**
 * validate({ body, query, params }) -> express middleware.
 * Replaces the request segment with the validated (coerced, stripped) value,
 * so services never see unknown or unchecked fields.
 */
module.exports = (schemaMap) => (req, res, next) => {
  const details = [];

  for (const segment of SEGMENTS) {
    const schema = schemaMap[segment];
    if (!schema) continue;

    const { value, error } = Joi.compile(schema).validate(req[segment], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      error.details.forEach((d) => details.push({ segment, field: d.path.join('.'), message: d.message }));
    } else {
      req[segment] = value;
    }
  }

  if (details.length) return next(ApiError.validation('Request validation failed', details));
  return next();
};
