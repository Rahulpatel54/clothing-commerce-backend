'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const service = require('./finance.service');

/**
 * @openapi
 * /finance/pnl:
 *   get:
 *     tags:
 *       - Finance
 *     summary: Generate Profit & Loss (P&L) financial report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-10-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-10-31"
 *     responses:
 *       200:
 *         description: Financial P&L statement
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
const getPnL = catchAsync(async (req, res) => {
  const report = await service.getPnLReport(req.query);
  return success(res, { data: report });
});

/**
 * @openapi
 * /finance/trace/{type}:
 *   get:
 *     tags:
 *       - Finance
 *     summary: Trace supporting source records for financial statements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [orders, expenses]
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated source records
 */
const getTraceRecords = catchAsync(async (req, res) => {
  const result = await service.getTraceRecords(req.params.type, req.query);
  return paginated(res, result);
});

/**
 * @openapi
 * /finance/periods:
 *   post:
 *     tags:
 *       - Finance
 *     summary: Define a financial accounting period
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - startDate
 *               - endDate
 *             properties:
 *               name:
 *                 type: string
 *                 example: "FY2026-Q4"
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-10-01"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-31"
 *     responses:
 *       201:
 *         description: Financial period created
 *       409:
 *         description: Period name conflict
 */
const createPeriod = catchAsync(async (req, res) => {
  const period = await service.createPeriod(req, req.body);
  return success(res, { data: period, message: 'Financial period created', statusCode: 201 });
});

/**
 * @openapi
 * /finance/periods:
 *   get:
 *     tags:
 *       - Finance
 *     summary: List financial periods
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated financial periods
 */
const listPeriods = catchAsync(async (req, res) => {
  const result = await service.listPeriods(req.query);
  return paginated(res, result);
});

/**
 * @openapi
 * /finance/periods/{id}/close:
 *   post:
 *     tags:
 *       - Finance
 *     summary: Close an accounting period (locks expenses from modifications)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Financial period closed
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Period is already closed
 */
const closePeriod = catchAsync(async (req, res) => {
  const period = await service.closePeriod(req, req.params.id);
  return success(res, { data: period, message: 'Financial period closed successfully' });
});

module.exports = {
  getPnL,
  getTraceRecords,
  createPeriod,
  listPeriods,
  closePeriod,
};
