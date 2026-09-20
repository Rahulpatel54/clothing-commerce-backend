'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();
const money = Joi.number().min(0).precision(2);

const variantBody = Joi.object({
  sku: Joi.string().max(64).uppercase().trim().required(),
  size: Joi.string().max(20).required(),
  color: Joi.string().max(50).required(),
  colorHex: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
  price: money.allow(null),
  compareAtPrice: money.allow(null),
  costPrice: money.allow(null),
  barcode: Joi.string().max(64),
  weightGrams: Joi.number().integer().min(0),
  position: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  initialStock: Joi.number().integer().min(0),
});

const imageBody = Joi.object({
  url: Joi.string().uri().max(500).required(),
  altText: Joi.string().max(255),
  position: Joi.number().integer().min(0),
  isPrimary: Joi.boolean(),
  variantId: Joi.string().uuid(),
});

const productCore = {
  name: Joi.string().max(200).trim(),
  slug: Joi.string().max(180).lowercase().trim(),
  description: Joi.string().max(20000).allow(''),
  categoryId: Joi.string().uuid().allow(null),
  sku: Joi.string().max(64).uppercase().trim(),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'ARCHIVED'),
  price: money,
  compareAtPrice: money.allow(null),
  costPrice: money.allow(null),
  tags: Joi.array().items(Joi.string().max(50)).max(30),
  material: Joi.string().max(120),
  gsm: Joi.number().integer().min(0).max(2000),
  fit: Joi.string().max(50),
  careInstructions: Joi.string().max(2000),
  isFeatured: Joi.boolean(),
  collectionIds: Joi.array().items(Joi.string().uuid()).max(20),
};

module.exports = {
  search: {
    query: Joi.object({
      page: Joi.number().min(1),
      limit: Joi.number().min(1).max(100),
      q: Joi.string().max(120).trim(),
      categoryId: Joi.string().uuid(),
      size: Joi.string().max(20),
      color: Joi.string().max(50),
      fit: Joi.string().max(50),
      material: Joi.string().max(120),
      tags: Joi.alternatives().try(Joi.array().items(Joi.string().max(50)), Joi.string().max(50)),
      minPrice: Joi.number().min(0),
      maxPrice: Joi.number().min(0),
      isFeatured: Joi.boolean(),
      status: Joi.string().valid('DRAFT', 'ACTIVE', 'ARCHIVED'),
      sort: Joi.string().valid('newest', 'oldest', 'price_asc', 'price_desc', 'best_selling', 'name').default('newest'),
    }),
  },
  bySlug: { params: Joi.object({ slug: Joi.string().max(180).required() }) },
  byId: { params: Joi.object({ id }) },
  discovery: { query: Joi.object({ limit: Joi.number().min(1).max(50).default(12), days: Joi.number().min(1).max(90).default(7) }) },
  create: {
    body: Joi.object({
      ...productCore,
      name: productCore.name.required(),
      sku: productCore.sku.required(),
      price: money.required(),
      variants: Joi.array().items(variantBody).max(100),
      images: Joi.array().items(imageBody).max(30),
    }),
  },
  update: { params: Joi.object({ id }), body: Joi.object(productCore).min(1) },
  addVariant: { params: Joi.object({ id }), body: variantBody },
  updateVariant: {
    params: Joi.object({ id, variantId: Joi.string().uuid().required() }),
    body: variantBody.fork(['sku', 'size', 'color'], (s) => s.optional()).min(1),
  },
  removeVariant: { params: Joi.object({ id, variantId: Joi.string().uuid().required() }) },

  taxonomyList: { query: Joi.object({ includeInactive: Joi.boolean().default(false) }) },
  taxonomyBySlug: { params: Joi.object({ slug: Joi.string().max(180).required() }) },
  categoryCreate: {
    body: Joi.object({
      name: Joi.string().max(120).required(), slug: Joi.string().max(180), description: Joi.string().max(2000),
      parentId: Joi.string().uuid().allow(null), imageUrl: Joi.string().uri().max(500),
      position: Joi.number().integer().min(0), isActive: Joi.boolean(),
    }),
  },
  categoryUpdate: {
    params: Joi.object({ id }),
    body: Joi.object({
      name: Joi.string().max(120), slug: Joi.string().max(180), description: Joi.string().max(2000),
      parentId: Joi.string().uuid().allow(null), imageUrl: Joi.string().uri().max(500),
      position: Joi.number().integer().min(0), isActive: Joi.boolean(),
    }).min(1),
  },
  collectionCreate: {
    body: Joi.object({
      name: Joi.string().max(120).required(), slug: Joi.string().max(180), description: Joi.string().max(2000),
      imageUrl: Joi.string().uri().max(500), isActive: Joi.boolean(),
      startsAt: Joi.date().iso(), endsAt: Joi.date().iso().greater(Joi.ref('startsAt')),
    }),
  },
  collectionUpdate: {
    params: Joi.object({ id }),
    body: Joi.object({
      name: Joi.string().max(120), slug: Joi.string().max(180), description: Joi.string().max(2000),
      imageUrl: Joi.string().uri().max(500), isActive: Joi.boolean(),
      startsAt: Joi.date().iso(), endsAt: Joi.date().iso(),
    }).min(1),
  },
};
