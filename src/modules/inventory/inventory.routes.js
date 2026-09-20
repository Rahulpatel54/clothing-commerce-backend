'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./inventory.validation');
const controller = require('./inventory.controller');

const router = express.Router();
router.use(authenticate, authorize('inventory:read'));

/**
 * @openapi
 * /inventory/movements:
 *   get:
 *     tags: [Inventory]
 *     summary: List stock movements (append-only ledger), optionally filtered by variant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Movements }
 */
router.get('/movements', validate(schema.movements), controller.listMovements);

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
router.get('/:variantId', validate(schema.byVariant), controller.getStock);

/**
 * @openapi
 * /inventory/receive:
 *   post:
 *     tags: [Inventory]
 *     summary: Record a stock purchase/receipt (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Stock received }
 */
router.post('/receive', authorize('inventory:create'), validate(schema.receive), controller.receive);

/**
 * @openapi
 * /inventory/damage:
 *   post:
 *     tags: [Inventory]
 *     summary: Record damaged stock (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Damage recorded }
 */
router.post('/damage', authorize('inventory:update'), validate(schema.damage), controller.damage);

/**
 * @openapi
 * /inventory/adjust:
 *   post:
 *     tags: [Inventory]
 *     summary: Manual stock count correction (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Stock adjusted }
 */
router.post('/adjust', authorize('inventory:update'), validate(schema.adjust), controller.adjust);

module.exports = router;
