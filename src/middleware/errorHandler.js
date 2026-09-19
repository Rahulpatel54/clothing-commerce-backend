'use strict';

const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError, DatabaseError } = require('sequelize');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config');

function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof UniqueConstraintError) {
    return ApiError.conflict(
      'Resource already exists',
      err.errors.map((e) => ({ field: e.path, message: `${e.path} must be unique` }))
    );
  }
  if (err instanceof ValidationError) {
    return ApiError.validation(
      'Database validation failed',
      err.errors.map((e) => ({ field: e.path, message: e.message }))
    );
  }
  if (err instanceof ForeignKeyConstraintError) {
    return ApiError.badRequest('Related resource does not exist');
  }
  if (err instanceof DatabaseError) {
    return new ApiError(500, 'Database error', { code: 'DB_ERROR', isOperational: false });
  }
  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON body');
  }

  return new ApiError(err.statusCode || 500, err.message || 'Internal server error', { isOperational: false });
}

// Central error handler: the only place that formats an error response.
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  const error = normalize(err);

  const logPayload = { err, requestId: req.id, statusCode: error.statusCode, path: req.originalUrl };
  if (error.statusCode >= 500 || !error.isOperational) logger.error(logPayload, error.message);
  else logger.warn(logPayload, error.message);

  const message = error.statusCode >= 500 && config.isProduction ? 'Internal server error' : error.message;

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message,
      ...(error.details ? { details: error.details } : {}),
    },
    requestId: req.id,
    ...(config.isProduction ? {} : { stack: error.stack }),
  });
};
