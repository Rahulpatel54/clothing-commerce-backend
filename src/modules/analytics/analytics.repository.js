'use strict';

const { Op, fn, col, literal } = require('sequelize');
const db = require('../../models');

const parseDateStart = (d) => {
  if (!d) return null;
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) {
    parsed.setUTCHours(0, 0, 0, 0);
    return parsed;
  }
  return new Date(`${d}T00:00:00.000Z`);
};

const parseDateEnd = (d) => {
  if (!d) return null;
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) {
    parsed.setUTCHours(23, 59, 59, 999);
    return parsed;
  }
  return new Date(`${d}T23:59:59.999Z`);
};

const dateFilter = (field, startDate, endDate) => {
  const where = {};
  const start = parseDateStart(startDate);
  const end = parseDateEnd(endDate);
  if (start && end) {
    where[field] = { [Op.between]: [start, end] };
  } else if (start) {
    where[field] = { [Op.gte]: start };
  } else if (end) {
    where[field] = { [Op.lte]: end };
  }
  return where;
};

// 1. Sales Analytics: revenue, orders, AOV, units, conversion
const getSalesMetrics = async ({ startDate, endDate } = {}) => {
  const where = {
    paymentStatus: { [Op.in]: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
    ...dateFilter('placedAt', startDate, endDate),
  };

  const orderStats = await db.Order.findAll({
    where,
    attributes: [
      [fn('COUNT', col('id')), 'orderCount'],
      [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'totalRevenue'],
      [fn('COALESCE', fn('SUM', col('subtotal')), 0), 'totalSubtotal'],
      [fn('COALESCE', fn('SUM', col('discount_amount')), 0), 'totalDiscount'],
      [fn('COALESCE', fn('AVG', col('total_amount')), 0), 'averageOrderValue'],
    ],
    raw: true,
  });

  // Units sold
  const itemWhere = {};
  const items = await db.OrderItem.findAll({
    include: [{ model: db.Order, as: 'order', where, attributes: [] }],
    attributes: [[fn('COALESCE', fn('SUM', col('OrderItem.quantity')), 0), 'unitsSold']],
    raw: true,
  });

  // Funnel / Conversion calculation from campaign_events
  const eventWhere = { ...dateFilter('createdAt', startDate, endDate) };
  const eventCounts = await db.CampaignEvent.findAll({
    where: eventWhere,
    attributes: ['eventType', [fn('COUNT', col('id')), 'count']],
    group: ['eventType'],
    raw: true,
  });

  const funnel = {};
  eventCounts.forEach((r) => {
    funnel[r.eventType] = Number(r.count || 0);
  });

  const o = orderStats[0] || {};
  const units = items[0] || {};

  return {
    orderCount: Number(o.orderCount || 0),
    totalRevenue: Number(o.totalRevenue || 0),
    totalSubtotal: Number(o.totalSubtotal || 0),
    totalDiscount: Number(o.totalDiscount || 0),
    averageOrderValue: Number(o.averageOrderValue || 0),
    unitsSold: Number(units.unitsSold || 0),
    funnel: {
      visits: funnel.VISIT || 0,
      cartAdds: funnel.CART_ADD || 0,
      checkoutStarts: funnel.CHECKOUT_START || 0,
      purchases: funnel.PURCHASE || Number(o.orderCount || 0),
    },
  };
};

// 2. Customer Analytics: new vs returning, repeat rate, LTV
const getCustomerMetrics = async ({ startDate, endDate } = {}) => {
  const newCustomerWhere = { ...dateFilter('createdAt', startDate, endDate) };
  const newCustomersCount = await db.Customer.count({ where: newCustomerWhere });
  const totalCustomers = await db.Customer.count();

  // Repeat customers (orderCount > 1)
  const repeatCustomersCount = await db.Customer.count({
    where: { orderCount: { [Op.gt]: 1 } },
  });

  // Lifetime Value (LTV) from customer totalSpend
  const ltvStats = await db.Customer.findAll({
    attributes: [
      [fn('COALESCE', fn('AVG', col('total_spend')), 0), 'averageLTV'],
      [fn('COALESCE', fn('MAX', col('total_spend')), 0), 'maxSpend'],
    ],
    raw: true,
  });

  const ltv = ltvStats[0] || {};

  return {
    newCustomers: newCustomersCount,
    totalCustomers,
    repeatCustomers: repeatCustomersCount,
    oneTimeCustomers: Math.max(0, totalCustomers - repeatCustomersCount),
    averageLTV: Number(ltv.averageLTV || 0),
    topCustomerSpend: Number(ltv.maxSpend || 0),
  };
};

// 3. Product Analytics: best / slow sellers, profitability, variants
const getProductMetrics = async ({ startDate, endDate, limit = 10 } = {}) => {
  // Best sellers based on order_items in period
  const orderWhere = {
    paymentStatus: { [Op.in]: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
    ...dateFilter('placedAt', startDate, endDate),
  };

  const bestSellers = await db.OrderItem.findAll({
    include: [{ model: db.Order, as: 'order', where: orderWhere, attributes: [] }],
    attributes: [
      'productId',
      'productName',
      [fn('SUM', col('OrderItem.quantity')), 'totalSold'],
      [fn('SUM', col('OrderItem.line_total')), 'totalRevenue'],
      [
        fn('SUM', literal('("OrderItem"."line_total" - ("OrderItem"."quantity" * COALESCE("OrderItem"."cost_price", 0)))')),
        'grossProfit',
      ],
    ],
    group: ['OrderItem.product_id', 'OrderItem.product_name'],
    order: [[literal('"totalSold"'), 'DESC']],
    limit,
    raw: true,
  });

  // Size and color popularity from order_items
  const variantPopularity = await db.OrderItem.findAll({
    include: [{ model: db.Order, as: 'order', where: orderWhere, attributes: [] }],
    attributes: [
      'size',
      'color',
      [fn('SUM', col('OrderItem.quantity')), 'quantitySold'],
    ],
    group: ['size', 'color'],
    order: [[literal('"quantitySold"'), 'DESC']],
    limit: 10,
    raw: true,
  });

  return {
    bestSellers: bestSellers.map((b) => ({
      productId: b.productId,
      productName: b.productName,
      totalSold: Number(b.totalSold || 0),
      totalRevenue: Number(b.totalRevenue || 0),
      grossProfit: Number(b.grossProfit || 0),
    })),
    popularVariants: variantPopularity.map((v) => ({
      size: v.size || 'N/A',
      color: v.color || 'N/A',
      quantitySold: Number(v.quantitySold || 0),
    })),
  };
};

// 4. Marketing Analytics: referral conversions, campaign performance, acquisition sources, UGC
const getMarketingMetrics = async ({ startDate, endDate } = {}) => {
  // Referral conversions
  const referralWhere = { ...dateFilter('createdAt', startDate, endDate) };
  const referralStages = await db.ReferralEvent.findAll({
    where: referralWhere,
    attributes: ['stage', [fn('COUNT', col('id')), 'count']],
    group: ['stage'],
    raw: true,
  });

  const referralFunnel = {};
  referralStages.forEach((r) => {
    referralFunnel[r.stage] = Number(r.count || 0);
  });

  // Acquisition sources from customers
  const customerAcquisitions = await db.Customer.findAll({
    where: { acquisitionSource: { [Op.ne]: null } },
    attributes: ['acquisitionSource', [fn('COUNT', col('id')), 'count']],
    group: ['acquisitionSource'],
    raw: true,
  });

  // UGC submission counts & approved rewards
  const ugcStats = await db.UgcSubmission.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  const ugcSummary = {};
  ugcStats.forEach((u) => {
    ugcSummary[u.status] = Number(u.count || 0);
  });

  return {
    referrals: {
      signups: referralFunnel.SIGNED_UP || 0,
      firstPurchases: referralFunnel.FIRST_PURCHASE || 0,
      delivered: referralFunnel.DELIVERED || 0,
      rewardsIssued: referralFunnel.REWARD_ISSUED || 0,
      fraudFlagged: referralFunnel.FRAUD_FLAGGED || 0,
    },
    acquisitionSources: customerAcquisitions.map((a) => ({
      source: a.acquisitionSource,
      count: Number(a.count || 0),
    })),
    ugc: {
      pending: ugcSummary.PENDING || 0,
      approved: ugcSummary.APPROVED || 0,
      rejected: ugcSummary.REJECTED || 0,
    },
  };
};

// 5. Operations Analytics: return rate, cancellation rate, delivery performance, inventory turnover
const getOperationsMetrics = async ({ startDate, endDate } = {}) => {
  const orderWhere = { ...dateFilter('placedAt', startDate, endDate) };

  const statusCounts = await db.Order.findAll({
    where: orderWhere,
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  let totalOrders = 0;
  const byStatus = {};
  statusCounts.forEach((s) => {
    const count = Number(s.count || 0);
    totalOrders += count;
    byStatus[s.status] = count;
  });

  const cancelledCount = byStatus.CANCELLED || 0;
  const returnedCount = (byStatus.RETURNED || 0) + (byStatus.REFUNDED || 0);
  const deliveredCount = byStatus.DELIVERED || 0;

  // Inventory movements summary in period
  const movementWhere = { ...dateFilter('createdAt', startDate, endDate) };
  const movementCounts = await db.InventoryMovement.findAll({
    where: movementWhere,
    attributes: ['type', [fn('SUM', col('quantity')), 'totalQuantity']],
    group: ['type'],
    raw: true,
  });

  const movements = {};
  movementCounts.forEach((m) => {
    movements[m.type] = Number(m.totalQuantity || 0);
  });

  return {
    totalOrders,
    cancelledOrders: cancelledCount,
    returnedOrders: returnedCount,
    deliveredOrders: deliveredCount,
    cancellationRate: totalOrders > 0 ? Number(((cancelledCount / totalOrders) * 100).toFixed(2)) : 0,
    returnRate: deliveredCount > 0 ? Number(((returnedCount / deliveredCount) * 100).toFixed(2)) : 0,
    inventoryMovements: {
      received: movements.PURCHASE || 0,
      sold: movements.ORDER || 0,
      damaged: movements.DAMAGE || 0,
      restocked: movements.RETURN || 0,
    },
  };
};

module.exports = {
  getSalesMetrics,
  getCustomerMetrics,
  getProductMetrics,
  getMarketingMetrics,
  getOperationsMetrics,
};
