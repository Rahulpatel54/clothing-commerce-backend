'use strict';

const db = require('../../models');

const itemInclude = { model: db.OrderItem, as: 'items' };
const historyInclude = { model: db.OrderStatusHistory, as: 'history', order: [['createdAt', 'ASC']] };
const customerInclude = { model: db.Customer, as: 'customer', attributes: ['id', 'userId'] };

const create = (payload, transaction) => db.Order.create(payload, { transaction });
const createItems = (rows, transaction) => db.OrderItem.bulkCreate(rows, { transaction });
const createHistory = (payload, transaction) => db.OrderStatusHistory.create(payload, { transaction });

const findById = (id, transaction) => db.Order.findByPk(id, { include: [itemInclude, historyInclude, customerInclude], transaction });
// Row lock: two concurrent transition requests for the same order must serialize.
const findByIdForUpdate = (id, transaction) => db.Order.findByPk(id, { include: [itemInclude], transaction, lock: transaction.LOCK.UPDATE });

const findByOrderNumber = (orderNumber) => db.Order.findOne({ where: { orderNumber } });

const list = async ({ filters = {}, page, limit, offset }) => {
  const where = {};
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.status) where.status = filters.status;
  const { rows, count } = await db.Order.findAndCountAll({ where, include: [itemInclude], order: [['createdAt', 'DESC']], limit, offset, distinct: true });
  return { rows, count, page, limit };
};

const update = (order, fields, transaction) => order.update(fields, { transaction });

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = { create, createItems, createHistory, findById, findByIdForUpdate, findByOrderNumber, list, update, transaction };
