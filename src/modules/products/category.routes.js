'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./product.validation');
const { categories } = require('./taxonomy.controller');

const router = express.Router();

router.get('/', validate(schema.taxonomyList), categories.list);
router.post('/', authenticate, authorize('products:create'), validate(schema.categoryCreate), categories.create);
router.get('/:slug', validate(schema.taxonomyBySlug), categories.getBySlug);
router.patch('/:id', authenticate, authorize('products:update'), validate(schema.categoryUpdate), categories.update);
router.delete('/:id', authenticate, authorize('products:delete'), validate(schema.byId), categories.remove);

module.exports = router;
