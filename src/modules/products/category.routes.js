'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./product.validation');
const { categories } = require('./taxonomy.controller');

const router = express.Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     tags: [Catalog]
 *     summary: List categories (public)
 *     parameters: [{ in: query, name: includeInactive, schema: { type: boolean } }]
 *     responses:
 *       200: { description: Categories }
 *   post:
 *     tags: [Catalog]
 *     summary: Create a category (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Category created }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', validate(schema.taxonomyList), categories.list);
router.post('/', authenticate, authorize('products:create'), validate(schema.categoryCreate), categories.create);

/**
 * @openapi
 * /categories/{slug}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get one category by slug (public)
 *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Category }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:slug', validate(schema.taxonomyBySlug), categories.getBySlug);

/**
 * @openapi
 * /categories/{id}:
 *   patch:
 *     tags: [Catalog]
 *     summary: Update a category (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Category updated }
 *   delete:
 *     tags: [Catalog]
 *     summary: Delete a category; refuses while children or products still point at it
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Category deleted }
 *       409: { description: Still referenced }
 */
router.patch('/:id', authenticate, authorize('products:update'), validate(schema.categoryUpdate), categories.update);
router.delete('/:id', authenticate, authorize('products:delete'), validate(schema.byId), categories.remove);

module.exports = router;