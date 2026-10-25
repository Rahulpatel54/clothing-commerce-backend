'use strict';

const { buildUser } = require('./user.factory');
const { buildCustomer } = require('./customer.factory');
const { buildProduct, buildVariant } = require('./product.factory');
const { buildOrder } = require('./order.factory');

module.exports = {
  buildUser,
  buildCustomer,
  buildProduct,
  buildVariant,
  buildOrder,
};
