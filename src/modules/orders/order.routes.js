'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./order.validation');
const controller = require('./order.controller');

const router = express.Router();
router.use(authenticate);

// Resolve the caller's customer id so a shopper only ever sees their own orders
// unless they hold the staff-level orders:read permission (checked in the controller).
router.use(async (req, res, next) => {
  try {
    // eslint-disable-next-line global-require
    const customerRepo = require('../customers/customer.repository');
    const customer = await customerRepo.findByUserId(req.user.id);
    req.customerId = customer ? customer.id : null;
    next();
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(schema.list), controller.list);
router.get('/:id', validate(schema.byId), controller.get);
router.patch('/:id/status', authorize('orders:update'), validate(schema.transition), controller.transition);

module.exports = router;
