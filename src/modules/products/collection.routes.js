'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./product.validation');
const { collections } = require('./taxonomy.controller');

const router = express.Router();

router.get('/', validate(schema.taxonomyList), collections.list);
router.post('/', authenticate, authorize('products:create'), validate(schema.collectionCreate), collections.create);
router.get('/:slug', validate(schema.taxonomyBySlug), collections.getBySlug);
router.patch('/:id', authenticate, authorize('products:update'), validate(schema.collectionUpdate), collections.update);
router.delete('/:id', authenticate, authorize('products:delete'), validate(schema.byId), collections.remove);

module.exports = router;
