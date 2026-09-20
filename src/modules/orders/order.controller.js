'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./order.service');

const list = catchAsync(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const isPrivileged = (req.user.permissions || []).includes('orders:read') || (req.user.roles || []).includes('admin');
  const filters = isPrivileged ? { status: req.query.status, customerId: req.query.customerId } : { status: req.query.status, customerId: req.customerId };
  const result = await service.list({ filters, page, limit, offset });
  return paginated(res, result);
});

const get = catchAsync(async (req, res) => success(res, { data: await service.get(req, req.params.id) }));

const transition = catchAsync(async (req, res) =>
  success(res, { data: await service.transition(req, req.params.id, req.body.status, req.body.reason), message: 'Order status updated' })
);

module.exports = { list, get, transition };
