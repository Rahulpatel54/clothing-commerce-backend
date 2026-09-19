'use strict';

class ApiError extends Error {
  constructor(statusCode, message, { code, details, isOperational = true } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || ApiError.defaultCode(statusCode);
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static defaultCode(statusCode) {
    return {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
    }[statusCode] || 'ERROR';
  }

  static badRequest(msg, details) { return new ApiError(400, msg, { details }); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, msg); }
  static forbidden(msg = 'Not allowed') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg, details) { return new ApiError(409, msg, { details }); }
  static validation(msg, details) { return new ApiError(422, msg, { code: 'VALIDATION_ERROR', details }); }
  static internal(msg = 'Internal server error') { return new ApiError(500, msg, { isOperational: false }); }
}

module.exports = ApiError;
