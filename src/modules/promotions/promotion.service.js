'use strict';

const ApiError = require('../../utils/ApiError');
const repo = require('./promotion.repository');

function round2(n) { return Number(n.toFixed(2)); }

// Which cart lines a promotion's rules let it discount. No INCLUDE rule means "all
// items"; any EXCLUDE rule matching a line removes that promotion from consideration
// entirely, since a partial exclusion inside a single order gets confusing fast.
function eligibleLines(promotion, lines) {
  const rules = promotion.rules || [];
  const includes = rules.filter((r) => r.ruleType === 'PRODUCT_INCLUDE' || r.ruleType === 'CATEGORY_INCLUDE');
  const excludes = rules.filter((r) => r.ruleType === 'PRODUCT_EXCLUDE' || r.ruleType === 'CATEGORY_EXCLUDE');

  const matchesRule = (line, rule) =>
    (rule.ruleType === 'PRODUCT_INCLUDE' || rule.ruleType === 'PRODUCT_EXCLUDE') ? line.productId === rule.targetId : line.categoryId === rule.targetId;

  if (excludes.some((rule) => lines.some((line) => matchesRule(line, rule)))) return null;

  if (!includes.length) return lines;
  const eligible = lines.filter((line) => includes.some((rule) => matchesRule(line, rule)));
  return eligible.length ? eligible : null;
}

function discountFor(promotion, eligibleAmount) {
  let discount = promotion.type === 'PERCENTAGE' ? (eligibleAmount * Number(promotion.value)) / 100 : Number(promotion.value);
  if (promotion.maxDiscountAmount != null) discount = Math.min(discount, Number(promotion.maxDiscountAmount));
  return Math.max(0, Math.min(discount, eligibleAmount));
}

/**
 * Evaluates every promotion (automatic + an optional coupon) against a cart and
 * returns the combined, server-computed discount. Nothing here trusts a client-
 * supplied amount; every figure is derived from the promotion rows and the cart lines.
 *
 * lines: [{ productId, categoryId, lineTotal }], subtotal: number
 */
const evaluate = async ({ lines, subtotal, customerId, couponCode }, transaction) => {
  const candidates = [];
  let coupon = null;

  if (couponCode) {
    coupon = await repo.findCouponByCode(couponCode, transaction);
    if (!coupon || !coupon.isActive) throw ApiError.badRequest('Invalid coupon code');
    const promotion = coupon.promotion;
    if (!promotion || !promotion.isActive) throw ApiError.badRequest('This coupon is no longer active');
    if (promotion.startsAt && promotion.startsAt > new Date()) throw ApiError.badRequest('This coupon is not active yet');
    if (promotion.endsAt && promotion.endsAt < new Date()) throw ApiError.badRequest('This coupon has expired');
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw ApiError.badRequest('This coupon has been fully redeemed');

    if (customerId) {
      const used = await repo.countCustomerRedemptions(coupon.id, customerId, transaction);
      if (used >= coupon.usageLimitPerCustomer) throw ApiError.badRequest('You have already used this coupon');
    }
    if (promotion.customerId && promotion.customerId !== customerId) throw ApiError.badRequest('This coupon is not valid for your account');
    if (promotion.firstOrderOnly) {
      const orderCount = await repo.customerOrderCount(customerId, transaction);
      if (orderCount > 0) throw ApiError.badRequest('This coupon is only valid on your first order');
    }
    if (Number(promotion.minOrderAmount) > subtotal) {
      throw ApiError.badRequest(`This coupon requires a minimum order of ${promotion.minOrderAmount}`);
    }

    candidates.push({ promotion, forced: true });
  }

  const automatic = await repo.findAutomaticPromotions(customerId, transaction);
  for (const promotion of automatic) {
    if (promotion.firstOrderOnly) {
      // eslint-disable-next-line no-await-in-loop
      const orderCount = await repo.customerOrderCount(customerId, transaction);
      if (orderCount > 0) continue;
    }
    if (Number(promotion.minOrderAmount) > subtotal) continue;
    candidates.push({ promotion, forced: false });
  }

  // Stacking: a non-stackable promotion (the coupon, if forced and non-stackable,
  // takes precedence) must be applied alone. Otherwise combine every stackable
  // promotion, highest priority first.
  const forcedNonStackable = candidates.find((c) => c.forced && !c.promotion.stackable);
  let applied;
  if (forcedNonStackable) {
    applied = [forcedNonStackable];
  } else {
    const nonStackableCandidate = candidates.find((c) => !c.promotion.stackable);
    applied = nonStackableCandidate ? [nonStackableCandidate] : candidates.filter((c) => c.promotion.stackable);
  }

  const breakdown = [];
  let totalDiscount = 0;
  for (const { promotion } of applied) {
    const eligible = eligibleLines(promotion, lines);
    if (!eligible) continue;
    const eligibleAmount = round2(eligible.reduce((sum, l) => sum + l.lineTotal, 0));
    const discount = round2(discountFor(promotion, eligibleAmount));
    if (discount <= 0) continue;
    breakdown.push({ promotionId: promotion.id, name: promotion.name, discount });
    totalDiscount += discount;
  }

  totalDiscount = round2(Math.min(totalDiscount, subtotal));

  return { discount: totalDiscount, breakdown, coupon: coupon ? { id: coupon.id, code: coupon.code } : null };
};

const redeemCoupon = async (couponId, customerId, orderId, discountAmount, transaction) => {
  const coupon = await require('../../models').Coupon.findByPk(couponId, { transaction });
  if (!coupon) return null;
  await repo.createRedemption({ couponId, customerId, orderId, discountAmount }, transaction);
  await repo.incrementCouponUsage(coupon, transaction);
  return coupon;
};

module.exports = { evaluate, redeemCoupon, eligibleLines, discountFor };
