'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./user.service');

const list = catchAsync(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.list({ filters: req.query, page, limit, offset, sort: req.query.sort, order: req.query.order });
  return paginated(res, result);
});

const get = catchAsync(async (req, res) => success(res, { data: await service.get(req.params.id) }));
const create = catchAsync(async (req, res) => success(res, { data: await service.create(req, req.body), message: 'User created', statusCode: 201 }));
const update = catchAsync(async (req, res) => success(res, { data: await service.update(req, req.params.id, req.body), message: 'User updated' }));
const changeStatus = catchAsync(async (req, res) => success(res, { data: await service.changeStatus(req, req.params.id, req.body), message: 'Status updated' }));
const assignRoles = catchAsync(async (req, res) => success(res, { data: await service.assignRoles(req, req.params.id, req.body), message: 'Roles updated' }));
const remove = catchAsync(async (req, res) => success(res, { data: await service.remove(req, req.params.id), message: 'User deleted' }));

module.exports = { list, get, create, update, changeStatus, assignRoles, remove };
