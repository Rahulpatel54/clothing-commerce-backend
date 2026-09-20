'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const db = require('../../models');
const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');

const list = catchAsync(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const where = req.query.isActive !== undefined ? { isActive: req.query.isActive } : {};
  const { rows, count } = await db.Promotion.findAndCountAll({ where, include: [{ model: db.PromotionRule, as: 'rules' }], limit, offset, order: [['createdAt', 'DESC']] });
  return paginated(res, { rows, count, page, limit });
});

const get = catchAsync(async (req, res) => {
  const promo = await db.Promotion.findByPk(req.params.id, { include: [{ model: db.PromotionRule, as: 'rules' }, { model: db.Coupon, as: 'coupons' }] });
  if (!promo) throw ApiError.notFound('Promotion not found');
  return success(res, { data: promo });
});

const create = catchAsync(async (req, res) => {
  const { rules, ...body } = req.body;
  const promo = await db.sequelize.transaction(async (t) => {
    const created = await db.Promotion.create(body, { transaction: t });
    if (rules && rules.length) await db.PromotionRule.bulkCreate(rules.map((r) => ({ ...r, promotionId: created.id })), { transaction: t });
    await audit.record(req, { action: 'promotion.create', entityType: 'Promotion', entityId: created.id, after: created, transaction: t });
    return created;
  });
  return success(res, { data: promo, message: 'Promotion created', statusCode: 201 });
});

const update = catchAsync(async (req, res) => {
  const promo = await db.Promotion.findByPk(req.params.id);
  if (!promo) throw ApiError.notFound('Promotion not found');
  const before = promo.toJSON();
  await promo.update(req.body);
  await audit.record(req, { action: 'promotion.update', entityType: 'Promotion', entityId: promo.id, before, after: promo });
  return success(res, { data: promo, message: 'Promotion updated' });
});

const createCoupon = catchAsync(async (req, res) => {
  const promo = await db.Promotion.findByPk(req.params.id);
  if (!promo) throw ApiError.notFound('Promotion not found');
  const coupon = await db.Coupon.create({ ...req.body, promotionId: promo.id });
  await audit.record(req, { action: 'coupon.create', entityType: 'Coupon', entityId: coupon.id, after: coupon });
  return success(res, { data: coupon, message: 'Coupon created', statusCode: 201 });
});

module.exports = { list, get, create, update, createCoupon };
