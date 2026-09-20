'use strict';

const express = require('express');
// Mounted at /customers/:id/wishlist by customer.routes.js, so { mergeParams: true }
// is required for req.params.id (the customer id) to reach this router.
const router = express.Router({ mergeParams: true });
const validate = require('../../middleware/validate');
const schema = require('./wishlist.validation');
const controller = require('./wishlist.controller');

/**
 * @openapi
 * /customers/{id}/wishlist:
 *   get:
 *     tags: [Wishlist]
 *     summary: List a customer's wishlist (owner or staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Wishlist items with product details }
 *   post:
 *     tags: [Wishlist]
 *     summary: Add a product to the wishlist (idempotent)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       201: { description: Added (or already present) }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/', validate(schema.byCustomer), controller.list);
router.post('/', validate(schema.addItem), controller.add);

/**
 * @openapi
 * /customers/{id}/wishlist/{productId}:
 *   delete:
 *     tags: [Wishlist]
 *     summary: Remove a product from the wishlist
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: productId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Removed }
 *       404: { description: Not on the wishlist }
 */
router.delete('/:productId', validate(schema.removeItem), controller.remove);

module.exports = router;
