'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./customer.repository');

const DERIVED = ['totalSpend', 'orderCount', 'lastPurchaseAt'];

function present(customer) {
  if (!customer) return null;
  const json = customer.toJSON ? customer.toJSON() : customer;
  return {
    ...json,
    stats: {
      totalSpend: Number(json.totalSpend || 0),
      orderCount: json.orderCount || 0,
      averageOrderValue: typeof customer.averageOrderValue === 'function' ? customer.averageOrderValue() : 0,
      lastPurchaseAt: json.lastPurchaseAt || null,
    },
  };
}

const list = async (query) => {
  const result = await repo.list(query);
  return { ...result, rows: result.rows.map(present) };
};

async function loadOwned(customerId, req, { permission = 'customers:read' } = {}) {
  const customer = await repo.findById(customerId);
  if (!customer) throw ApiError.notFound('Customer not found');

  const isOwner = customer.userId === req.user.id;
  const isPrivileged = (req.user.permissions || []).includes(permission) || (req.user.roles || []).includes('admin');
  if (!isOwner && !isPrivileged) throw ApiError.forbidden('Not allowed');
  return customer;
}

const get = async (req, id) => present(await loadOwned(id, req));

const getMine = async (req) => {
  const customer = await repo.findByUserId(req.user.id);
  if (!customer) throw ApiError.notFound('No customer profile for this account');
  return present(customer);
};

const createForUser = async (userId, payload = {}, transaction) => {
  const clean = { ...payload };
  DERIVED.forEach((f) => delete clean[f]);
  const existing = await repo.findByUserId(userId);
  if (existing) return existing;
  return repo.create({ ...clean, userId }, transaction);
};

const update = async (req, id, payload) => {
  const customer = await loadOwned(id, req, { permission: 'customers:update' });
  const clean = { ...payload };
  DERIVED.forEach((f) => delete clean[f]);

  const before = present(customer);
  await repo.update(customer, clean);
  await audit.record(req, { action: 'customer.update', entityType: 'Customer', entityId: id, before, after: customer });
  return present(await repo.findById(id));
};

const setMarketingPreferences = async (req, id, prefs) => {
  const customer = await loadOwned(id, req, { permission: 'customers:update' });

  const optedOutOfEverything = !prefs.marketingEmail && !prefs.marketingSms && !prefs.marketingWhatsapp;
  const fields = { ...prefs, marketingOptOutAt: optedOutOfEverything ? new Date() : null };

  const before = present(customer);
  await repo.update(customer, fields);
  await audit.record(req, { action: 'customer.marketing_preferences', entityType: 'Customer', entityId: id, before, after: fields });
  return present(await repo.findById(id));
};

const listAddresses = async (req, customerId) => {
  await loadOwned(customerId, req);
  return repo.listAddresses(customerId);
};

const addAddress = async (req, customerId, payload) => {
  await loadOwned(customerId, req, { permission: 'customers:update' });

  return repo.transaction(async (t) => {
    const existing = await repo.countAddresses(customerId, t);
    const isFirst = existing === 0;
    const address = await repo.createAddress(
      { ...payload, customerId, isDefaultShipping: isFirst || Boolean(payload.isDefaultShipping), isDefaultBilling: isFirst || Boolean(payload.isDefaultBilling) },
      t
    );

    if (address.isDefaultShipping) await repo.clearDefaults(customerId, 'isDefaultShipping', address.id, t);
    if (address.isDefaultBilling) await repo.clearDefaults(customerId, 'isDefaultBilling', address.id, t);

    await audit.record(req, { action: 'address.create', entityType: 'Address', entityId: address.id, after: address, transaction: t });
    return address;
  });
};

const updateAddress = async (req, customerId, addressId, payload) => {
  await loadOwned(customerId, req, { permission: 'customers:update' });
  const address = await repo.findAddress(addressId, customerId);
  if (!address) throw ApiError.notFound('Address not found');

  return repo.transaction(async (t) => {
    const before = address.toJSON();
    await repo.updateAddress(address, payload, t);
    if (payload.isDefaultShipping) await repo.clearDefaults(customerId, 'isDefaultShipping', address.id, t);
    if (payload.isDefaultBilling) await repo.clearDefaults(customerId, 'isDefaultBilling', address.id, t);
    await audit.record(req, { action: 'address.update', entityType: 'Address', entityId: addressId, before, after: address, transaction: t });
    return address;
  });
};

const removeAddress = async (req, customerId, addressId) => {
  await loadOwned(customerId, req, { permission: 'customers:update' });
  const address = await repo.findAddress(addressId, customerId);
  if (!address) throw ApiError.notFound('Address not found');

  return repo.transaction(async (t) => {
    const wasDefaultShipping = address.isDefaultShipping;
    const wasDefaultBilling = address.isDefaultBilling;
    await repo.destroyAddress(address, t);

    if (wasDefaultShipping || wasDefaultBilling) {
      const remaining = await repo.listAddresses(customerId);
      const next = remaining.find((a) => a.id !== addressId);
      if (next) {
        await repo.updateAddress(next, {
          isDefaultShipping: wasDefaultShipping ? true : next.isDefaultShipping,
          isDefaultBilling: wasDefaultBilling ? true : next.isDefaultBilling,
        }, t);
      }
    }

    await audit.record(req, { action: 'address.delete', entityType: 'Address', entityId: addressId, before: address, transaction: t });
    return { deleted: true };
  });
};

// Called by the orders phase when an order is confirmed / returned, to keep
// the denormalised spend stats in sync. Never accepted directly from a client.
const applyOrderStats = async (customerId, { deltaSpend = 0, deltaOrderCount = 0, lastPurchaseAt }, transaction) => {
  const customer = await repo.findById(customerId);
  if (!customer) return null;
  const nextSpend = Math.max(0, Number(customer.totalSpend || 0) + Number(deltaSpend));
  const nextCount = Math.max(0, Number(customer.orderCount || 0) + Number(deltaOrderCount));
  return repo.update(customer, {
    totalSpend: nextSpend,
    orderCount: nextCount,
    ...(lastPurchaseAt ? { lastPurchaseAt } : {}),
  }, transaction);
};

module.exports = {
  list, get, getMine, createForUser, update, setMarketingPreferences,
  listAddresses, addAddress, updateAddress, removeAddress, applyOrderStats, present, DERIVED,
};
