'use strict';

const { Op } = require('sequelize');
const db = require('../../models');

const ruleInclude = { model: db.PromotionRule, as: 'rules' };

const findCouponByCode = (code, transaction) =>
  db.Coupon.findOne({ where: { code: String(code).trim().toUpperCase() }, include: [{ model: db.Promotion, as: 'promotion', include: [ruleInclude] }], transaction });

// Automatic promotions only: no coupon required, active, within any configured time window,
// and either global or scoped to this exact customer.
const findAutomaticPromotions = (customerId, transaction) =>
  db.Promotion.findAll({
    where: {
      isActive: true,
      [Op.or]: [{ customerId: null }, ...(customerId ? [{ customerId }] : [])],
      [Op.and]: [
        { [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: new Date() } }] },
        { [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: new Date() } }] },
      ],
    },
    include: [ruleInclude],
    order: [['priority', 'DESC']],
    transaction,
  });

const countCustomerRedemptions = (couponId, customerId, transaction) =>
  db.CouponRedemption.count({ where: { couponId, customerId }, transaction });

const createRedemption = (payload, transaction) => db.CouponRedemption.create(payload, { transaction });
const incrementCouponUsage = (coupon, transaction) => coupon.increment('usedCount', { by: 1, transaction });

const customerOrderCount = async (customerId, transaction) => {
  // Loaded lazily: the orders module owns order history and may not exist yet in isolated tests.
  try {
    // eslint-disable-next-line global-require
    const ordersDb = require('../../models');
    if (!ordersDb.Order) return 0;
    return await ordersDb.Order.count({ where: { customerId, status: { [Op.notIn]: ['CANCELLED'] } }, transaction });
  } catch (err) {
    return 0;
  }
};

module.exports = { findCouponByCode, findAutomaticPromotions, countCustomerRedemptions, createRedemption, incrementCouponUsage, customerOrderCount };
