'use strict';

const { Op } = require('sequelize');
const db = require('../../models');

const findByCustomer = (customerId, transaction) => db.Wallet.findOne({ where: { customerId }, transaction });
const create = (customerId, transaction) => db.Wallet.create({ customerId }, { transaction });

// Row lock on the wallet itself (via a dedicated SELECT ... FOR UPDATE) so two
// concurrent debits against the same wallet cannot both read the same balance.
const findByCustomerForUpdate = (customerId, transaction) => db.Wallet.findOne({ where: { customerId }, transaction, lock: transaction.LOCK.UPDATE });

const sumBalance = async (walletId, transaction) => {
  const now = new Date();
  const rows = await db.WalletTransaction.findAll({
    where: { walletId, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }, { amount: { [Op.lt]: 0 } }] },
    attributes: ['amount'], transaction, raw: true,
  });
  return rows.reduce((sum, r) => sum + Number(r.amount), 0);
};

const createTransaction = (payload, transaction) => db.WalletTransaction.create(payload, { transaction });

const listTransactions = (walletId, { page = 1, limit = 20 } = {}) =>
  db.WalletTransaction.findAndCountAll({ where: { walletId }, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = { findByCustomer, create, findByCustomerForUpdate, sumBalance, createTransaction, listTransactions, transaction };
