'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./review.service');

const create = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews:
   *   post:
   *     tags: [Reviews]
   *     summary: Submit a product review for a delivered, non-returned purchase
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [variantId, rating, comment]
   *             properties:
   *               variantId: { type: string, format: uuid }
   *               rating: { type: integer, minimum: 1, maximum: 5 }
   *               title: { type: string }
   *               comment: { type: string }
   *               fit: { type: string, enum: [RUNS_SMALL, TRUE_TO_SIZE, RUNS_LARGE] }
   *               qualityRating: { type: integer, minimum: 1, maximum: 5 }
   *               images:
   *                 type: array
   *                 items: { type: string }
   *     responses:
   *       201: { description: Review created and pending moderation }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       409: { description: Duplicate review for variant }
   */
  const review = await service.create(req, req.body);
  return success(res, { statusCode: 201, data: review, message: 'Review submitted successfully' });
});

const list = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews:
   *   get:
   *     tags: [Reviews]
   *     summary: List reviews (public sees approved reviews; staff can filter by status)
   *     parameters:
   *       - { in: query, name: productId, schema: { type: string, format: uuid } }
   *       - { in: query, name: variantId, schema: { type: string, format: uuid } }
   *       - { in: query, name: customerId, schema: { type: string, format: uuid } }
   *       - { in: query, name: status, schema: { type: string, enum: [PENDING, APPROVED, REJECTED] } }
   *       - { in: query, name: rating, schema: { type: integer } }
   *       - { in: query, name: sort, schema: { type: string, enum: [recent, highest_rated, lowest_rated, most_helpful] } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: List of reviews }
   */
  const { page, limit } = getPagination(req.query);
  const { rows, count } = await service.list(req, { ...req.query, page, limit });
  return paginated(res, { rows, count, page, limit });
});

const get = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews/{id}:
   *   get:
   *     tags: [Reviews]
   *     summary: Get review by ID
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Review details }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const review = await service.get(req, req.params.id);
  return success(res, { data: review });
});

const update = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews/{id}:
   *   patch:
   *     tags: [Reviews]
   *     summary: Update a review (author or staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               rating: { type: integer, minimum: 1, maximum: 5 }
   *               title: { type: string }
   *               comment: { type: string }
   *               fit: { type: string, enum: [RUNS_SMALL, TRUE_TO_SIZE, RUNS_LARGE] }
   *               qualityRating: { type: integer, minimum: 1, maximum: 5 }
   *               images: { type: array, items: { type: string } }
   *     responses:
   *       200: { description: Review updated }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const review = await service.update(req, req.params.id, req.body);
  return success(res, { data: review, message: 'Review updated successfully' });
});

const remove = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews/{id}:
   *   delete:
   *     tags: [Reviews]
   *     summary: Delete a review (author or admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Review deleted }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const result = await service.remove(req, req.params.id);
  return success(res, { data: result, message: 'Review deleted successfully' });
});

const moderate = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews/{id}/moderation:
   *   patch:
   *     tags: [Reviews]
   *     summary: Moderate review status (admin/staff)
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
   *               status: { type: string, enum: [APPROVED, REJECTED] }
   *               moderationNote: { type: string }
   *     responses:
   *       200: { description: Review moderated }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const review = await service.moderate(req, req.params.id, req.body);
  return success(res, { data: review, message: `Review ${req.body.status.toLowerCase()}` });
});

const voteHelpful = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews/{id}/helpful:
   *   post:
   *     tags: [Reviews]
   *     summary: Vote a review as helpful
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Helpful vote recorded }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const review = await service.voteHelpful(req, req.params.id);
  return success(res, { data: review, message: 'Helpful vote recorded' });
});

const summary = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /reviews/summary:
   *   get:
   *     tags: [Reviews]
   *     summary: Rating, fit and quality breakdown summary for a product
   *     parameters: [{ in: query, name: productId, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Product reviews aggregate summary }
   */
  const stats = await service.getProductSummary(req.query.productId);
  return success(res, { data: stats });
});

module.exports = {
  create,
  list,
  get,
  update,
  remove,
  moderate,
  voteHelpful,
  summary,
};
