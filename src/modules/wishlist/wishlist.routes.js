'use strict';

const express = require('express');
// Mounted at /customers/:id/wishlist by customer.routes.js, so { mergeParams: true }
// is required for req.params.id (the customer id) to reach this router.
const router = express.Router({ mergeParams: true });
const validate = require('../../middleware/validate');
const schema = require('./wishlist.validation');
const controller = require('./wishlist.controller');

router.get('/', validate(schema.byCustomer), controller.list);
router.post('/', validate(schema.addItem), controller.add);
router.delete('/:productId', validate(schema.removeItem), controller.remove);

module.exports = router;
