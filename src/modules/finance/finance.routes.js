'use strict';

const express = require('express');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const schema = require('./finance.validation');
const controller = require('./finance.controller');

const router = express.Router();

router.get('/pnl', authenticate, authorize('finance:read'), validate(schema.pnlReport), controller.getPnL);
router.get('/trace/:type', authenticate, authorize('finance:read'), validate(schema.traceRecords), controller.getTraceRecords);

// Financial periods
router.post('/periods', authenticate, authorize('finance:update'), validate(schema.createPeriod), controller.createPeriod);
router.get('/periods', authenticate, authorize('finance:read'), validate(schema.listPeriods), controller.listPeriods);
router.post('/periods/:id/close', authenticate, authorize('finance:update'), validate(schema.closePeriod), controller.closePeriod);

module.exports = router;
