'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./wishlist.service');

const list = catchAsync(async (req, res) => success(res, { data: await service.list(req, req.params.id) }));
const add = catchAsync(async (req, res) => success(res, { data: await service.add(req, req.params.id, req.body.productId), message: 'Added to wishlist', statusCode: 201 }));
const remove = catchAsync(async (req, res) => success(res, { data: await service.remove(req, req.params.id, req.params.productId), message: 'Removed from wishlist' }));

module.exports = { list, add, remove };
