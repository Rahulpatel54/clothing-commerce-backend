'use strict';

const db = require('../../models');

const findByVariant = (variantId, transaction) => db.Inventory.findOne({ where: { variantId }, transaction });

// Row lock so concurrent reservations against the same variant serialize instead of racing.
const findByVariantForUpdate = (variantId, transaction) =>
  db.Inventory.findOne({ where: { variantId }, transaction, lock: transaction.LOCK.UPDATE });

const create = (payload, transaction) => db.Inventory.create(payload, { transaction });
const save = (row, transaction) => row.save({ transaction });

const createMovement = (payload, transaction) => db.InventoryMovement.create(payload, { transaction });

const listMovements = ({ variantId, page = 1, limit = 20 }) =>
  db.InventoryMovement.findAndCountAll({
    where: variantId ? { variantId } : {},
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = { findByVariant, findByVariantForUpdate, create, save, createMovement, listMovements, transaction };
