'use strict';

jest.mock('../src/modules/analytics/analytics.repository');

const repo = require('../src/modules/analytics/analytics.repository');
const service = require('../src/modules/analytics/analytics.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Sales Analytics', () => {
  it('computes sales metrics and conversion rate', async () => {
    repo.getSalesMetrics.mockResolvedValue({
      orderCount: 20,
      totalRevenue: 50000,
      totalSubtotal: 48000,
      totalDiscount: 2000,
      averageOrderValue: 2500,
      unitsSold: 40,
      funnel: {
        visits: 1000,
        cartAdds: 100,
        checkoutStarts: 40,
        purchases: 20,
      },
    });

    const result = await service.getSales({ startDate: '2026-10-01', endDate: '2026-10-31' });

    expect(result.totalRevenue).toBe(50000);
    expect(result.orderCount).toBe(20);
    expect(result.unitsSold).toBe(40);
    // Conversion rate: (20 / 1000) * 100 = 2%
    expect(result.conversionRate).toBe(2);
  });

  it('rejects an invalid date range (400)', async () => {
    await expect(
      service.getSales({ startDate: '2026-10-31', endDate: '2026-10-01' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Customer Analytics', () => {
  it('computes customer acquisition, repeat rate, and LTV', async () => {
    repo.getCustomerMetrics.mockResolvedValue({
      newCustomers: 15,
      totalCustomers: 100,
      repeatCustomers: 30,
      oneTimeCustomers: 70,
      averageLTV: 4500.5,
      topCustomerSpend: 25000,
    });

    const result = await service.getCustomers();
    expect(result.newCustomers).toBe(15);
    expect(result.totalCustomers).toBe(100);
    // Repeat rate: (30 / 100) * 100 = 30%
    expect(result.repeatRate).toBe(30);
    expect(result.averageLTV).toBe(4500.5);
  });
});

describe('Product Analytics', () => {
  it('returns best seller rankings and variant popularity', async () => {
    repo.getProductMetrics.mockResolvedValue({
      bestSellers: [
        { productId: 'p1', productName: 'Classic Hoodie', totalSold: 120, totalRevenue: 120000, grossProfit: 72000 },
      ],
      popularVariants: [{ size: 'L', color: 'Black', quantitySold: 60 }],
    });

    const result = await service.getProducts();
    expect(result.bestSellers.length).toBe(1);
    expect(result.bestSellers[0].productName).toBe('Classic Hoodie');
    expect(result.popularVariants[0].size).toBe('L');
  });
});

describe('Operations Analytics', () => {
  it('computes cancellation and return rates', async () => {
    repo.getOperationsMetrics.mockResolvedValue({
      totalOrders: 200,
      cancelledOrders: 10,
      returnedOrders: 5,
      deliveredOrders: 150,
      cancellationRate: 5,
      returnRate: 3.33,
      inventoryMovements: { received: 500, sold: 180, damaged: 2, restocked: 5 },
    });

    const result = await service.getOperations();
    expect(result.cancellationRate).toBe(5);
    expect(result.returnRate).toBe(3.33);
    expect(result.inventoryMovements.sold).toBe(180);
  });
});

describe('Analytics Overview Dashboard', () => {
  it('returns unified composite overview KPIs', async () => {
    repo.getSalesMetrics.mockResolvedValue({
      totalRevenue: 50000,
      orderCount: 20,
      averageOrderValue: 2500,
      unitsSold: 40,
      funnel: { visits: 500, purchases: 20 },
    });
    repo.getCustomerMetrics.mockResolvedValue({
      newCustomers: 10,
      totalCustomers: 50,
      repeatCustomers: 15,
    });
    repo.getMarketingMetrics.mockResolvedValue({
      referrals: { signups: 5, rewardsIssued: 2 },
    });
    repo.getOperationsMetrics.mockResolvedValue({
      totalOrders: 20,
      deliveredOrders: 18,
      cancellationRate: 0,
      returnRate: 0,
    });

    const overview = await service.getOverview();
    expect(overview.kpi.totalRevenue).toBe(50000);
    expect(overview.kpi.newCustomers).toBe(10);
    expect(overview.kpi.repeatRate).toBe(30);
    expect(overview.referrals.signups).toBe(5);
    expect(overview.operationsSummary.deliveredOrders).toBe(18);
  });
});
