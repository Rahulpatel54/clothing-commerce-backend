'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const customerRepo = require('../customers/customer.repository');
const productRepo = require('../products/product.repository');
const repo = require('./wishlist.repository');

async function assertOwner(customerId, req) {
  const customer = await customerRepo.findById(customerId);
  if (!customer) throw ApiError.notFound('Customer not found');
  const isOwner = customer.userId === req.user.id;
  const isPrivileged = (req.user.permissions || []).includes('customers:read') || (req.user.roles || []).includes('admin');
  if (!isOwner && !isPrivileged) throw ApiError.forbidden('Not allowed');
  return customer;
}

function present(item) {
  const product = item.product;
  if (!product) return { id: item.id, productId: item.productId, addedAt: item.createdAt, product: null };
  const json = product.toPublicJSON ? product.toPublicJSON() : product.toJSON();
  return { id: item.id, productId: item.productId, addedAt: item.createdAt, product: json };
}

const list = async (req, customerId) => {
  await assertOwner(customerId, req);
  const items = await repo.list(customerId);
  return items.map(present);
};

// Adding a product already on the wishlist is a no-op success, not an error:
// the client shouldn't have to check first before it "hearts" something.
const add = async (req, customerId, productId) => {
  await assertOwner(customerId, req);

  const product = await productRepo.findById(productId, { publicOnly: true });
  if (!product) throw ApiError.notFound('Product not found');

  const existing = await repo.find(customerId, productId);
  if (existing) return present({ ...existing.toJSON(), product });

  const item = await repo.create({ customerId, productId });
  await audit.record(req, { action: 'wishlist.add', entityType: 'WishlistItem', entityId: item.id, after: { customerId, productId } });
  return present({ id: item.id, productId, createdAt: item.createdAt, product });
};

const remove = async (req, customerId, productId) => {
  await assertOwner(customerId, req);
  const existing = await repo.find(customerId, productId);
  if (!existing) throw ApiError.notFound('This product is not on the wishlist');
  await repo.destroy(existing);
  await audit.record(req, { action: 'wishlist.remove', entityType: 'WishlistItem', entityId: existing.id, before: { customerId, productId } });
  return { removed: true };
};

const count = (customerId) => repo.count(customerId);

module.exports = { list, add, remove, count, present };
