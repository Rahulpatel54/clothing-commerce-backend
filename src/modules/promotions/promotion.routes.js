'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./promotion.validation');
const controller = require('./promotion.controller');

const router = express.Router();
router.use(authenticate, authorize('promotions:read'));

router.get('/', validate(schema.list), controller.list);
router.get('/:id', validate(schema.byId), controller.get);
router.post('/', authorize('promotions:create'), validate(schema.create), controller.create);
router.patch('/:id', authorize('promotions:update'), validate(schema.update), controller.update);
router.post('/:id/coupons', authorize('promotions:create'), validate(schema.createCoupon), controller.createCoupon);

module.exports = router;
