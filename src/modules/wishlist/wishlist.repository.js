'use strict';

const db = require('../../models');

const productInclude = {
  model: db.Product, as: 'product',
  include: [
    { model: db.ProductImage, as: 'images', required: false },
    { model: db.ProductVariant, as: 'variants', required: false },
  ],
};

const list = (customerId) => db.WishlistItem.findAll({ where: { customerId }, include: [productInclude], order: [['createdAt', 'DESC']] });
const find = (customerId, productId) => db.WishlistItem.findOne({ where: { customerId, productId } });
const create = (payload) => db.WishlistItem.create(payload);
const destroy = (item) => item.destroy();
const count = (customerId) => db.WishlistItem.count({ where: { customerId } });

module.exports = { list, find, create, destroy, count };
