'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./payment.validation');
const controller = require('./payment.controller');

const router = express.Router();

router.post('/orders/:orderId/initiate', authenticate, validate(schema.initiate), controller.initiate);
router.post('/webhook', controller.webhook);
router.post('/:paymentId/refund', authenticate, authorize('payments:update'), validate(schema.refund), controller.refund);

module.exports = router;
