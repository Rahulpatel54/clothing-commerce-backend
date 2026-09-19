'use strict';

const ApiError = require('../utils/ApiError');

module.exports = (req, res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
