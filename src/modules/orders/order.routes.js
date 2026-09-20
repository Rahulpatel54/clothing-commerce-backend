'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./order.validation');
const controller = require('./order.controller');

const router = express.Router();
router.use(authenticate);

// Resolve the caller's customer id so a shopper only ever sees their own orders
// unless they hold the staff-level orders:read permission (checked in the controller).
router.use(async (req, res, next) => {
  try {
    // eslint-disable-next-line global-require
    const customerRepo = require('../customers/customer.repository');
    const customer = await customerRepo.findByUserId(req.user.id);
    req.customerId = customer ? customer.id : null;
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List orders (own orders for customers, any order for staff with orders:read)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Orders }
 */
router.get('/', validate(schema.list), controller.list);

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get one order (owner or staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Order }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', validate(schema.byId), controller.get);

/**
 * @openapi
 * /orders/{id}/status:
 *   patch:
 *     tags: [Orders]
 *     summary: Transition an order's status through the fulfilment state machine (staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Order status updated }
 *       409: { description: Invalid transition for the order's current status }
 */
router.patch('/:id/status', authorize('orders:update'), validate(schema.transition), controller.transition);

module.exports = router;
