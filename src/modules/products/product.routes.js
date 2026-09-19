'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { optionalAuthenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./product.validation');
const controller = require('./product.controller');

const router = express.Router();

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
 *     responses:
 *       200: { description: Paginated products }
 */
router.get('/', validate(schema.search), controller.search);

/**
 * @openapi
 * /products/facets:
 *   get:
 *     tags: [Discovery]
 *     summary: Available sizes, colours and the price range, for filter UIs
 *     responses:
 *       200: { description: Facet values }
 */
router.get('/facets', controller.facets);

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
router.get('/new-arrivals', validate(schema.discovery), controller.newArrivals);

/**
 * @openapi
 * /products/best-sellers:
 *   get:
 *     tags: [Discovery]
 *     summary: Ranked by units sold (populated once the orders phase lands)
 *     parameters: [{ in: query, name: limit, schema: { type: integer, maximum: 50 } }]
 *     responses:
 *       200: { description: Products }
 */
router.get('/best-sellers', validate(schema.discovery), controller.bestSellers);

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
router.get('/trending', validate(schema.discovery), controller.trending);

/**
 * @openapi
 * /products/recently-viewed:
 *   get:
 *     tags: [Discovery]
 *     summary: Recently viewed products for the current customer or guest session
 *     description: Identified by the bearer token when present, otherwise by the X-Session-Id header.
 *     parameters: [{ in: query, name: limit, schema: { type: integer, maximum: 50 } }]
 *     responses:
 *       200: { description: Products }
 */
router.get('/recently-viewed', optionalAuthenticate, validate(schema.discovery), controller.recentlyViewed);

/**
 * @openapi
 * /products/admin:
 *   get:
 *     tags: [Catalog]
 *     summary: List products including drafts and archived, with cost price (staff)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated products }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/admin', authenticate, authorize('products:read'), validate(schema.search), controller.adminList);

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
router.get('/admin/:id', authenticate, authorize('products:read'), validate(schema.byId), controller.getByIdAdmin);

/**
 * @openapi
 * /products:
 *   post:
 *     tags: [Catalog]
 *     summary: Create a product with its variants, images and collections (admin)
 *     description: Slug is generated and de-duplicated server-side. Product and variant SKUs must be unique.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Product created }
 *       409: { description: SKU already in use }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/', authenticate, authorize('products:create'), validate(schema.create), controller.create);

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
 *   delete:
 *     tags: [Catalog]
 *     summary: Soft-delete a product (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Product deleted }
 */
router.patch('/:id', authenticate, authorize('products:update'), validate(schema.update), controller.update);
router.delete('/:id', authenticate, authorize('products:delete'), validate(schema.byId), controller.remove);

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
router.post('/:id/variants', authenticate, authorize('products:create'), validate(schema.addVariant), controller.addVariant);

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
router.patch('/:id/variants/:variantId', authenticate, authorize('products:update'), validate(schema.updateVariant), controller.updateVariant);
router.delete('/:id/variants/:variantId', authenticate, authorize('products:delete'), validate(schema.removeVariant), controller.removeVariant);

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
router.get('/:slug', optionalAuthenticate, validate(schema.bySlug), controller.getBySlug);

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
router.get('/:slug/related', validate(schema.discovery), controller.related);

module.exports = router;