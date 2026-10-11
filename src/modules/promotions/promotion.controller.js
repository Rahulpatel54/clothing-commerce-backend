'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const db = require('../../models');
const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');

const list = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /promotions:
   *   get:
   *     tags: [Promotions]
   *     summary: List promotions (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: isActive, schema: { type: boolean } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: Paginated promotions }
   */
  const { page, limit, offset } = getPagination(req.query);
  const where = req.query.isActive !== undefined ? { isActive: req.query.isActive } : {};
  const { rows, count } = await db.Promotion.findAndCountAll({ where, include: [{ model: db.PromotionRule, as: 'rules' }], limit, offset, order: [['createdAt', 'DESC']] });
  return paginated(res, { rows, count, page, limit });
});

const get = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /promotions/{id}:
   *   get:
   *     tags: [Promotions]
   *     summary: Get one promotion with its rules and coupons (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Promotion }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const promo = await db.Promotion.findByPk(req.params.id, { include: [{ model: db.PromotionRule, as: 'rules' }, { model: db.Coupon, as: 'coupons' }] });
  if (!promo) throw ApiError.notFound('Promotion not found');
  return success(res, { data: promo });
});

const create = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /promotions:
   *   post:
   *     tags: [Promotions]
   *     summary: Create a promotion, optionally with product/category rules (staff)
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, type, value]
   *             properties:
   *               name: { type: string }
   *               type: { type: string, enum: [PERCENTAGE, FIXED] }
   *               value: { type: number }
   *               minOrderAmount: { type: number }
   *               maxDiscountAmount: { type: number, nullable: true }
   *               startsAt: { type: string, format: date-time }
   *               endsAt: { type: string, format: date-time }
   *               stackable: { type: boolean }
   *               firstOrderOnly: { type: boolean }
   *               customerId: { type: string, format: uuid, nullable: true, description: "Restricts the promotion to a single customer" }
   *               rules:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     ruleType: { type: string, enum: [PRODUCT_INCLUDE, PRODUCT_EXCLUDE, CATEGORY_INCLUDE, CATEGORY_EXCLUDE] }
   *                     targetId: { type: string, format: uuid }
   *     responses:
   *       201: { description: Promotion created }
   */
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
  /**
   * @openapi
   * /promotions/{id}:
   *   patch:
   *     tags: [Promotions]
   *     summary: Update a promotion (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: Promotion updated }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const promo = await db.Promotion.findByPk(req.params.id);
  if (!promo) throw ApiError.notFound('Promotion not found');
  const before = promo.toJSON();
  await promo.update(req.body);
  await audit.record(req, { action: 'promotion.update', entityType: 'Promotion', entityId: promo.id, before, after: promo });
  return success(res, { data: promo, message: 'Promotion updated' });
});

const createCoupon = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /promotions/{id}/coupons:
   *   post:
   *     tags: [Promotions]
   *     summary: Issue a coupon code for a promotion (staff)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [code]
   *             properties:
   *               code: { type: string }
   *               usageLimit: { type: integer, nullable: true, description: "Global redemption cap; unlimited when omitted" }
   *               usageLimitPerCustomer: { type: integer, default: 1 }
   *     responses:
   *       201: { description: Coupon created }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const promo = await db.Promotion.findByPk(req.params.id);
  if (!promo) throw ApiError.notFound('Promotion not found');
  const coupon = await db.Coupon.create({ ...req.body, promotionId: promo.id });
  await audit.record(req, { action: 'coupon.create', entityType: 'Coupon', entityId: coupon.id, after: coupon });
  return success(res, { data: coupon, message: 'Coupon created', statusCode: 201 });
});

module.exports = { list, get, create, update, createCoupon };
