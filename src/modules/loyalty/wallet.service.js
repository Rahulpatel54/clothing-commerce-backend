'use strict';

const ApiError = require('../../utils/ApiError');
const config = require('../../config');
const repo = require('./wallet.repository');

function round2(n) { return Number(Number(n).toFixed(2)); }

async function ensureWallet(customerId, transaction) {
  let wallet = transaction ? await repo.findByCustomerForUpdate(customerId, transaction) : await repo.findByCustomer(customerId);
  if (!wallet) wallet = await repo.create(customerId, transaction);
  return wallet;
}

// Balance is never stored: it is the sum of every ledger row, minus any credit
// whose expiry has already passed. This can never drift, because there is
// nothing to drift from except the ledger itself.
const getBalance = async (customerId, transaction) => {
  const wallet = transaction ? await repo.findByCustomerForUpdate(customerId, transaction) : await repo.findByCustomer(customerId);
  if (!wallet) return 0;
  const balance = await repo.sumBalance(wallet.id, transaction);
  return round2(Math.max(0, balance));
};

const credit = async ({ customerId, type, amount, referenceType, referenceId, note, expiresInDays }, transaction) => {
  if (amount <= 0) throw ApiError.badRequest('Credit amount must be positive');

  const runner = async (t) => {
    const wallet = await ensureWallet(customerId, t);
    const expiresAt = expiresInDays != null ? new Date(Date.now() + expiresInDays * 86400000) : new Date(Date.now() + config.wallet.creditExpiryDays * 86400000);
    return repo.createTransaction({ walletId: wallet.id, type, amount: round2(amount), expiresAt, referenceType, referenceId, note }, t);
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

// Never lets the ledger go negative: the balance is recomputed under a wallet-row
// lock immediately before the debit is written, so two concurrent redemptions
// against the same wallet cannot both succeed past what is actually available.
const debit = async ({ customerId, amount, reason = 'REDEMPTION_DEBIT', referenceType, referenceId, note }, transaction) => {
  if (amount <= 0) throw ApiError.badRequest('Debit amount must be positive');

  const runner = async (t) => {
    const wallet = await ensureWallet(customerId, t);
    const balance = round2(Math.max(0, await repo.sumBalance(wallet.id, t)));
    if (balance < amount) throw ApiError.conflict('Insufficient wallet balance', { balance, requested: amount });
    return repo.createTransaction({ walletId: wallet.id, type: reason, amount: -round2(amount), referenceType, referenceId, note }, t);
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

const listTransactions = async (customerId, query) => {
  const wallet = await repo.findByCustomer(customerId);
  if (!wallet) return { rows: [], count: 0, page: query.page || 1, limit: query.limit || 20 };
  const { rows, count } = await repo.listTransactions(wallet.id, query);
  return { rows, count, page: query.page || 1, limit: query.limit || 20 };
};

module.exports = { getBalance, credit, debit, listTransactions };
