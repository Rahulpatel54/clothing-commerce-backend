'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const ApiError = require('../../utils/ApiError');
const customerRepo = require('../customers/customer.repository');
const service = require('./wallet.service');

async function myCustomer(req) {
  const customer = await customerRepo.findByUserId(req.user.id);
  if (!customer) throw ApiError.badRequest('No customer profile for this account');
  return customer;
}

const getMyBalance = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /loyalty/wallet:
   *   get:
   *     tags: [Loyalty]
   *     summary: The signed-in customer's wallet balance (always computed from the ledger, never a stored column)
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200: { description: Balance }
   */
  const customer = await myCustomer(req);
  return success(res, { data: { balance: await service.getBalance(customer.id) } });
});

const listMyTransactions = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /loyalty/wallet/transactions:
   *   get:
   *     tags: [Loyalty]
   *     summary: The signed-in customer's wallet ledger
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: Transactions }
   */
  const customer = await myCustomer(req);
  const { page, limit } = getPagination(req.query);
  const { rows, count } = await service.listTransactions(customer.id, { page, limit });
  return paginated(res, { rows, count, page, limit });
});

const credit = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /loyalty/wallet/credit:
   *   post:
   *     tags: [Loyalty]
   *     summary: Manually credit a customer's wallet (staff — birthday/campaign/compensation/UGC rewards)
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [customerId, type, amount]
   *             properties:
   *               customerId: { type: string, format: uuid }
   *               type: { type: string, enum: [BIRTHDAY_CREDIT, CAMPAIGN_CREDIT, COMPENSATION_CREDIT, UGC_CREDIT] }
   *               amount: { type: number }
   *               note: { type: string }
   *               expiresInDays: { type: integer }
   *     responses:
   *       201: { description: Wallet credited }
   */
  return success(res, { data: await service.credit(req.body), message: 'Wallet credited', statusCode: 201 });
});

module.exports = { getMyBalance, listMyTransactions, credit };
