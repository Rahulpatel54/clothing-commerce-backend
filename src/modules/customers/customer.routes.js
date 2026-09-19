'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./customer.validation');
const controller = require('./customer.controller');

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: List customers with derived spend statistics (staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: tag, schema: { type: string } }
 *       - { in: query, name: minSpend, schema: { type: number } }
 *       - { in: query, name: sort, schema: { type: string, enum: [createdAt, totalSpend, orderCount, lastPurchaseAt] } }
 *     responses:
 *       200: { description: Paginated customers }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', authorize('customers:read'), validate(schema.list), controller.list);

/**
 * @openapi
 * /customers/me:
 *   get:
 *     tags: [Customers]
 *     summary: The signed-in customer's own profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Customer profile with stats and addresses }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/me', controller.me);

/**
 * @openapi
 * /customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get a customer (owner or staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Customer }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   patch:
 *     tags: [Customers]
 *     summary: Update profile fields (owner or staff). Spend stats are read-only.
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Customer updated }
 */
router.get('/:id', validate(schema.byId), controller.get);
router.patch('/:id', validate(schema.update), controller.update);

/**
 * @openapi
 * /customers/{id}/marketing-preferences:
 *   put:
 *     tags: [Customers]
 *     summary: Set channel opt-ins; turning all of them off records an opt-out timestamp
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Preferences updated }
 */
router.put('/:id/marketing-preferences', validate(schema.marketing), controller.marketing);

/**
 * @openapi
 * /customers/{id}/addresses:
 *   get:
 *     tags: [Customers]
 *     summary: List addresses (owner or staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Addresses }
 *   post:
 *     tags: [Customers]
 *     summary: Add an address; the first one becomes the default for shipping and billing
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       201: { description: Address added }
 */
router.get('/:id/addresses', validate(schema.listAddresses), controller.listAddresses);
router.post('/:id/addresses', validate(schema.addAddress), controller.addAddress);

/**
 * @openapi
 * /customers/{id}/addresses/{addressId}:
 *   patch:
 *     tags: [Customers]
 *     summary: Update an address (owner or staff)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: addressId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Address updated }
 *   delete:
 *     tags: [Customers]
 *     summary: Remove an address; a remaining address inherits the default flags
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: addressId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Address removed }
 */
router.patch('/:id/addresses/:addressId', validate(schema.updateAddress), controller.updateAddress);
router.delete('/:id/addresses/:addressId', validate(schema.removeAddress), controller.removeAddress);

module.exports = router;