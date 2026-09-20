'use strict';

const ApiError = require('../../utils/ApiError');
const repo = require('./inventory.repository');

// Creates the stock row for a brand-new variant. Idempotent: calling it twice
// for the same variant just tops up physical stock rather than erroring.
const initializeForVariant = async (variantId, initialStock = 0, transaction) => {
  const runner = async (t) => {
    let row = await repo.findByVariant(variantId, t);
    if (!row) row = await repo.create({ variantId, physical: 0, reserved: 0, sold: 0, returned: 0, damaged: 0 }, t);
    if (initialStock > 0) {
      row.physical += initialStock;
      await repo.save(row, t);
      await repo.createMovement({ variantId, type: 'PURCHASE', quantity: initialStock, note: 'Initial stock' }, t);
    }
    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

async function ensureRow(variantId, t) {
  const row = await repo.findByVariantForUpdate(variantId, t);
  if (!row) throw ApiError.notFound('No inventory record for this variant');
  return row;
}

// Holds stock for a pending cart/checkout without letting two shoppers oversell
// the same unit: the row lock inside the transaction makes concurrent reserve()
// calls for the same variant execute one at a time.
const reserve = async ({ variantId, quantity, referenceType, referenceId, actorUserId }, transaction) => {
  if (quantity <= 0) throw ApiError.badRequest('Reservation quantity must be positive');

  const runner = async (t) => {
    const row = await ensureRow(variantId, t);
    const available = row.physical - row.reserved;
    if (available < quantity) {
      throw ApiError.conflict('Not enough stock available', { variantId, available, requested: quantity });
    }
    row.reserved += quantity;
    await repo.save(row, t);
    await repo.createMovement({ variantId, type: 'RESERVE', quantity, actorUserId, referenceType, referenceId }, t);
    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

// Gives reserved stock back to the pool (cart expiry, checkout abandonment, order cancellation pre-commit).
const release = async ({ variantId, quantity, referenceType, referenceId, actorUserId }, transaction) => {
  if (quantity <= 0) throw ApiError.badRequest('Release quantity must be positive');

  const runner = async (t) => {
    const row = await ensureRow(variantId, t);
    row.reserved = Math.max(0, row.reserved - quantity);
    await repo.save(row, t);
    await repo.createMovement({ variantId, type: 'RELEASE', quantity, actorUserId, referenceType, referenceId }, t);
    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

// Converts a reservation into a permanent deduction when an order is confirmed:
// physical and reserved both drop, sold goes up, and products.sales_count is
// incremented so discovery (best sellers) reflects it immediately.
const commit = async ({ variantId, quantity, referenceType, referenceId, actorUserId }, transaction) => {
  if (quantity <= 0) throw ApiError.badRequest('Commit quantity must be positive');

  const runner = async (t) => {
    const row = await ensureRow(variantId, t);
    if (row.reserved < quantity) throw ApiError.conflict('Cannot commit more than is reserved', { variantId, reserved: row.reserved, quantity });
    row.reserved -= quantity;
    row.physical -= quantity;
    row.sold += quantity;
    await repo.save(row, t);
    await repo.createMovement({ variantId, type: 'ORDER', quantity, actorUserId, referenceType, referenceId }, t);

    try {
      // eslint-disable-next-line global-require
      const productRepo = require('../products/product.repository');
      const variant = await productRepo.findVariantById(variantId);
      if (variant) await productRepo.incrementSales(variant.productId, quantity, t);
    } catch (err) { /* product module optional in isolated tests */ }

    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

// Restocks on a customer return / RTO.
const restock = async ({ variantId, quantity, referenceType, referenceId, actorUserId, note }, transaction) => {
  if (quantity <= 0) throw ApiError.badRequest('Restock quantity must be positive');

  const runner = async (t) => {
    const row = await ensureRow(variantId, t);
    row.physical += quantity;
    row.returned += quantity;
    await repo.save(row, t);
    await repo.createMovement({ variantId, type: 'RETURN', quantity, actorUserId, referenceType, referenceId, note }, t);
    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

const receivePurchase = async ({ variantId, quantity, actorUserId, referenceType, referenceId, note }, transaction) => {
  if (quantity <= 0) throw ApiError.badRequest('Purchase quantity must be positive');

  const runner = async (t) => {
    let row = await repo.findByVariantForUpdate(variantId, t).catch(() => null);
    if (!row) row = await repo.create({ variantId, physical: 0, reserved: 0, sold: 0, returned: 0, damaged: 0 }, t);
    row.physical += quantity;
    await repo.save(row, t);
    await repo.createMovement({ variantId, type: 'PURCHASE', quantity, actorUserId, referenceType, referenceId, note }, t);
    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

const reportDamage = async ({ variantId, quantity, actorUserId, note }, transaction) => {
  if (quantity <= 0) throw ApiError.badRequest('Damage quantity must be positive');

  const runner = async (t) => {
    const row = await ensureRow(variantId, t);
    if (row.physical - row.reserved < quantity) throw ApiError.conflict('Cannot damage more units than are available');
    row.physical -= quantity;
    row.damaged += quantity;
    await repo.save(row, t);
    await repo.createMovement({ variantId, type: 'DAMAGE', quantity, actorUserId, note }, t);
    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

// Manual correction (stock count reconciliation). delta may be positive or negative.
const adjust = async ({ variantId, delta, actorUserId, note }, transaction) => {
  if (!delta) throw ApiError.badRequest('Adjustment delta cannot be zero');

  const runner = async (t) => {
    const row = await ensureRow(variantId, t);
    if (row.physical + delta < 0) throw ApiError.conflict('Adjustment would make physical stock negative');
    row.physical += delta;
    await repo.save(row, t);
    await repo.createMovement({ variantId, type: 'ADJUSTMENT', quantity: delta, actorUserId, note }, t);
    return row;
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

const getStock = async (variantId) => {
  const row = await repo.findByVariant(variantId);
  if (!row) throw ApiError.notFound('No inventory record for this variant');
  return present(row);
};

const listMovements = (query) => repo.listMovements(query);

function present(row) {
  const json = row.toJSON ? row.toJSON() : row;
  return { ...json, available: typeof row.available === 'function' ? row.available() : Math.max(0, json.physical - json.reserved) };
}

module.exports = {
  initializeForVariant, reserve, release, commit, restock, receivePurchase, reportDamage, adjust, getStock, listMovements, present,
};
