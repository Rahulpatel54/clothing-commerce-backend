'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./inventory.service');

const getStock = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /inventory/{variantId}:
   *   get:
   *     tags: [Inventory]
   *     summary: Current stock for a variant (physical, reserved, available)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: variantId, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Stock levels }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.getStock(req.params.variantId) });
});

const listMovements = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /inventory/movements:
   *   get:
   *     tags: [Inventory]
   *     summary: List stock movements (append-only ledger), optionally filtered by variant
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: variantId, schema: { type: string, format: uuid } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: Movements }
   */
  const { page, limit } = getPagination(req.query);
  const { rows, count } = await service.listMovements({ variantId: req.query.variantId, page, limit });
  return paginated(res, { rows, count, page, limit });
});

const receive = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /inventory/receive:
   *   post:
   *     tags: [Inventory]
   *     summary: Record a stock purchase/receipt (admin)
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [variantId, quantity]
   *             properties: { variantId: { type: string, format: uuid }, quantity: { type: integer, minimum: 1 }, note: { type: string } }
   *     responses:
   *       201: { description: Stock received }
   */
  return success(res, { data: service.present(await service.receivePurchase({ ...req.body, actorUserId: req.user.id })), message: 'Stock received', statusCode: 201 });
});

const damage = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /inventory/damage:
   *   post:
   *     tags: [Inventory]
   *     summary: Record damaged stock (admin)
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [variantId, quantity]
   *             properties: { variantId: { type: string, format: uuid }, quantity: { type: integer, minimum: 1 }, note: { type: string } }
   *     responses:
   *       200: { description: Damage recorded }
   *       409: { description: Cannot damage more units than are currently available }
   */
  return success(res, { data: service.present(await service.reportDamage({ ...req.body, actorUserId: req.user.id })), message: 'Damage recorded' });
});

const adjust = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /inventory/adjust:
   *   post:
   *     tags: [Inventory]
   *     summary: Manual stock count correction (admin)
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [variantId, delta]
   *             properties: { variantId: { type: string, format: uuid }, delta: { type: integer, description: "Positive or negative; cannot be zero" }, note: { type: string } }
   *     responses:
   *       200: { description: Stock adjusted }
   */
  return success(res, { data: service.present(await service.adjust({ ...req.body, actorUserId: req.user.id })), message: 'Stock adjusted' });
});

module.exports = { getStock, listMovements, receive, damage, adjust };
