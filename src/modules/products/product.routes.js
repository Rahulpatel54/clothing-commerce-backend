'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { optionalAuthenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./product.validation');
const controller = require('./product.controller');

const router = express.Router();

router.get('/', validate(schema.search), controller.search);
router.get('/facets', controller.facets);
router.get('/new-arrivals', validate(schema.discovery), controller.newArrivals);
router.get('/best-sellers', validate(schema.discovery), controller.bestSellers);
router.get('/trending', validate(schema.discovery), controller.trending);
router.get('/recently-viewed', optionalAuthenticate, validate(schema.discovery), controller.recentlyViewed);
router.get('/admin', authenticate, authorize('products:read'), validate(schema.search), controller.adminList);
router.get('/admin/:id', authenticate, authorize('products:read'), validate(schema.byId), controller.getByIdAdmin);
router.post('/', authenticate, authorize('products:create'), validate(schema.create), controller.create);
router.patch('/:id', authenticate, authorize('products:update'), validate(schema.update), controller.update);
router.delete('/:id', authenticate, authorize('products:delete'), validate(schema.byId), controller.remove);
router.post('/:id/variants', authenticate, authorize('products:create'), validate(schema.addVariant), controller.addVariant);
router.patch('/:id/variants/:variantId', authenticate, authorize('products:update'), validate(schema.updateVariant), controller.updateVariant);
router.delete('/:id/variants/:variantId', authenticate, authorize('products:delete'), validate(schema.removeVariant), controller.removeVariant);
router.get('/:slug', optionalAuthenticate, validate(schema.bySlug), controller.getBySlug);
router.get('/:slug/related', validate(schema.discovery), controller.related);

module.exports = router;
