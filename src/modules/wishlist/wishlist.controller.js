'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./wishlist.service');

const list = catchAsync(async (req, res) => {
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
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  return success(res, { data: await service.list(req, req.params.id) });
});

const add = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /customers/{id}/wishlist:
   *   post:
   *     tags: [Wishlist]
   *     summary: Add a product to the wishlist (idempotent — re-adding an existing item just returns it)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object, required: [productId], properties: { productId: { type: string, format: uuid } } }
   *     responses:
   *       201: { description: Added (or already present) }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.add(req, req.params.id, req.body.productId), message: 'Added to wishlist', statusCode: 201 });
});

const remove = catchAsync(async (req, res) => {
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
  return success(res, { data: await service.remove(req, req.params.id, req.params.productId), message: 'Removed from wishlist' });
});

module.exports = { list, add, remove };
