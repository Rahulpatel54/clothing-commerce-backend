'use strict';

const { Op, fn, col } = require('sequelize');
const db = require('../../models');

const couponInclude = { model: db.Coupon, as: 'coupon', attributes: ['id', 'code'] };

const createCampaign = (payload, transaction) => db.Campaign.create(payload, { transaction });

const findCampaignById = (id, transaction) =>
  db.Campaign.findByPk(id, { include: [couponInclude], transaction });

const findCampaignBySlug = (slug, transaction) =>
  db.Campaign.findOne({ where: { slug }, include: [couponInclude], transaction });

const findCampaignByUtm = async ({ utmSource, utmMedium, utmCampaign }, transaction) => {
  const where = { isActive: true };
  if (utmCampaign) where.utmCampaign = utmCampaign;
  if (utmSource) where.utmSource = utmSource;
  if (utmMedium) where.utmMedium = utmMedium;
  return db.Campaign.findOne({ where, transaction });
};

const listCampaigns = async ({ filters = {}, page = 1, limit = 20 }) => {
  const where = {};
  if (filters.channel) where.channel = filters.channel;
  if (filters.isActive != null) where.isActive = filters.isActive;
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { slug: { [Op.iLike]: `%${filters.search}%` } },
    ];
  }

  const offset = (page - 1) * limit;
  return db.Campaign.findAndCountAll({
    where,
    include: [couponInclude],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });
};

const updateCampaign = (campaign, fields, transaction) => campaign.update(fields, { transaction });

const deleteCampaign = (id, transaction) => db.Campaign.destroy({ where: { id }, transaction });

// Events
const recordEvent = (payload, transaction) => db.CampaignEvent.create(payload, { transaction });

const listEvents = async ({ filters = {}, page = 1, limit = 50 }) => {
  const where = {};
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.sessionId) where.sessionId = filters.sessionId;

  const offset = (page - 1) * limit;
  return db.CampaignEvent.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
};

// Campaign performance stats
const getCampaignPerformance = async (campaignId, transaction) => {
  const eventCounts = await db.CampaignEvent.findAll({
    where: { campaignId },
    attributes: ['eventType', [fn('COUNT', col('id')), 'count']],
    group: ['eventType'],
    raw: true,
    transaction,
  });

  const countsMap = {};
  eventCounts.forEach((r) => {
    countsMap[r.eventType] = Number(r.count || 0);
  });

  // Orders attributed to this campaign
  const orderStats = await db.Order.findAll({
    where: { campaignId, paymentStatus: { [Op.in]: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
    attributes: [
      [fn('COUNT', col('id')), 'orderCount'],
      [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'attributedRevenue'],
    ],
    raw: true,
    transaction,
  });

  const orders = orderStats[0] || {};

  return {
    clicks: countsMap.CLICK || 0,
    visits: countsMap.VISIT || 0,
    signups: countsMap.SIGNUP || 0,
    cartAdds: countsMap.CART_ADD || 0,
    checkoutStarts: countsMap.CHECKOUT_START || 0,
    purchases: countsMap.PURCHASE || 0,
    attributedOrders: Number(orders.orderCount || 0),
    attributedRevenue: Number(orders.attributedRevenue || 0),
  };
};

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  createCampaign,
  findCampaignById,
  findCampaignBySlug,
  findCampaignByUtm,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  recordEvent,
  listEvents,
  getCampaignPerformance,
  transaction,
};
