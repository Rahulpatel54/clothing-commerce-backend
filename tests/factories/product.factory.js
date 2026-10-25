'use strict';

const crypto = require('crypto');

function buildVariant(overrides = {}) {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    sku: overrides.sku || `SKU-${id.slice(0, 6).toUpperCase()}`,
    size: overrides.size || 'M',
    color: overrides.color || 'Black',
    price: overrides.price || '49.99',
    compareAtPrice: overrides.compareAtPrice || null,
    costPrice: overrides.costPrice || '20.00',
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    toJSON: function () {
      return { ...this };
    },
    ...overrides,
  };
}

function buildProduct(overrides = {}) {
  const id = overrides.id || crypto.randomUUID();
  const variants = overrides.variants || [buildVariant({ productId: id })];
  return {
    id,
    title: overrides.title || 'Classic Cotton Tee',
    slug: overrides.slug || `classic-cotton-tee-${id.slice(0, 6)}`,
    description: overrides.description || 'Premium cotton fabric daily essential.',
    status: overrides.status || 'PUBLISHED',
    categoryId: overrides.categoryId || crypto.randomUUID(),
    variants,
    toJSON: function () {
      return { ...this };
    },
    ...overrides,
  };
}

module.exports = { buildProduct, buildVariant };
