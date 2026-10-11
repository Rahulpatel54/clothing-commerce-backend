'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const { optionalAuthenticate } = require('../../middleware/authenticate');
const schema = require('./cart.validation');
const controller = require('./cart.controller');

const router = express.Router();

// Carts work for guests and signed-in customers alike; authentication is optional
// here and resolves req.customerId downstream when a valid token is present.
const resolveCustomer = async (req, res, next) => {
  await new Promise((resolve) => optionalAuthenticate(req, res, resolve));
  if (req.user) {
    try {
      // eslint-disable-next-line global-require
      const customerRepo = require('../customers/customer.repository');
      const customer = await customerRepo.findByUserId(req.user.id);
      req.customerId = customer ? customer.id : null;
    } catch (err) {
      req.customerId = null;
    }
  }
  next();
};

router.use(resolveCustomer);

router.get('/', controller.getCart);
router.delete('/', controller.clear);
router.post('/items', validate(schema.addItem), controller.addItem);
router.patch('/items/:variantId', validate(schema.updateItem), controller.updateItem);
router.delete('/items/:variantId', validate(schema.removeItem), controller.removeItem);

module.exports = router;
