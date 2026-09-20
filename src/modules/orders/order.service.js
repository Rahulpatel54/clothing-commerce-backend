'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./order.repository');
const { canTransition } = require('./order.transitions');

const orderNumber = () => `ORD${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

function present(order) {
  if (!order) return null;
  const json = order.toJSON ? order.toJSON() : order;
  return json;
}

// Called from checkout inside the same transaction that reserved stock, so the
// order and its reservation either both commit or both roll back together.
const createFromCheckout = async (payload, transaction) => {
  const order = await repo.create(
    {
      orderNumber: orderNumber(),
      customerId: payload.customerId,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress || payload.shippingAddress,
      subtotal: payload.subtotal,
      shippingAmount: payload.shippingAmount || 0,
      taxAmount: payload.taxAmount || 0,
      discountAmount: payload.discountAmount || 0,
      walletAmount: payload.walletAmount || 0,
      totalAmount: payload.totalAmount,
      couponCode: payload.couponCode || null,
      couponId: payload.couponId || null,
      idempotencyKey: payload.idempotencyKey || null,
      placedAt: new Date(),
    },
    transaction
  );

  await repo.createItems(payload.items.map((item) => ({ ...item, orderId: order.id })), transaction);
  await repo.createHistory({ orderId: order.id, fromStatus: null, toStatus: 'PENDING', actorUserId: payload.actorUserId, reason: 'Order placed' }, transaction);

  return repo.findById(order.id, transaction);
};

async function reverseStock(order, mode, actorUserId) {
  // eslint-disable-next-line global-require
  const inventoryService = require('../inventory/inventory.service');
  for (const item of order.items) {
    if (mode === 'release') {
      // eslint-disable-next-line no-await-in-loop
      await inventoryService.release({ variantId: item.variantId, quantity: item.quantity, referenceType: 'ORDER', referenceId: order.id, actorUserId });
    } else {
      // eslint-disable-next-line no-await-in-loop
      await inventoryService.restock({ variantId: item.variantId, quantity: item.quantity, referenceType: 'ORDER', referenceId: order.id, actorUserId, note: `Order ${order.orderNumber} ${mode}` });
    }
  }
}

async function commitStock(order, actorUserId) {
  // eslint-disable-next-line global-require
  const inventoryService = require('../inventory/inventory.service');
  for (const item of order.items) {
    // eslint-disable-next-line no-await-in-loop
    await inventoryService.commit({ variantId: item.variantId, quantity: item.quantity, referenceType: 'ORDER', referenceId: order.id, actorUserId });
  }
}

async function applyCustomerStats(order, sign) {
  try {
    // eslint-disable-next-line global-require
    const customerService = require('../customers/customer.service');
    await customerService.applyOrderStats(order.customerId, {
      deltaSpend: sign * Number(order.totalAmount),
      deltaOrderCount: sign,
      lastPurchaseAt: sign > 0 ? new Date() : undefined,
    });
  } catch (err) { /* customers module optional in isolated tests */ }
}

// Referrals track their referee by user id, not customer id; both are optional
// hooks that must never block an order transition if the module is unavailable.
async function notifyReferral(order, method) {
  try {
    // eslint-disable-next-line global-require
    const customerRepo = require('../customers/customer.repository');
    // eslint-disable-next-line global-require
    const referralService = require('../referrals/referral.service');
    const customer = await customerRepo.findById(order.customerId);
    if (customer) await referralService[method](customer.userId, order.id);
  } catch (err) { /* referrals module optional in isolated tests */ }
}

/**
 * The single entry point for every order status change. Looks the transition up
 * in the shared table, rejects anything not listed with 409, and runs the
 * side effects (stock, customer stats, timestamps) that belong to that edge.
 */
const transition = async (req, orderId, toStatus, reason) => {
  return repo.transaction(async (t) => {
    const order = await repo.findByIdForUpdate(orderId, t);
    if (!order) throw ApiError.notFound('Order not found');

    const fromStatus = order.status;
    if (!canTransition(fromStatus, toStatus)) {
      throw ApiError.conflict(`Cannot move an order from ${fromStatus} to ${toStatus}`, { from: fromStatus, to: toStatus });
    }

    const fields = { status: toStatus };
    if (toStatus === 'DELIVERED') fields.deliveredAt = new Date();
    if (toStatus === 'CANCELLED') fields.cancelledAt = new Date();

    await repo.update(order, fields, t);
    await repo.createHistory({ orderId, fromStatus, toStatus, actorUserId: req.user && req.user.id, reason }, t);
    await audit.record(req, { action: 'order.transition', entityType: 'Order', entityId: orderId, before: { status: fromStatus }, after: { status: toStatus, reason }, transaction: t });

    const fullOrder = await repo.findById(orderId, t);

    if (toStatus === 'CONFIRMED') {
      await commitStock(fullOrder, req.user && req.user.id);
      await applyCustomerStats(fullOrder, 1);
    } else if (toStatus === 'CANCELLED') {
      // Stock was only reserved (never committed) while PENDING; anything past
      // that point already left physical stock, so cancelling restocks instead.
      await reverseStock(fullOrder, fromStatus === 'PENDING' ? 'release' : 'restock', req.user && req.user.id);
      if (fromStatus !== 'PENDING') await applyCustomerStats(fullOrder, -1);
      await notifyReferral(fullOrder, 'recordCancellation');
    } else if (toStatus === 'RETURNED') {
      await reverseStock(fullOrder, 'restock', req.user && req.user.id);
      await applyCustomerStats(fullOrder, -1);
    } else if (toStatus === 'DELIVERED') {
      await notifyReferral(fullOrder, 'recordDelivery');
    }

    return present(await repo.findById(orderId, t));
  });
};

const get = async (req, id) => {
  const order = await repo.findById(id);
  if (!order) throw ApiError.notFound('Order not found');
  const isOwner = order.customer && order.customer.userId === req.user.id;
  const isPrivileged = (req.user.permissions || []).includes('orders:read') || (req.user.roles || []).includes('admin');
  if (!isOwner && !isPrivileged) throw ApiError.forbidden('Not allowed');
  return present(order);
};

const list = async (query) => {
  const result = await repo.list(query);
  return { ...result, rows: result.rows.map(present) };
};

module.exports = { createFromCheckout, transition, get, list, present, orderNumber };
