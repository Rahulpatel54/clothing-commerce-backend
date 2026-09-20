'use strict';

const db = require('../../models');

const variantInclude = {
  model: db.ProductVariant, as: 'variant',
  include: [{ model: db.Product, as: 'product', attributes: ['id', 'name', 'slug', 'price', 'status'] }],
};

const findActiveByCustomer = (customerId, transaction) =>
  db.Cart.findOne({ where: { customerId, status: 'ACTIVE' }, transaction });

const findActiveBySession = (sessionId, transaction) =>
  db.Cart.findOne({ where: { sessionId, status: 'ACTIVE' }, transaction });

const findById = (id, transaction) => db.Cart.findByPk(id, { transaction });
const create = (payload, transaction) => db.Cart.create(payload, { transaction });
const update = (cart, fields, transaction) => cart.update(fields, { transaction });

const listItems = (cartId, transaction) => db.CartItem.findAll({ where: { cartId }, include: [variantInclude], order: [['createdAt', 'ASC']], transaction });
const findItem = (cartId, variantId, transaction) => db.CartItem.findOne({ where: { cartId, variantId }, transaction });
const createItem = (payload, transaction) => db.CartItem.create(payload, { transaction });
const updateItem = (item, fields, transaction) => item.update(fields, { transaction });
const destroyItem = (item, transaction) => item.destroy({ transaction });
const destroyAllItems = (cartId, transaction) => db.CartItem.destroy({ where: { cartId }, transaction });

const findVariantWithProduct = (variantId, transaction) =>
  db.ProductVariant.findByPk(variantId, { include: [{ model: db.Product, as: 'product' }], transaction });

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  findActiveByCustomer, findActiveBySession, findById, create, update,
  listItems, findItem, createItem, updateItem, destroyItem, destroyAllItems,
  findVariantWithProduct, transaction,
};
