'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const { categories, collections } = require('./taxonomy.service');

function controllerFor(service, label) {
  return {
    list: catchAsync(async (req, res) => success(res, { data: await service.list(req.query) })),
    getBySlug: catchAsync(async (req, res) => success(res, { data: await service.getBySlug(req.params.slug) })),
    create: catchAsync(async (req, res) => success(res, { data: await service.create(req, req.body), message: `${label} created`, statusCode: 201 })),
    update: catchAsync(async (req, res) => success(res, { data: await service.update(req, req.params.id, req.body), message: `${label} updated` })),
    remove: catchAsync(async (req, res) => success(res, { data: await service.remove(req, req.params.id), message: `${label} deleted` })),
  };
}

module.exports = { categories: controllerFor(categories, 'Category'), collections: controllerFor(collections, 'Collection') };
