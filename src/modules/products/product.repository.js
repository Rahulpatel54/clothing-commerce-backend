'use strict';

const { Op, literal, fn, col } = require('sequelize');
const db = require('../../models');

const variantInclude = { model: db.ProductVariant, as: 'variants', required: false };
const imageInclude = { model: db.ProductImage, as: 'images', required: false };
const categoryInclude = { model: db.Category, as: 'category', attributes: ['id', 'name', 'slug'], required: false };
const collectionInclude = { model: db.Collection, as: 'collections', attributes: ['id', 'name', 'slug'], through: { attributes: [] }, required: false };

const SORTS = {
  newest: ['"Product"."published_at" DESC NULLS LAST', '"Product"."created_at" DESC'],
  oldest: ['"Product"."created_at" ASC'],
  price_asc: ['"Product"."price" ASC'],
  price_desc: ['"Product"."price" DESC'],
  best_selling: ['"Product"."sales_count" DESC'],
  name: ['"Product"."name" ASC'],
};

const orderFor = (sort) => (SORTS[sort] || SORTS.newest).map((clause) => literal(clause));

function buildWhere(filters = {}, { publicOnly = true } = {}) {
  const where = {};
  const and = [];

  if (publicOnly) where.status = 'ACTIVE';
  else if (filters.status) where.status = filters.status;

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.fit) where.fit = filters.fit;
  if (filters.material) where.material = { [Op.iLike]: `%${filters.material}%` };
  if (filters.tags && filters.tags.length) where.tags = { [Op.overlap]: filters.tags };
  if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) where.price[Op.gte] = filters.minPrice;
    if (filters.maxPrice !== undefined) where.price[Op.lte] = filters.maxPrice;
  }

  if (filters.search) {
    const term = filters.search;
    and.push({
      [Op.or]: [
        literal(`similarity("Product"."name", ${db.sequelize.escape(term)}) > 0.2`),
        literal(`to_tsvector('simple', coalesce("Product"."name",'') || ' ' || coalesce("Product"."description",'') || ' ' || array_to_string("Product"."tags", ' ')) @@ plainto_tsquery('simple', ${db.sequelize.escape(term)})`),
      ],
    });
  }

  if (and.length) where[Op.and] = and;
  return where;
}

function variantFilter(filters = {}) {
  const variantWhere = {};
  if (filters.size) variantWhere.size = filters.size;
  if (filters.color) variantWhere.color = { [Op.iLike]: filters.color };
  const required = Object.keys(variantWhere).length > 0;
  return { ...variantInclude, ...(required ? { where: variantWhere, required: true } : {}) };
}

const search = async ({ filters = {}, page, limit, offset, sort = 'newest', publicOnly = true }) => {
  const order = filters.search
    ? [literal(`similarity("Product"."name", ${db.sequelize.escape(filters.search)}) DESC`), ...orderFor(sort)]
    : orderFor(sort);

  const { rows, count } = await db.Product.findAndCountAll({
    where: buildWhere(filters, { publicOnly }),
    include: [variantFilter(filters), imageInclude, categoryInclude],
    order, limit, offset, distinct: true, subQuery: false,
  });
  return { rows, count, page, limit };
};

const findById = (id, { publicOnly = false } = {}) =>
  db.Product.findOne({ where: { id, ...(publicOnly ? { status: 'ACTIVE' } : {}) }, include: [variantInclude, imageInclude, categoryInclude, collectionInclude] });

const findBySlug = (slug, { publicOnly = true } = {}) =>
  db.Product.findOne({ where: { slug, ...(publicOnly ? { status: 'ACTIVE' } : {}) }, include: [variantInclude, imageInclude, categoryInclude, collectionInclude] });

const slugExists = async (slug, ignoreId) =>
  Boolean(await db.Product.findOne({ where: { slug, ...(ignoreId ? { id: { [Op.ne]: ignoreId } } : {}) }, paranoid: false, attributes: ['id'] }));

const skuExists = async (sku, ignoreId) =>
  Boolean(await db.Product.findOne({ where: { sku, ...(ignoreId ? { id: { [Op.ne]: ignoreId } } : {}) }, paranoid: false, attributes: ['id'] }));

const variantSkuExists = async (sku, ignoreId) =>
  Boolean(await db.ProductVariant.findOne({ where: { sku, ...(ignoreId ? { id: { [Op.ne]: ignoreId } } : {}) }, paranoid: false, attributes: ['id'] }));

const create = (payload, transaction) => db.Product.create(payload, { transaction });
const update = (product, fields, transaction) => product.update(fields, { transaction });
const destroy = (product, transaction) => product.destroy({ transaction });
const setCollections = (product, collections, transaction) => product.setCollections(collections, { transaction });
const findCollectionsByIds = (ids, transaction) => db.Collection.findAll({ where: { id: { [Op.in]: ids } }, transaction });

const createVariant = (payload, transaction) => db.ProductVariant.create(payload, { transaction });
const findVariant = (id, productId) => db.ProductVariant.findOne({ where: { id, productId } });
const updateVariant = (variant, fields, transaction) => variant.update(fields, { transaction });
const destroyVariant = (variant, transaction) => variant.destroy({ transaction });
const createImages = (rows, transaction) => db.ProductImage.bulkCreate(rows, { transaction });

const newArrivals = (limit) => db.Product.findAll({ where: { status: 'ACTIVE' }, include: [imageInclude, variantInclude], order: orderFor('newest'), limit });

const bestSellers = (limit) => db.Product.findAll({ where: { status: 'ACTIVE', salesCount: { [Op.gt]: 0 } }, include: [imageInclude, variantInclude], order: [['salesCount', 'DESC']], limit });

const trending = async (limit, sinceDays = 7) => {
  const since = new Date(Date.now() - sinceDays * 86400000);
  const rows = await db.ProductView.findAll({
    attributes: ['productId', [fn('COUNT', col('product_id')), 'views']],
    where: { viewedAt: { [Op.gte]: since } }, group: ['product_id'], order: [[literal('views'), 'DESC']], limit, raw: true,
  });
  if (!rows.length) return bestSellers(limit);

  const ids = rows.map((r) => r.productId);
  const products = await db.Product.findAll({ where: { id: { [Op.in]: ids }, status: 'ACTIVE' }, include: [imageInclude, variantInclude] });
  return ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
};

const related = (product, limit) =>
  db.Product.findAll({
    where: {
      id: { [Op.ne]: product.id }, status: 'ACTIVE',
      [Op.or]: [
        ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
        ...(product.tags && product.tags.length ? [{ tags: { [Op.overlap]: product.tags } }] : []),
      ],
    },
    include: [imageInclude], order: [['salesCount', 'DESC']], limit,
  });

const recordView = (payload) => db.ProductView.create(payload);
const incrementViews = (productId) => db.Product.increment({ viewsCount: 1 }, { where: { id: productId } });
const incrementSales = (productId, qty, transaction) => db.Product.increment({ salesCount: qty }, { where: { id: productId }, transaction });

const recentlyViewed = async ({ customerId, sessionId }, limit) => {
  const rows = await db.ProductView.findAll({
    attributes: ['productId', [fn('MAX', col('viewed_at')), 'lastViewedAt']],
    where: customerId ? { customerId } : { sessionId }, group: ['product_id'], order: [[literal('"lastViewedAt"'), 'DESC']], limit, raw: true,
  });
  if (!rows.length) return [];
  const ids = rows.map((r) => r.productId);
  const products = await db.Product.findAll({ where: { id: { [Op.in]: ids }, status: 'ACTIVE' }, include: [imageInclude] });
  return ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
};

const facets = async (filters = {}) => {
  const [sizes, colors] = await Promise.all([
    db.ProductVariant.findAll({ attributes: [[fn('DISTINCT', col('size')), 'size']], raw: true }),
    db.ProductVariant.findAll({ attributes: [[fn('DISTINCT', col('color')), 'color']], raw: true }),
  ]);
  const priceRange = await db.Product.findOne({ attributes: [[fn('MIN', col('price')), 'min'], [fn('MAX', col('price')), 'max']], where: { status: 'ACTIVE' }, raw: true });
  return {
    sizes: sizes.map((s) => s.size).filter(Boolean),
    colors: colors.map((c) => c.color).filter(Boolean),
    price: { min: Number(priceRange && priceRange.min) || 0, max: Number(priceRange && priceRange.max) || 0 },
  };
};

const transaction = (fn2) => db.sequelize.transaction(fn2);
const findVariantById = (id) => db.ProductVariant.findByPk(id, { include: [{ model: db.Product, as: 'product' }] });

module.exports = {
  search, findById, findBySlug, slugExists, skuExists, variantSkuExists, create, update, destroy, setCollections,
  findCollectionsByIds, createVariant, findVariant, findVariantById, updateVariant, destroyVariant, createImages,
  newArrivals, bestSellers, trending, related, recordView, incrementViews, incrementSales, recentlyViewed, facets,
  buildWhere, transaction,
};
