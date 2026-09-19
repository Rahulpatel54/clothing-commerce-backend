'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./customer.service');

const list = catchAsync(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.list({ filters: req.query, page, limit, offset, sort: req.query.sort, order: req.query.order });
  return paginated(res, result);
});

const me = catchAsync(async (req, res) => success(res, { data: await service.getMine(req) }));
const get = catchAsync(async (req, res) => success(res, { data: await service.get(req, req.params.id) }));

const update = catchAsync(async (req, res) =>
  success(res, { data: await service.update(req, req.params.id, req.body), message: 'Customer updated' })
);

const marketing = catchAsync(async (req, res) =>
  success(res, { data: await service.setMarketingPreferences(req, req.params.id, req.body), message: 'Preferences updated' })
);

const listAddresses = catchAsync(async (req, res) =>
  success(res, { data: await service.listAddresses(req, req.params.id) })
);

const addAddress = catchAsync(async (req, res) =>
  success(res, { data: await service.addAddress(req, req.params.id, req.body), message: 'Address added', statusCode: 201 })
);

const updateAddress = catchAsync(async (req, res) =>
  success(res, { data: await service.updateAddress(req, req.params.id, req.params.addressId, req.body), message: 'Address updated' })
);

const removeAddress = catchAsync(async (req, res) =>
  success(res, { data: await service.removeAddress(req, req.params.id, req.params.addressId), message: 'Address removed' })
);

module.exports = { list, me, get, update, marketing, listAddresses, addAddress, updateAddress, removeAddress };