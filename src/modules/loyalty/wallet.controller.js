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
  const customer = await myCustomer(req);
  return success(res, { data: { balance: await service.getBalance(customer.id) } });
});

const listMyTransactions = catchAsync(async (req, res) => {
  const customer = await myCustomer(req);
  const { page, limit } = getPagination(req.query);
  const { rows, count } = await service.listTransactions(customer.id, { page, limit });
  return paginated(res, { rows, count, page, limit });
});

const credit = catchAsync(async (req, res) =>
  success(res, { data: await service.credit(req.body), message: 'Wallet credited', statusCode: 201 })
);

module.exports = { getMyBalance, listMyTransactions, credit };
