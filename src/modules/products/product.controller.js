'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./product.service');

// Anonymous shoppers are tracked by an opaque session header, signed-in ones by user id.
const viewerContext = (req) => ({
  customerId: req.user ? req.user.id : null,
  sessionId: req.headers['x-session-id'] || null,
});

const toFilters = (query) => ({
  search: query.q,
  categoryId: query.categoryId,
  size: query.size,
  color: query.color,
  fit: query.fit,
  material: query.material,
  tags: query.tags ? [].concat(query.tags) : undefined,
  minPrice: query.minPrice,
  maxPrice: query.maxPrice,
  isFeatured: query.isFeatured,
  status: query.status,
});

const search = catchAsync(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.search({ filters: toFilters(req.query), page, limit, offset, sort: req.query.sort, publicOnly: true });
  return paginated(res, result);
});

const adminList = catchAsync(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.search({ filters: toFilters(req.query), page, limit, offset, sort: req.query.sort, publicOnly: false });
  return paginated(res, result);
});

const getBySlug = catchAsync(async (req, res) =>
  success(res, { data: await service.getBySlug(req.params.slug, viewerContext(req)) })
);

const getByIdAdmin = catchAsync(async (req, res) => success(res, { data: await service.getByIdAdmin(req.params.id) }));

const create = catchAsync(async (req, res) =>
  success(res, { data: await service.create(req, req.body), message: 'Product created', statusCode: 201 })
);

const update = catchAsync(async (req, res) =>
  success(res, { data: await service.update(req, req.params.id, req.body), message: 'Product updated' })
);

const remove = catchAsync(async (req, res) =>
  success(res, { data: await service.remove(req, req.params.id), message: 'Product deleted' })
);

const addVariant = catchAsync(async (req, res) =>
  success(res, { data: await service.addVariant(req, req.params.id, req.body), message: 'Variant created', statusCode: 201 })
);

const updateVariant = catchAsync(async (req, res) =>
  success(res, { data: await service.updateVariant(req, req.params.id, req.params.variantId, req.body), message: 'Variant updated' })
);

const removeVariant = catchAsync(async (req, res) =>
  success(res, { data: await service.removeVariant(req, req.params.id, req.params.variantId), message: 'Variant deleted' })
);

const newArrivals = catchAsync(async (req, res) => success(res, { data: await service.discovery.newArrivals(req.query.limit) }));
const bestSellers = catchAsync(async (req, res) => success(res, { data: await service.discovery.bestSellers(req.query.limit) }));
const trending = catchAsync(async (req, res) =>
  success(res, { data: await service.discovery.trending(req.query.limit, req.query.days) })
);
const related = catchAsync(async (req, res) =>
  success(res, { data: await service.discovery.related(req.params.slug, req.query.limit) })
);
const recentlyViewed = catchAsync(async (req, res) =>
  success(res, { data: await service.discovery.recentlyViewed(viewerContext(req), req.query.limit) })
);
const facets = catchAsync(async (req, res) => success(res, { data: await service.discovery.facets() }));

module.exports = {
  search,
  adminList,
  getBySlug,
  getByIdAdmin,
  create,
  update,
  remove,
  addVariant,
  updateVariant,
  removeVariant,
  newArrivals,
  bestSellers,
  trending,
  related,
  recentlyViewed,
  facets,
};