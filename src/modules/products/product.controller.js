'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./product.service');

const viewerContext = (req) => ({ customerId: req.user ? req.user.id : null, sessionId: req.headers['x-session-id'] || null });

const toFilters = (query) => ({
  search: query.q, categoryId: query.categoryId, size: query.size, color: query.color, fit: query.fit,
  material: query.material, tags: query.tags ? [].concat(query.tags) : undefined,
  minPrice: query.minPrice, maxPrice: query.maxPrice, isFeatured: query.isFeatured, status: query.status,
});

const search = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products:
   *   get:
   *     tags: [Discovery]
   *     summary: Search and filter the public catalogue
   *     description: Trigram + full-text search over name, description and tags. Size and colour filter through variants. Only ACTIVE products are returned and cost price is never exposed.
   *     parameters:
   *       - { in: query, name: q, schema: { type: string } }
   *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
   *       - { in: query, name: size, schema: { type: string } }
   *       - { in: query, name: color, schema: { type: string } }
   *       - { in: query, name: fit, schema: { type: string } }
   *       - { in: query, name: minPrice, schema: { type: number } }
   *       - { in: query, name: maxPrice, schema: { type: number } }
   *       - { in: query, name: sort, schema: { type: string, enum: [newest, oldest, price_asc, price_desc, best_selling, name] } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: Paginated products }
   */
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.search({ filters: toFilters(req.query), page, limit, offset, sort: req.query.sort, publicOnly: true });
  return paginated(res, result);
});

const adminList = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/admin:
   *   get:
   *     tags: [Catalog]
   *     summary: List products including drafts and archived, with cost price (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: status, schema: { type: string, enum: [DRAFT, ACTIVE, ARCHIVED] } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: Paginated products }
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.search({ filters: toFilters(req.query), page, limit, offset, sort: req.query.sort, publicOnly: false });
  return paginated(res, result);
});

const getBySlug = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/{slug}:
   *   get:
   *     tags: [Discovery]
   *     summary: Public product detail by slug; records a view for trending and recently-viewed
   *     parameters: [{ in: path, name: slug, required: true, schema: { type: string } }]
   *     responses:
   *       200: { description: Product with variants and images }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.getBySlug(req.params.slug, viewerContext(req)) });
});

const getByIdAdmin = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/admin/{id}:
   *   get:
   *     tags: [Catalog]
   *     summary: Get any product by id, including margin fields (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Product }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.getByIdAdmin(req.params.id) });
});

const create = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products:
   *   post:
   *     tags: [Catalog]
   *     summary: Create a product with its variants, images and collections (admin)
   *     description: Slug is generated and de-duplicated server-side. Product and variant SKUs must be unique. A variant's optional `initialStock` seeds its inventory row.
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, sku, price]
   *             properties:
   *               name: { type: string }
   *               sku: { type: string }
   *               price: { type: number }
   *               status: { type: string, enum: [DRAFT, ACTIVE, ARCHIVED] }
   *               categoryId: { type: string, format: uuid }
   *               variants: { type: array, items: { type: object } }
   *               images: { type: array, items: { type: object } }
   *               collectionIds: { type: array, items: { type: string, format: uuid } }
   *     responses:
   *       201: { description: Product created }
   *       409: { description: SKU already in use }
   *       422: { $ref: '#/components/responses/ValidationError' }
   */
  return success(res, { data: await service.create(req, req.body), message: 'Product created', statusCode: 201 });
});

const update = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/{id}:
   *   patch:
   *     tags: [Catalog]
   *     summary: Update a product (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Product updated }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.update(req, req.params.id, req.body), message: 'Product updated' });
});

const remove = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/{id}:
   *   delete:
   *     tags: [Catalog]
   *     summary: Soft-delete a product (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Product deleted }
   */
  return success(res, { data: await service.remove(req, req.params.id), message: 'Product deleted' });
});

const addVariant = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/{id}/variants:
   *   post:
   *     tags: [Catalog]
   *     summary: Add a variant (separate SKU sharing the parent product)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       201: { description: Variant created }
   *       409: { description: SKU already in use }
   */
  return success(res, { data: await service.addVariant(req, req.params.id, req.body), message: 'Variant created', statusCode: 201 });
});

const updateVariant = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/{id}/variants/{variantId}:
   *   patch:
   *     tags: [Catalog]
   *     summary: Update a variant (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *       - { in: path, name: variantId, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Variant updated }
   */
  return success(res, { data: await service.updateVariant(req, req.params.id, req.params.variantId, req.body), message: 'Variant updated' });
});

const removeVariant = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/{id}/variants/{variantId}:
   *   delete:
   *     tags: [Catalog]
   *     summary: Soft-delete a variant (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
   *       - { in: path, name: variantId, required: true, schema: { type: string, format: uuid } }
   *     responses:
   *       200: { description: Variant deleted }
   */
  return success(res, { data: await service.removeVariant(req, req.params.id, req.params.variantId), message: 'Variant deleted' });
});

const newArrivals = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/new-arrivals:
   *   get:
   *     tags: [Discovery]
   *     summary: Most recently published products
   *     parameters: [{ in: query, name: limit, schema: { type: integer, maximum: 50 } }]
   *     responses:
   *       200: { description: Products }
   */
  return success(res, { data: await service.discovery.newArrivals(req.query.limit) });
});

const bestSellers = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/best-sellers:
   *   get:
   *     tags: [Discovery]
   *     summary: Ranked by units sold
   *     parameters: [{ in: query, name: limit, schema: { type: integer, maximum: 50 } }]
   *     responses:
   *       200: { description: Products }
   */
  return success(res, { data: await service.discovery.bestSellers(req.query.limit) });
});

const trending = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/trending:
   *   get:
   *     tags: [Discovery]
   *     summary: Most viewed in a recent window, falling back to best sellers
   *     parameters:
   *       - { in: query, name: limit, schema: { type: integer, maximum: 50 } }
   *       - { in: query, name: days, schema: { type: integer, maximum: 90 } }
   *     responses:
   *       200: { description: Products }
   */
  return success(res, { data: await service.discovery.trending(req.query.limit, req.query.days) });
});

const related = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/{slug}/related:
   *   get:
   *     tags: [Discovery]
   *     summary: Related products by category and shared tags
   *     parameters:
   *       - { in: path, name: slug, required: true, schema: { type: string } }
   *       - { in: query, name: limit, schema: { type: integer, maximum: 50 } }
   *     responses:
   *       200: { description: Products }
   */
  return success(res, { data: await service.discovery.related(req.params.slug, req.query.limit) });
});

const recentlyViewed = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/recently-viewed:
   *   get:
   *     tags: [Discovery]
   *     summary: Recently viewed products for the current customer or guest session
   *     description: Identified by the bearer token when present, otherwise by the X-Session-Id header.
   *     parameters:
   *       - { in: header, name: X-Session-Id, schema: { type: string } }
   *       - { in: query, name: limit, schema: { type: integer, maximum: 50 } }
   *     responses:
   *       200: { description: Products }
   */
  return success(res, { data: await service.discovery.recentlyViewed(viewerContext(req), req.query.limit) });
});

const facets = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /products/facets:
   *   get:
   *     tags: [Discovery]
   *     summary: Available sizes, colours and the price range, for filter UIs
   *     responses:
   *       200: { description: Facet values }
   */
  return success(res, { data: await service.discovery.facets() });
});

module.exports = {
  search, adminList, getBySlug, getByIdAdmin, create, update, remove, addVariant, updateVariant, removeVariant,
  newArrivals, bestSellers, trending, related, recentlyViewed, facets,
};
