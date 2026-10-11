'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const healthService = require('./health.service');

const live = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /health/live:
   *   get:
   *     tags: [Health]
   *     summary: Liveness probe
   *     description: Returns 200 as long as the Node process is up. Does not touch the database.
   *     responses:
   *       200:
   *         description: Service process is running
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/SuccessResponse' }
   */
  return success(res, { data: { status: 'ok' }, message: 'Service is live' });
});

const ready = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /health/ready:
   *   get:
   *     tags: [Health]
   *     summary: Readiness probe (checks database and optional dependencies)
   *     description: Returns 503 when a dependency (database, or Redis if enabled) is unreachable, so orchestrators know not to route traffic here yet.
   *     responses:
   *       200: { description: All dependencies reachable }
   *       503: { description: One or more dependencies are down }
   */
  const report = await healthService.readiness();
  return success(res, {
    data: report,
    message: report.status === 'ok' ? 'Service is ready' : 'Service is degraded',
    statusCode: report.status === 'ok' ? 200 : 503,
  });
});

module.exports = { live, ready };
