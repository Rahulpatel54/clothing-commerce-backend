'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./customer.validation');
const controller = require('./customer.controller');
const wishlistRoutes = require('../wishlist/wishlist.routes');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('customers:read'), validate(schema.list), controller.list);
router.get('/me', controller.me);
router.get('/:id', validate(schema.byId), controller.get);
router.patch('/:id', validate(schema.update), controller.update);
router.put('/:id/marketing-preferences', validate(schema.marketing), controller.marketing);
router.get('/:id/addresses', validate(schema.listAddresses), controller.listAddresses);
router.post('/:id/addresses', validate(schema.addAddress), controller.addAddress);
router.patch('/:id/addresses/:addressId', validate(schema.updateAddress), controller.updateAddress);
router.delete('/:id/addresses/:addressId', validate(schema.removeAddress), controller.removeAddress);

// Wishlist is customer-scoped; nested under /customers/:id/wishlist.
router.use('/:id/wishlist', wishlistRoutes);

module.exports = router;
