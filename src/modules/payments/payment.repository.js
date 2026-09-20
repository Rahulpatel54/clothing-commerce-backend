'use strict';

const db = require('../../models');

const create = (payload, transaction) => db.Payment.create(payload, { transaction });
const findById = (id, transaction) => db.Payment.findByPk(id, { transaction });
const findByIdForUpdate = (id, transaction) => db.Payment.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
const findByProviderPaymentId = (providerPaymentId, transaction) => db.Payment.findOne({ where: { providerPaymentId }, transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
const update = (payment, fields, transaction) => payment.update(fields, { transaction });
const createRefund = (payload, transaction) => db.Refund.create(payload, { transaction });
const listForOrder = (orderId) => db.Payment.findAll({ where: { orderId }, include: [{ model: db.Refund, as: 'refunds' }] });

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = { create, findById, findByIdForUpdate, findByProviderPaymentId, update, createRefund, listForOrder, transaction };
