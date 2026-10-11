'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const { collections } = require('./taxonomy.service');

const list = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /collections:
   *   get:
   *     tags: [Catalog]
   *     summary: List collections (public)
   *     parameters: [{ in: query, name: includeInactive, schema: { type: boolean } }]
   *     responses:
   *       200: { description: Collections }
   */
  return success(res, { data: await collections.list(req.query) });
});

const getBySlug = catchAsync(async (req, res) => {
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
  return success(res, { data: await collections.getBySlug(req.params.slug) });
});

const create = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /collections:
   *   post:
   *     tags: [Catalog]
   *     summary: Create a collection (admin)
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
   *               imageUrl: { type: string, format: uri }
   *               startsAt: { type: string, format: date-time }
   *               endsAt: { type: string, format: date-time }
   *     responses:
   *       201: { description: Collection created }
   */
  return success(res, { data: await collections.create(req, req.body), message: 'Collection created', statusCode: 201 });
});

const update = catchAsync(async (req, res) => {
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
   */
  return success(res, { data: await collections.update(req, req.params.id, req.body), message: 'Collection updated' });
});

const remove = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /collections/{id}:
   *   delete:
   *     tags: [Catalog]
   *     summary: Delete a collection (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Collection deleted }
   */
  return success(res, { data: await collections.remove(req, req.params.id), message: 'Collection deleted' });
});

module.exports = { list, getBySlug, create, update, remove };
