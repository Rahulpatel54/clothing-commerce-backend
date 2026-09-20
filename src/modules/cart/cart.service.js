'use strict';

const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const repo = require('./cart.repository');
const inventoryService = require('../inventory/inventory.service');

const MAX_QTY = config.cart.maxQtyPerVariant;

function expiryDate() {
  return new Date(Date.now() + config.cart.expiryMinutes * 60 * 1000);
}

function isExpired(cart) {
  return cart.expiresAt && cart.expiresAt.getTime() <= Date.now();
}

// Resolves (and lazily creates) the one active cart for this shopper: a signed-in
// customer's cart takes priority; guests are tracked by an opaque session id.
// An expired cart is treated as gone and a fresh one is opened in its place.
async function getOrCreateCart({ customerId, sessionId }, transaction) {
  if (!customerId && !sessionId) throw ApiError.badRequest('A customer or session is required for a cart');

  const runner = async (t) => {
    let cart = customerId ? await repo.findActiveByCustomer(customerId, t) : await repo.findActiveBySession(sessionId, t);

    if (cart && isExpired(cart)) {
      await repo.update(cart, { status: 'EXPIRED' }, t);
      cart = null;
    }

    if (!cart) {
      cart = await repo.create({ customerId: customerId || null, sessionId: customerId ? null : sessionId, status: 'ACTIVE', expiresAt: expiryDate() }, t);
    }
    return cart;
  };

  return transaction ? runner(transaction) : repo.transaction(runner);
}

function effectivePrice(variant) {
  return Number(variant.price != null ? variant.price : variant.product.price);
}

async function present(cart, transaction) {
  const items = await repo.listItems(cart.id, transaction);

  let subtotal = 0;
  let itemCount = 0;
  const lines = items.map((item) => {
    const variant = item.variant;
    const productActive = variant && variant.product && variant.product.status === 'ACTIVE';
    const currentPrice = variant ? effectivePrice(variant) : null;
    const priceChanged = currentPrice != null && Number(item.priceAtAdd) !== currentPrice;
    const lineTotal = currentPrice != null ? Number((currentPrice * item.quantity).toFixed(2)) : 0;

    subtotal += lineTotal;
    itemCount += item.quantity;

    return {
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      priceAtAdd: Number(item.priceAtAdd),
      currentPrice,
      priceChanged,
      available: productActive && variant.isActive,
      product: variant && variant.product ? { id: variant.product.id, name: variant.product.name, slug: variant.product.slug } : null,
      variant: variant ? { id: variant.id, size: variant.size, color: variant.color, sku: variant.sku } : null,
      lineTotal,
    };
  });

  return {
    id: cart.id,
    status: cart.status,
    expiresAt: cart.expiresAt,
    items: lines,
    itemCount,
    subtotal: Number(subtotal.toFixed(2)),
    hasUnavailableItems: lines.some((l) => !l.available),
    hasPriceChanges: lines.some((l) => l.priceChanged),
  };
}

const getCart = async (context) => {
  const cart = await getOrCreateCart(context);
  return present(cart);
};

const addItem = async (context, { variantId, quantity }) => {
  if (quantity <= 0) throw ApiError.badRequest('Quantity must be positive');

  return repo.transaction(async (t) => {
    const cart = await getOrCreateCart(context, t);
    const variant = await repo.findVariantWithProduct(variantId, t);
    if (!variant || !variant.product) throw ApiError.notFound('Variant not found');
    if (variant.product.status !== 'ACTIVE' || !variant.isActive) throw ApiError.badRequest('This item is not available for purchase');

    const stock = await inventoryService.getStock(variantId).catch(() => ({ available: 0 }));

    const existing = await repo.findItem(cart.id, variantId, t);
    const nextQty = Math.min(MAX_QTY, (existing ? existing.quantity : 0) + quantity);
    if (stock.available < nextQty) {
      throw ApiError.conflict('Not enough stock available', { available: stock.available, requested: nextQty });
    }

    const price = effectivePrice(variant);
    if (existing) await repo.updateItem(existing, { quantity: nextQty, priceAtAdd: price }, t);
    else await repo.createItem({ cartId: cart.id, variantId, quantity: nextQty, priceAtAdd: price }, t);

    await repo.update(cart, { expiresAt: expiryDate() }, t);
    return present(cart, t);
  });
};

const updateItemQuantity = async (context, variantId, quantity) => {
  if (quantity < 0) throw ApiError.badRequest('Quantity cannot be negative');

  return repo.transaction(async (t) => {
    const cart = await getOrCreateCart(context, t);
    const existing = await repo.findItem(cart.id, variantId, t);
    if (!existing) throw ApiError.notFound('Item not in cart');

    if (quantity === 0) {
      await repo.destroyItem(existing, t);
      return present(cart, t);
    }

    const cappedQty = Math.min(MAX_QTY, quantity);
    const stock = await inventoryService.getStock(variantId).catch(() => ({ available: 0 }));
    if (stock.available < cappedQty) throw ApiError.conflict('Not enough stock available', { available: stock.available, requested: cappedQty });

    await repo.updateItem(existing, { quantity: cappedQty }, t);
    await repo.update(cart, { expiresAt: expiryDate() }, t);
    return present(cart, t);
  });
};

const removeItem = async (context, variantId) => {
  return repo.transaction(async (t) => {
    const cart = await getOrCreateCart(context, t);
    const existing = await repo.findItem(cart.id, variantId, t);
    if (existing) await repo.destroyItem(existing, t);
    return present(cart, t);
  });
};

const clear = async (context) => {
  return repo.transaction(async (t) => {
    const cart = await getOrCreateCart(context, t);
    await repo.destroyAllItems(cart.id, t);
    return present(cart, t);
  });
};

// Called right after login: folds a guest cart into the customer's cart, capping
// per-variant quantity, then retires the guest cart so it is never reused.
const mergeGuestCart = async ({ sessionId, customerId }) => {
  if (!sessionId) return null;

  return repo.transaction(async (t) => {
    const guestCart = await repo.findActiveBySession(sessionId, t);
    if (!guestCart) return null;

    const customerCart = await getOrCreateCart({ customerId }, t);
    const guestItems = await repo.listItems(guestCart.id, t);

    for (const item of guestItems) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await repo.findItem(customerCart.id, item.variantId, t);
      const nextQty = Math.min(MAX_QTY, (existing ? existing.quantity : 0) + item.quantity);
      // eslint-disable-next-line no-await-in-loop
      if (existing) await repo.updateItem(existing, { quantity: nextQty }, t);
      // eslint-disable-next-line no-await-in-loop
      else await repo.createItem({ cartId: customerCart.id, variantId: item.variantId, quantity: nextQty, priceAtAdd: item.priceAtAdd }, t);
    }

    await repo.update(guestCart, { status: 'MERGED' }, t);
    await repo.update(customerCart, { expiresAt: expiryDate() }, t);
    return present(customerCart, t);
  });
};

module.exports = { getOrCreateCart, getCart, addItem, updateItemQuantity, removeItem, clear, mergeGuestCart, present, MAX_QTY };
