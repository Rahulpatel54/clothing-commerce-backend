'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./product.validation');
const { collections } = require('./taxonomy.controller');

const router = express.Router();

/**
 * @openapi
 * /collections:
 *   get:
 *     tags: [Catalog]
 *     summary: List collections (public)
 *     responses:
 *       200: { description: Collections }
 *   post:
 *     tags: [Catalog]
 *     summary: Create a collection (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Collection created }
 */
router.get('/', validate(schema.taxonomyList), collections.list);
router.post('/', authenticate, authorize('products:create'), validate(schema.collectionCreate), collections.create);

/**
 * @openapi
 * /collections/{slug}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get one collection by slug (public)
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Collection }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:slug', validate(schema.taxonomyBySlug), collections.getBySlug);

/**
 * @openapi
 * /collections/{id}:
 *   patch:
 *     tags: [Catalog]
 *     summary: Update a collection (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Collection updated }
 *   delete:
 *     tags: [Catalog]
 *     summary: Delete a collection (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Collection deleted }
 */
router.patch('/:id', authenticate, authorize('products:update'), validate(schema.collectionUpdate), collections.update);
router.delete('/:id', authenticate, authorize('products:delete'), validate(schema.byId), collections.remove);

module.exports = router;