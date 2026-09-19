'use strict';

const ApiError = require('../../utils/ApiError');
const { uniqueSlug } = require('../../utils/slugify');
const audit = require('../audit/audit.service');
const repo = require('./product.repository');

const DISCOVERY_LIMIT = 12;

function present(product, { includeCost = false } = {}) {
  if (!product) return null;
  const json = includeCost ? product.toJSON() : product.toPublicJSON ? product.toPublicJSON() : product.toJSON();
  if (Array.isArray(json.variants)) {
    // The effective price of a variant is its override, or the parent price.
    json.variants = json.variants.map((v) => ({
      ...v,
      effectivePrice: Number(v.price != null ? v.price : json.price),
      effectiveCompareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : json.compareAtPrice != null ? Number(json.compareAtPrice) : null,
    }));
  }
  return json;
}

const search = async ({ filters, page, limit, offset, sort, publicOnly = true }) => {
  const result = await repo.search({ filters, page, limit, offset, sort, publicOnly });
  return { ...result, rows: result.rows.map((p) => present(p, { includeCost: !publicOnly })) };
};

const getBySlug = async (slug, context = {}) => {
  const product = await repo.findBySlug(slug);
  if (!product) throw ApiError.notFound('Product not found');

  // View tracking feeds trending and recently-viewed; failure must not break the read.
  if (context.customerId || context.sessionId) {
    repo
      .recordView({ productId: product.id, customerId: context.customerId, sessionId: context.sessionId })
      .then(() => repo.incrementViews(product.id))
      .catch(() => {});
  }

  return present(product);
};

const getByIdAdmin = async (id) => {
  const product = await repo.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  return present(product, { includeCost: true });
};

async function assertSkuFree(sku, ignoreId) {
  if (await repo.skuExists(sku, ignoreId)) throw ApiError.conflict('SKU already in use');
}

const create = async (req, payload) => {
  await assertSkuFree(payload.sku);
  const slug = await uniqueSlug(payload.slug || payload.name, repo.slugExists);

  const product = await repo.transaction(async (t) => {
    const created = await repo.create(
      {
        ...payload,
        slug,
        publishedAt: payload.status === 'ACTIVE' ? new Date() : null,
        variants: undefined,
        images: undefined,
        collectionIds: undefined,
      },
      t
    );

    for (const variant of payload.variants || []) {
      // eslint-disable-next-line no-await-in-loop
      if (await repo.variantSkuExists(variant.sku)) throw ApiError.conflict(`Variant SKU already in use: ${variant.sku}`);
      // eslint-disable-next-line no-await-in-loop
      await repo.createVariant({ ...variant, productId: created.id }, t);
    }

    if (payload.images && payload.images.length) {
      await repo.createImages(payload.images.map((img, i) => ({ ...img, productId: created.id, position: img.position ?? i })), t);
    }

    if (payload.collectionIds && payload.collectionIds.length) {
      const collections = await repo.findCollectionsByIds(payload.collectionIds, t);
      if (collections.length !== payload.collectionIds.length) throw ApiError.badRequest('One or more collections do not exist');
      await repo.setCollections(created, collections, t);
    }

    await audit.record(req, { action: 'product.create', entityType: 'Product', entityId: created.id, after: created, transaction: t });
    return created;
  });

  return getByIdAdmin(product.id);
};

const update = async (req, id, payload) => {
  const product = await repo.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  if (payload.sku && payload.sku !== product.sku) await assertSkuFree(payload.sku, id);

  const before = present(product, { includeCost: true });
  const fields = { ...payload };
  delete fields.variants;
  delete fields.images;
  delete fields.collectionIds;

  if (payload.name && !payload.slug && payload.name !== product.name) {
    fields.slug = await uniqueSlug(payload.name, repo.slugExists, { ignoreId: id });
  }
  // publishedAt is set the first time a product goes live and never rewritten.
  if (payload.status === 'ACTIVE' && !product.publishedAt) fields.publishedAt = new Date();

  await repo.transaction(async (t) => {
    await repo.update(product, fields, t);
    if (payload.collectionIds) {
      const collections = await repo.findCollectionsByIds(payload.collectionIds, t);
      if (collections.length !== payload.collectionIds.length) throw ApiError.badRequest('One or more collections do not exist');
      await repo.setCollections(product, collections, t);
    }
    await audit.record(req, { action: 'product.update', entityType: 'Product', entityId: id, before, after: product, transaction: t });
  });

  return getByIdAdmin(id);
};

const remove = async (req, id) => {
  const product = await repo.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  await repo.destroy(product);
  await audit.record(req, { action: 'product.delete', entityType: 'Product', entityId: id, before: present(product, { includeCost: true }) });
  return { deleted: true };
};

const addVariant = async (req, productId, payload) => {
  const product = await repo.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');
  if (await repo.variantSkuExists(payload.sku)) throw ApiError.conflict('SKU already in use');

  const variant = await repo.createVariant({ ...payload, productId }, null);
  await audit.record(req, { action: 'variant.create', entityType: 'ProductVariant', entityId: variant.id, after: variant });
  return variant;
};

const updateVariant = async (req, productId, variantId, payload) => {
  const variant = await repo.findVariant(variantId, productId);
  if (!variant) throw ApiError.notFound('Variant not found');
  if (payload.sku && payload.sku !== variant.sku && (await repo.variantSkuExists(payload.sku, variantId))) {
    throw ApiError.conflict('SKU already in use');
  }

  const before = variant.toJSON();
  await repo.updateVariant(variant, payload);
  await audit.record(req, { action: 'variant.update', entityType: 'ProductVariant', entityId: variantId, before, after: variant });
  return variant;
};

const removeVariant = async (req, productId, variantId) => {
  const variant = await repo.findVariant(variantId, productId);
  if (!variant) throw ApiError.notFound('Variant not found');
  await repo.destroyVariant(variant);
  await audit.record(req, { action: 'variant.delete', entityType: 'ProductVariant', entityId: variantId, before: variant });
  return { deleted: true };
};

const discovery = {
  newArrivals: async (limit = DISCOVERY_LIMIT) => (await repo.newArrivals(limit)).map((p) => present(p)),
  bestSellers: async (limit = DISCOVERY_LIMIT) => (await repo.bestSellers(limit)).map((p) => present(p)),
  trending: async (limit = DISCOVERY_LIMIT, days = 7) => (await repo.trending(limit, days)).map((p) => present(p)),
  related: async (slug, limit = DISCOVERY_LIMIT) => {
    const product = await repo.findBySlug(slug);
    if (!product) throw ApiError.notFound('Product not found');
    return (await repo.related(product, limit)).map((p) => present(p));
  },
  recentlyViewed: async (context, limit = DISCOVERY_LIMIT) => {
    if (!context.customerId && !context.sessionId) return [];
    return (await repo.recentlyViewed(context, limit)).map((p) => present(p));
  },
  facets: () => repo.facets(),
};

module.exports = {
  search,
  getBySlug,
  getByIdAdmin,
  create,
  update,
  remove,
  addVariant,
  updateVariant,
  removeVariant,
  discovery,
  present,
};