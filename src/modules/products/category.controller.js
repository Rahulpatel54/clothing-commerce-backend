'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const { categories } = require('./taxonomy.service');

// Thin, explicit wrapper around the shared taxonomy.service so each endpoint can
// carry its own accurate @openapi path — categories and collections share the
// same CRUD shape under the hood, but they are different resources to a caller.
const list = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /categories:
   *   get:
   *     tags: [Catalog]
   *     summary: List categories (public)
   *     parameters: [{ in: query, name: includeInactive, schema: { type: boolean } }]
   *     responses:
   *       200: { description: Categories }
   */
  return success(res, { data: await categories.list(req.query) });
});

const getBySlug = catchAsync(async (req, res) => {
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
  return success(res, { data: await categories.getBySlug(req.params.slug) });
});

const create = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /categories:
   *   post:
   *     tags: [Catalog]
   *     summary: Create a category (admin)
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name: { type: string }
   *               parentId: { type: string, format: uuid, nullable: true }
   *               imageUrl: { type: string, format: uri }
   *               position: { type: integer }
   *     responses:
   *       201: { description: Category created }
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  return success(res, { data: await categories.create(req, req.body), message: 'Category created', statusCode: 201 });
});

const update = catchAsync(async (req, res) => {
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
   */
  return success(res, { data: await categories.update(req, req.params.id, req.body), message: 'Category updated' });
});

const remove = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /categories/{id}:
   *   delete:
   *     tags: [Catalog]
   *     summary: Delete a category; refuses while child categories or products still point at it
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Category deleted }
   *       409: { description: Still referenced by child categories or products }
   */
  return success(res, { data: await categories.remove(req, req.params.id), message: 'Category deleted' });
});

module.exports = { list, getBySlug, create, update, remove };
