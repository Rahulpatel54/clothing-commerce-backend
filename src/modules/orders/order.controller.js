'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./order.service');

const list = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /orders:
   *   get:
   *     tags: [Orders]
   *     summary: List orders (own orders for customers, any order for staff with orders:read)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: status, schema: { type: string, enum: [PENDING, CONFIRMED, PROCESSING, PACKED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURN_REQUESTED, RETURN_APPROVED, RETURNED, REFUNDED] } }
   *       - { in: query, name: customerId, schema: { type: string, format: uuid }, description: "Staff only; ignored for a customer caller, who always sees only their own orders" }
   *     responses:
   *       200: { description: Orders }
   */
  const { page, limit, offset } = getPagination(req.query);
  const isPrivileged = (req.user.permissions || []).includes('orders:read') || (req.user.roles || []).includes('admin');
  const filters = isPrivileged ? { status: req.query.status, customerId: req.query.customerId } : { status: req.query.status, customerId: req.customerId };
  const result = await service.list({ filters, page, limit, offset });
  return paginated(res, result);
});

const get = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /orders/{id}:
   *   get:
   *     tags: [Orders]
   *     summary: Get one order, including items and its status history (owner or staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Order }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.get(req, req.params.id) });
});

const transition = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /orders/{id}/status:
   *   patch:
   *     tags: [Orders]
   *     summary: Transition an order's status through the fulfilment state machine (staff)
   *     description: "Every valid edge is listed in order.transitions.js: PENDING→CONFIRMED→PROCESSING→PACKED→SHIPPED→OUT_FOR_DELIVERY→DELIVERED, PENDING/CONFIRMED/PROCESSING→CANCELLED, and DELIVERED→RETURN_REQUESTED→RETURN_APPROVED→RETURNED→REFUNDED. Anything else is rejected with 409."
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status: { type: string, enum: [PENDING, CONFIRMED, PROCESSING, PACKED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, RETURN_REQUESTED, RETURN_APPROVED, RETURNED, REFUNDED] }
   *               reason: { type: string }
   *     responses:
   *       200: { description: Order status updated }
   *       409: { description: Invalid transition for the order's current status }
   */
  return success(res, { data: await service.transition(req, req.params.id, req.body.status, req.body.reason), message: 'Order status updated' });
});

module.exports = { list, get, transition };
