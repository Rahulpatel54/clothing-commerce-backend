'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const healthService = require('./health.service');

const live = catchAsync(async (req, res) => success(res, { data: { status: 'ok' }, message: 'Service is live' }));

const ready = catchAsync(async (req, res) => {
  const report = await healthService.readiness();
  return success(res, {
    data: report,
    message: report.status === 'ok' ? 'Service is ready' : 'Service is degraded',
    statusCode: report.status === 'ok' ? 200 : 503,
  });
});

module.exports = { live, ready };
