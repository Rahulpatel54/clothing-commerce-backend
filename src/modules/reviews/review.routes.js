'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const { authenticate, optionalAuthenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./review.validation');
const controller = require('./review.controller');

const router = express.Router();

// Middleware to resolve customer ID from authenticated user
const resolveCustomer = async (req, res, next) => {
  if (!req.user) return next();
  try {
    // eslint-disable-next-line global-require
    const customerRepo = require('../customers/customer.repository');
    const customer = await customerRepo.findByUserId(req.user.id);
    req.customerId = customer ? customer.id : null;
    next();
  } catch (err) {
    next(err);
  }
};

router.use(optionalAuthenticate, resolveCustomer);

// Publicly readable endpoints
router.get('/summary', validate(schema.summary), controller.summary);
router.get('/', validate(schema.list), controller.list);
router.get('/:id', validate(schema.byId), controller.get);
router.post('/:id/helpful', validate(schema.byId), controller.voteHelpful);

// Authenticated customer/staff actions
router.post('/', authenticate, validate(schema.create), controller.create);
router.patch('/:id', authenticate, validate(schema.update), controller.update);
router.delete('/:id', authenticate, validate(schema.byId), controller.remove);
router.patch('/:id/moderation', authenticate, authorize('reviews:update'), validate(schema.moderate), controller.moderate);

module.exports = router;
