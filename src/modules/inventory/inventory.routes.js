'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./inventory.validation');
const controller = require('./inventory.controller');

const router = express.Router();
router.use(authenticate, authorize('inventory:read'));

router.get('/movements', validate(schema.movements), controller.listMovements);
router.get('/:variantId', validate(schema.byVariant), controller.getStock);
router.post('/receive', authorize('inventory:create'), validate(schema.receive), controller.receive);
router.post('/damage', authorize('inventory:update'), validate(schema.damage), controller.damage);
router.post('/adjust', authorize('inventory:update'), validate(schema.adjust), controller.adjust);

module.exports = router;
