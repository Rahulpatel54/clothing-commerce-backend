'use strict';

const express = require('express');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const schema = require('./analytics.validation');
const controller = require('./analytics.controller');

const router = express.Router();

router.use(authenticate, authorize('analytics:read'));

router.get('/overview', validate(schema.dateRange), controller.getOverview);
router.get('/sales', validate(schema.dateRange), controller.getSales);
router.get('/customers', validate(schema.dateRange), controller.getCustomers);
router.get('/products', validate(schema.dateRange), controller.getProducts);
router.get('/marketing', validate(schema.dateRange), controller.getMarketing);
router.get('/operations', validate(schema.dateRange), controller.getOperations);

module.exports = router;
