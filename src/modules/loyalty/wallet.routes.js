'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./wallet.validation');
const controller = require('./wallet.controller');

const router = express.Router();
router.use(authenticate);

/**
 * @openapi
 * /loyalty/wallet:
 *   get:
 *     tags: [Loyalty]
 *     summary: The signed-in customer's wallet balance (always computed from the ledger)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Balance }
 */
router.get('/wallet', controller.getMyBalance);

/**
 * @openapi
 * /loyalty/wallet/transactions:
 *   get:
 *     tags: [Loyalty]
 *     summary: The signed-in customer's wallet ledger
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Transactions }
 */
router.get('/wallet/transactions', validate(schema.listTransactions), controller.listMyTransactions);

/**
 * @openapi
 * /loyalty/wallet/credit:
 *   post:
 *     tags: [Loyalty]
 *     summary: Manually credit a customer's wallet (staff — birthday/campaign/compensation/UGC rewards)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Wallet credited }
 */
router.post('/wallet/credit', authorize('loyalty:create'), validate(schema.credit), controller.credit);

module.exports = router;
