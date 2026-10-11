'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./product.validation');
const controller = require('./category.controller');

const router = express.Router();

router.get('/', validate(schema.taxonomyList), controller.list);
router.post('/', authenticate, authorize('products:create'), validate(schema.categoryCreate), controller.create);
router.get('/:slug', validate(schema.taxonomyBySlug), controller.getBySlug);
router.patch('/:id', authenticate, authorize('products:update'), validate(schema.categoryUpdate), controller.update);
router.delete('/:id', authenticate, authorize('products:delete'), validate(schema.byId), controller.remove);

module.exports = router;
