'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./finance.repository');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const getPnLReport = async ({ startDate, endDate } = {}) => {
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw ApiError.badRequest('startDate must be on or before endDate');
  }

  const [revenue, cogs, expenses] = await Promise.all([
    repo.getRevenueSummary(startDate, endDate),
    repo.getCOGSSummary(startDate, endDate),
    repo.getExpensesSummary(startDate, endDate),
  ]);

  const grossSales = round2(revenue.grossSubtotal);
  const discounts = round2(revenue.totalDiscounts);
  const refunds = round2(revenue.totalRefunds);
  const shippingCollected = round2(revenue.totalShipping);
  const taxCollected = round2(revenue.totalTax);

  const netSales = round2(grossSales - discounts - refunds);
  const netRevenue = round2(netSales + shippingCollected);
  const totalCOGS = round2(cogs.totalCOGS);

  const grossProfit = round2(netSales - totalCOGS);
  const grossMarginPercentage = netSales > 0 ? round2((grossProfit / netSales) * 100) : 0;

  const operatingExpenses = round2(expenses.totalOperatingExpenses);
  const operatingIncome = round2(grossProfit - operatingExpenses);
  const netProfit = operatingIncome;
  const netMarginPercentage = netSales > 0 ? round2((netProfit / netSales) * 100) : 0;

  return {
    period: {
      startDate: startDate || null,
      endDate: endDate || null,
    },
    revenue: {
      grossSales,
      discounts,
      refunds,
      netSales,
      shippingCollected,
      taxCollected,
      netRevenue,
      orderCount: revenue.orderCount,
      refundCount: revenue.refundCount,
    },
    costOfGoodsSold: {
      totalCOGS,
      unitsSold: cogs.unitsSold,
      itemsSold: cogs.itemsSold,
    },
    profitability: {
      grossProfit,
      grossMarginPercentage,
      operatingExpenses,
      operatingIncome,
      netProfit,
      netMarginPercentage,
    },
    expensesBreakdown: expenses.categories.map((c) => ({
      ...c,
      totalAmount: round2(c.totalAmount),
    })),
  };
};

const getTraceRecords = async (type, query = {}) => {
  if (type === 'orders') {
    return repo.listOrderTrace(query);
  }
  if (type === 'expenses') {
    return repo.listExpenseTrace(query);
  }
  throw ApiError.badRequest(`Unknown trace record type: "${type}". Supported types are "orders" or "expenses"`);
};

// Period Management
const createPeriod = async (req, payload) => {
  if (new Date(payload.startDate) > new Date(payload.endDate)) {
    throw ApiError.badRequest('startDate must be on or before endDate');
  }

  const existing = await repo.findPeriodByName(payload.name.trim());
  if (existing) {
    throw ApiError.conflict('A financial period with this name already exists');
  }

  const period = await repo.createPeriod({
    name: payload.name.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    isClosed: false,
  });

  await audit.record(req, {
    action: 'financial_period.create',
    entityType: 'FinancialPeriod',
    entityId: period.id,
    after: period.toJSON ? period.toJSON() : period,
  });

  return period;
};

const listPeriods = async (query = {}) => {
  return repo.listPeriods(query);
};

const closePeriod = async (req, id) => {
  const period = await repo.findPeriodById(id);
  if (!period) throw ApiError.notFound('Financial period not found');

  if (period.isClosed) {
    throw ApiError.conflict('Financial period is already closed');
  }

  const fields = {
    isClosed: true,
    closedAt: new Date(),
    closedBy: req.user ? req.user.id : null,
  };

  const before = period.toJSON ? period.toJSON() : period;
  await repo.updatePeriod(period, fields);

  await audit.record(req, {
    action: 'financial_period.close',
    entityType: 'FinancialPeriod',
    entityId: id,
    before,
    after: fields,
  });

  return repo.findPeriodById(id);
};

module.exports = {
  getPnLReport,
  getTraceRecords,
  createPeriod,
  listPeriods,
  closePeriod,
};
