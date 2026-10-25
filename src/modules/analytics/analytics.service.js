'use strict';

const ApiError = require('../../utils/ApiError');
const repo = require('./analytics.repository');

const validateDateRange = (startDate, endDate) => {
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw ApiError.badRequest('startDate must be on or before endDate');
  }
};

const getSales = async (query = {}) => {
  validateDateRange(query.startDate, query.endDate);
  const sales = await repo.getSalesMetrics(query);

  const visits = sales.funnel.visits || 0;
  const purchases = sales.funnel.purchases || 0;
  const conversionRate = visits > 0 ? Number(((purchases / visits) * 100).toFixed(2)) : 0;

  return {
    ...sales,
    conversionRate,
    averageOrderValue: Number(Number(sales.averageOrderValue).toFixed(2)),
    totalRevenue: Number(Number(sales.totalRevenue).toFixed(2)),
    totalSubtotal: Number(Number(sales.totalSubtotal).toFixed(2)),
  };
};

const getCustomers = async (query = {}) => {
  validateDateRange(query.startDate, query.endDate);
  const customers = await repo.getCustomerMetrics(query);

  const total = customers.totalCustomers || 0;
  const repeat = customers.repeatCustomers || 0;
  const repeatRate = total > 0 ? Number(((repeat / total) * 100).toFixed(2)) : 0;

  return {
    ...customers,
    repeatRate,
    averageLTV: Number(Number(customers.averageLTV).toFixed(2)),
    topCustomerSpend: Number(Number(customers.topCustomerSpend).toFixed(2)),
  };
};

const getProducts = async (query = {}) => {
  validateDateRange(query.startDate, query.endDate);
  const products = await repo.getProductMetrics(query);
  return {
    bestSellers: products.bestSellers.map((b) => ({
      ...b,
      totalRevenue: Number(Number(b.totalRevenue).toFixed(2)),
      grossProfit: Number(Number(b.grossProfit).toFixed(2)),
    })),
    popularVariants: products.popularVariants,
  };
};

const getMarketing = async (query = {}) => {
  validateDateRange(query.startDate, query.endDate);
  return repo.getMarketingMetrics(query);
};

const getOperations = async (query = {}) => {
  validateDateRange(query.startDate, query.endDate);
  return repo.getOperationsMetrics(query);
};

const getOverview = async (query = {}) => {
  validateDateRange(query.startDate, query.endDate);

  const [sales, customers, marketing, operations] = await Promise.all([
    repo.getSalesMetrics(query),
    repo.getCustomerMetrics(query),
    repo.getMarketingMetrics(query),
    repo.getOperationsMetrics(query),
  ]);

  return {
    period: {
      startDate: query.startDate || null,
      endDate: query.endDate || null,
    },
    kpi: {
      totalRevenue: Number(Number(sales.totalRevenue).toFixed(2)),
      orderCount: sales.orderCount,
      averageOrderValue: Number(Number(sales.averageOrderValue).toFixed(2)),
      newCustomers: customers.newCustomers,
      repeatRate: customers.totalCustomers > 0 ? Number(((customers.repeatCustomers / customers.totalCustomers) * 100).toFixed(2)) : 0,
      cancellationRate: operations.cancellationRate,
      returnRate: operations.returnRate,
    },
    funnel: sales.funnel,
    referrals: marketing.referrals,
    operationsSummary: {
      totalOrders: operations.totalOrders,
      deliveredOrders: operations.deliveredOrders,
      unitsSold: sales.unitsSold,
    },
  };
};

module.exports = {
  getSales,
  getCustomers,
  getProducts,
  getMarketing,
  getOperations,
  getOverview,
};
