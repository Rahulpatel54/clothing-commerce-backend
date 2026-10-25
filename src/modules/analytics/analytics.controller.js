'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./analytics.service');

/**
 * @openapi
 * /analytics/overview:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: High-level commerce analytics dashboard overview
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Overview analytics KPIs
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
const getOverview = catchAsync(async (req, res) => {
  const data = await service.getOverview(req.query);
  return success(res, { data });
});

/**
 * @openapi
 * /analytics/sales:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Detailed sales analytics (revenue, orders, AOV, conversion rate)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Sales metrics and conversion funnel
 */
const getSales = catchAsync(async (req, res) => {
  const data = await service.getSales(req.query);
  return success(res, { data });
});

/**
 * @openapi
 * /analytics/customers:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Customer acquisition, retention, and LTV metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Customer metrics
 */
const getCustomers = catchAsync(async (req, res) => {
  const data = await service.getCustomers(req.query);
  return success(res, { data });
});

/**
 * @openapi
 * /analytics/products:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Product performance, best sellers, gross margins, and variant popularity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Product analytics
 */
const getProducts = catchAsync(async (req, res) => {
  const data = await service.getProducts(req.query);
  return success(res, { data });
});

/**
 * @openapi
 * /analytics/marketing:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Marketing channel performance, referral conversions, and UGC volume
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Marketing performance metrics
 */
const getMarketing = catchAsync(async (req, res) => {
  const data = await service.getMarketing(req.query);
  return success(res, { data });
});

/**
 * @openapi
 * /analytics/operations:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Operational efficiency, return rates, cancellation rates, and stock velocity
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Operational metrics
 */
const getOperations = catchAsync(async (req, res) => {
  const data = await service.getOperations(req.query);
  return success(res, { data });
});

module.exports = {
  getOverview,
  getSales,
  getCustomers,
  getProducts,
  getMarketing,
  getOperations,
};
