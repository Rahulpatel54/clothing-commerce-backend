'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./wallet.validation');
const controller = require('./wallet.controller');

const router = express.Router();
router.use(authenticate);

router.get('/wallet', controller.getMyBalance);
router.get('/wallet/transactions', validate(schema.listTransactions), controller.listMyTransactions);
router.post('/wallet/credit', authorize('loyalty:create'), validate(schema.credit), controller.credit);

module.exports = router;
