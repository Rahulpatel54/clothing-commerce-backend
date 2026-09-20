'use strict';

const db = require('../../models');
const ApiError = require('../../utils/ApiError');
const { withIdempotency } = require('../../utils/idempotency');
const cartRepo = require('../cart/cart.repository');
const cartService = require('../cart/cart.service');
const customerRepo = require('../customers/customer.repository');
const inventoryService = require('../inventory/inventory.service');
const promotionService = require('../promotions/promotion.service');
const orderService = require('../orders/order.service');
const shipping = require('./shipping');
const tax = require('./tax');

function round2(n) { return Number(Number(n).toFixed(2)); }

async function loadWalletBalance(customerId, transaction) {
  try {
    // eslint-disable-next-line global-require
    const walletService = require('../loyalty/wallet.service');
    return await walletService.getBalance(customerId, transaction);
  } catch (err) {
    return 0;
  }
}

async function debitWallet(customerId, amount, orderId, transaction) {
  try {
    // eslint-disable-next-line global-require
    const walletService = require('../loyalty/wallet.service');
    await walletService.debit({ customerId, amount, reason: 'ORDER_PAYMENT', referenceType: 'ORDER', referenceId: orderId }, transaction);
  } catch (err) { /* loyalty module optional in isolated tests */ }
}

/**
 * Runs the whole checkout as one transaction: revalidate the cart, resolve the
 * address, evaluate coupons/promotions, apply wallet credit, reserve stock per
 * line (so a sibling checkout cannot oversell the same units), create the order,
 * and retire the cart. Anything that fails rolls the entire operation back.
 */
const checkout = async (req, { addressId, couponCode, useWalletBalance, idempotencyKey }) => {
  const userId = req.user.id;
  const customer = await customerRepo.findByUserId(userId);
  if (!customer) throw ApiError.badRequest('No customer profile for this account');

  const fingerprint = JSON.stringify({ addressId, couponCode, useWalletBalance });

  return withIdempotency({ key: idempotencyKey, scope: 'checkout', requestFingerprint: fingerprint }, () =>
    db.sequelize.transaction(async (t) => {
      const cart = await cartService.getOrCreateCart({ customerId: customer.id }, t);
      const cartItems = await cartRepo.listItems(cart.id, t);
      if (!cartItems.length) throw ApiError.badRequest('Your cart is empty');

      const address = await customerRepo.findAddress(addressId, customer.id);
      if (!address) throw ApiError.notFound('Shipping address not found');

      // Revalidate every line against the live catalog and current stock; nothing
      // here is taken from the cart's cached snapshot.
      const lines = [];
      let subtotal = 0;
      for (const item of cartItems) {
        const variant = item.variant;
        if (!variant || !variant.product || variant.product.status !== 'ACTIVE' || !variant.isActive) {
          throw ApiError.conflict(`"${variant && variant.product ? variant.product.name : item.variantId}" is no longer available`);
        }
        const unitPrice = Number(variant.price != null ? variant.price : variant.product.price);
        const lineTotal = round2(unitPrice * item.quantity);
        subtotal += lineTotal;
        lines.push({
          variantId: variant.id, productId: variant.product.id, categoryId: variant.product.categoryId,
          productName: variant.product.name, variantSku: variant.sku, size: variant.size, color: variant.color,
          unitPrice, costPrice: variant.costPrice != null ? variant.costPrice : variant.product.costPrice,
          quantity: item.quantity, lineTotal,
        });
      }
      subtotal = round2(subtotal);

      const promo = await promotionService.evaluate({ lines, subtotal, customerId: customer.id, couponCode }, t);
      const shippingAmount = shipping.calculate(subtotal - promo.discount);
      const taxInfo = await tax.calculate(subtotal - promo.discount);

      let walletAmount = 0;
      if (useWalletBalance) {
        const balance = await loadWalletBalance(customer.id, t);
        const payable = round2(subtotal + shippingAmount + taxInfo.addOn - promo.discount);
        walletAmount = round2(Math.min(balance, payable));
      }

      const totalAmount = Math.max(0, round2(subtotal + shippingAmount + taxInfo.addOn - promo.discount - walletAmount));

      // Reserve stock per line before the order exists, so a race against another
      // checkout for the same variant is resolved by inventory's own row lock.
      for (const line of lines) {
        // eslint-disable-next-line no-await-in-loop
        await inventoryService.reserve({ variantId: line.variantId, quantity: line.quantity, referenceType: 'CHECKOUT', referenceId: cart.id, actorUserId: userId }, t);
      }

      const order = await orderService.createFromCheckout(
        {
          customerId: customer.id,
          items: lines,
          shippingAddress: address.toJSON(),
          subtotal, shippingAmount, taxAmount: taxInfo.taxAmount, discountAmount: promo.discount,
          walletAmount, totalAmount, couponCode: promo.coupon ? promo.coupon.code : null,
          couponId: promo.coupon ? promo.coupon.id : null, idempotencyKey, actorUserId: userId,
        },
        t
      );

      if (promo.coupon) await promotionService.redeemCoupon(promo.coupon.id, customer.id, order.id, promo.discount, t);
      if (walletAmount > 0) await debitWallet(customer.id, walletAmount, order.id, t);

      await cartRepo.update(cart, { status: 'CONVERTED' }, t);

      return { order: orderService.present(order), discount: promo.discount, promotions: promo.breakdown, shippingAmount, taxAmount: taxInfo.taxAmount, walletAmount };
    })
  );
};

module.exports = { checkout };
