'use strict';

const { Op, fn, col } = require('sequelize');
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

// Financial Periods
const createPeriod = (payload, transaction) => db.FinancialPeriod.create(payload, { transaction });

const findPeriodById = (id, transaction) => db.FinancialPeriod.findByPk(id, { transaction });

const findPeriodByName = (name, transaction) => db.FinancialPeriod.findOne({ where: { name }, transaction });

const listPeriods = async ({ page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;
  return db.FinancialPeriod.findAndCountAll({
    order: [['startDate', 'DESC']],
    limit,
    offset,
  });
};

const updatePeriod = (period, fields, transaction) => period.update(fields, { transaction });

// Revenue Aggregation
const getRevenueSummary = async (startDate, endDate, transaction) => {
  // Orders that are paid / placed in range
  const orderWhere = {
    paymentStatus: { [Op.in]: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
  };

  const start = parseDateStart(startDate);
  const end = parseDateEnd(endDate);
  if (start && end) {
    orderWhere.placedAt = { [Op.between]: [start, end] };
  } else if (start) {
    orderWhere.placedAt = { [Op.gte]: start };
  } else if (end) {
    orderWhere.placedAt = { [Op.lte]: end };
  }

  const orderRows = await db.Order.findAll({
    where: orderWhere,
    attributes: [
      [fn('COUNT', col('id')), 'orderCount'],
      [fn('COALESCE', fn('SUM', col('subtotal')), 0), 'grossSubtotal'],
      [fn('COALESCE', fn('SUM', col('discount_amount')), 0), 'totalDiscounts'],
      [fn('COALESCE', fn('SUM', col('shipping_amount')), 0), 'totalShipping'],
      [fn('COALESCE', fn('SUM', col('tax_amount')), 0), 'totalTax'],
      [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'totalPaid'],
    ],
    raw: true,
    transaction,
  });

  // Refunds issued in date range
  const refundWhere = { status: 'COMPLETED' };
  const refundStart = parseDateStart(startDate);
  const refundEnd = parseDateEnd(endDate);
  if (refundStart && refundEnd) {
    refundWhere.createdAt = { [Op.between]: [refundStart, refundEnd] };
  } else if (refundStart) {
    refundWhere.createdAt = { [Op.gte]: refundStart };
  } else if (refundEnd) {
    refundWhere.createdAt = { [Op.lte]: refundEnd };
  }

  const refundRows = await db.Refund.findAll({
    where: refundWhere,
    attributes: [
      [fn('COUNT', col('id')), 'refundCount'],
      [fn('COALESCE', fn('SUM', col('amount')), 0), 'totalRefunds'],
    ],
    raw: true,
    transaction,
  });

  const orders = orderRows[0] || {};
  const refunds = refundRows[0] || {};

  return {
    orderCount: Number(orders.orderCount || 0),
    grossSubtotal: Number(orders.grossSubtotal || 0),
    totalDiscounts: Number(orders.totalDiscounts || 0),
    totalShipping: Number(orders.totalShipping || 0),
    totalTax: Number(orders.totalTax || 0),
    totalPaid: Number(orders.totalPaid || 0),
    refundCount: Number(refunds.refundCount || 0),
    totalRefunds: Number(refunds.totalRefunds || 0),
  };
};

// Cost of Goods Sold (COGS) aggregated directly from order_items.cost_price * quantity
const getCOGSSummary = async (startDate, endDate, transaction) => {
  const orderWhere = {
    status: { [Op.notIn]: ['CANCELLED'] },
    paymentStatus: { [Op.in]: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
  };

  const start = parseDateStart(startDate);
  const end = parseDateEnd(endDate);
  if (start && end) {
    orderWhere.placedAt = { [Op.between]: [start, end] };
  } else if (start) {
    orderWhere.placedAt = { [Op.gte]: start };
  } else if (end) {
    orderWhere.placedAt = { [Op.lte]: end };
  }

  const rows = await db.OrderItem.findAll({
    include: [
      {
        model: db.Order,
        as: 'order',
        where: orderWhere,
        attributes: [],
      },
    ],
    attributes: [
      [fn('COUNT', col('OrderItem.id')), 'itemsSold'],
      [fn('COALESCE', fn('SUM', col('OrderItem.quantity')), 0), 'unitsSold'],
      [
        fn('COALESCE', fn('SUM', db.sequelize.literal('("OrderItem"."quantity" * COALESCE("OrderItem"."cost_price", 0))')), 0),
        'totalCOGS',
      ],
    ],
    raw: true,
    transaction,
  });

  const summary = rows[0] || {};
  return {
    itemsSold: Number(summary.itemsSold || 0),
    unitsSold: Number(summary.unitsSold || 0),
    totalCOGS: Number(summary.totalCOGS || 0),
  };
};

// Operating Expenses Breakdown
const getExpensesSummary = async (startDate, endDate, transaction) => {
  const expenseWhere = {
    status: { [Op.in]: ['PAID', 'APPROVED'] },
  };

  if (startDate && endDate) {
    expenseWhere.date = { [Op.between]: [startDate, endDate] };
  } else if (startDate) {
    expenseWhere.date = { [Op.gte]: startDate };
  } else if (endDate) {
    expenseWhere.date = { [Op.lte]: endDate };
  }

  const rows = await db.Expense.findAll({
    where: expenseWhere,
    include: [
      {
        model: db.ExpenseCategory,
        as: 'category',
        attributes: ['id', 'name', 'slug'],
      },
    ],
    attributes: [
      'categoryId',
      [fn('COUNT', col('Expense.id')), 'count'],
      [fn('COALESCE', fn('SUM', col('Expense.amount')), 0), 'totalAmount'],
    ],
    group: ['Expense.category_id', 'category.id', 'category.name', 'category.slug'],
    raw: true,
    transaction,
  });

  let totalOperatingExpenses = 0;
  const categories = rows.map((r) => {
    const total = Number(r.totalAmount || 0);
    totalOperatingExpenses += total;
    return {
      categoryId: r.categoryId,
      categoryName: r['category.name'],
      categorySlug: r['category.slug'],
      count: Number(r.count || 0),
      totalAmount: total,
    };
  });

  return {
    totalOperatingExpenses,
    categories,
  };
};

// Trace Records
const listOrderTrace = async ({ startDate, endDate, page = 1, limit = 20 }) => {
  const where = { paymentStatus: { [Op.in]: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } };
  const start = parseDateStart(startDate);
  const end = parseDateEnd(endDate);
  if (start && end) {
    where.placedAt = { [Op.between]: [start, end] };
  } else if (start) {
    where.placedAt = { [Op.gte]: start };
  } else if (end) {
    where.placedAt = { [Op.lte]: end };
  }

  const offset = (page - 1) * limit;
  return db.Order.findAndCountAll({
    where,
    attributes: ['id', 'orderNumber', 'status', 'paymentStatus', 'subtotal', 'discountAmount', 'shippingAmount', 'taxAmount', 'totalAmount', 'placedAt'],
    order: [['placedAt', 'DESC']],
    limit,
    offset,
  });
};

const listExpenseTrace = async ({ startDate, endDate, page = 1, limit = 20 }) => {
  const where = { status: { [Op.in]: ['PAID', 'APPROVED'] } };
  if (startDate && endDate) {
    where.date = { [Op.between]: [startDate, endDate] };
  }

  const offset = (page - 1) * limit;
  return db.Expense.findAndCountAll({
    where,
    include: [{ model: db.ExpenseCategory, as: 'category', attributes: ['id', 'name', 'slug'] }],
    order: [['date', 'DESC']],
    limit,
    offset,
  });
};

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  createPeriod,
  findPeriodById,
  findPeriodByName,
  listPeriods,
  updatePeriod,
  getRevenueSummary,
  getCOGSSummary,
  getExpensesSummary,
  listOrderTrace,
  listExpenseTrace,
  transaction,
};
