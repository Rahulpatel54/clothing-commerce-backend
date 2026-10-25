'use strict';

jest.mock('../src/modules/finance/finance.repository');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/finance/finance.repository');
const audit = require('../src/modules/audit/audit.service');
const service = require('../src/modules/finance/finance.service');

const REQ = { user: { id: 'finance-admin-1', roles: ['admin'], permissions: ['*'] } };

beforeEach(() => {
  jest.clearAllMocks();
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  audit.record.mockResolvedValue({});
});

describe('Profit & Loss (P&L) Report', () => {
  it('computes Gross Profit, Net Revenue, COGS, and Net Margin correctly', async () => {
    repo.getRevenueSummary.mockResolvedValue({
      orderCount: 10,
      grossSubtotal: 100000,
      totalDiscounts: 5000,
      totalShipping: 2000,
      totalTax: 18000,
      totalPaid: 115000,
      refundCount: 1,
      totalRefunds: 3000,
    });

    repo.getCOGSSummary.mockResolvedValue({
      itemsSold: 25,
      unitsSold: 50,
      totalCOGS: 35000,
    });

    repo.getExpensesSummary.mockResolvedValue({
      totalOperatingExpenses: 25000,
      categories: [
        { categoryId: 'cat-1', categoryName: 'Manufacturing', categorySlug: 'manufacturing', count: 2, totalAmount: 15000 },
        { categoryId: 'cat-2', categoryName: 'Software', categorySlug: 'software', count: 1, totalAmount: 10000 },
      ],
    });

    const report = await service.getPnLReport({ startDate: '2026-10-01', endDate: '2026-10-31' });

    // Net Sales = 100000 (gross) - 5000 (discounts) - 3000 (refunds) = 92000
    expect(report.revenue.netSales).toBe(92000);
    // Net Revenue = Net Sales + Shipping = 92000 + 2000 = 94000
    expect(report.revenue.netRevenue).toBe(94000);
    // COGS = 35000
    expect(report.costOfGoodsSold.totalCOGS).toBe(35000);
    // Gross Profit = Net Sales - COGS = 92000 - 35000 = 57000
    expect(report.profitability.grossProfit).toBe(57000);
    // Gross Margin % = (57000 / 92000) * 100 = 61.96%
    expect(report.profitability.grossMarginPercentage).toBe(61.96);
    // Operating Expenses = 25000
    expect(report.profitability.operatingExpenses).toBe(25000);
    // Operating Income / Net Profit = 57000 - 25000 = 32000
    expect(report.profitability.netProfit).toBe(32000);
    // Net Margin % = (32000 / 92000) * 100 = 34.78%
    expect(report.profitability.netMarginPercentage).toBe(34.78);
    // Categories breakdown
    expect(report.expensesBreakdown.length).toBe(2);
  });

  it('rejects an inverted date range where startDate is after endDate (400 Bad Request)', async () => {
    await expect(
      service.getPnLReport({ startDate: '2026-10-31', endDate: '2026-10-01' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns trace records for orders', async () => {
    repo.listOrderTrace.mockResolvedValue({
      rows: [{ id: 'ord-1', orderNumber: 'ORD123', totalAmount: '5000.00' }],
      count: 1,
    });

    const result = await service.getTraceRecords('orders', { startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(result.rows.length).toBe(1);
    expect(repo.listOrderTrace).toHaveBeenCalled();
  });

  it('rejects an unsupported trace record type (400)', async () => {
    await expect(service.getTraceRecords('invalid-type', {})).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('Financial Period Closing', () => {
  it('creates an open financial period', async () => {
    repo.findPeriodByName.mockResolvedValue(null);
    repo.createPeriod.mockImplementation(async (p) => ({
      id: 'per-1',
      ...p,
      toJSON: () => ({ id: 'per-1', ...p }),
    }));

    const result = await service.createPeriod(REQ, {
      name: 'FY2026-Q4',
      startDate: '2026-10-01',
      endDate: '2026-12-31',
    });

    expect(result.id).toBe('per-1');
    expect(result.isClosed).toBe(false);
    expect(audit.record).toHaveBeenCalledWith(REQ, expect.objectContaining({ action: 'financial_period.create' }));
  });

  it('refuses to create a period with inverted dates (400)', async () => {
    await expect(
      service.createPeriod(REQ, { name: 'Bad Period', startDate: '2026-12-31', endDate: '2026-10-01' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses to create duplicate period names (409 Conflict)', async () => {
    repo.findPeriodByName.mockResolvedValue({ id: 'existing' });
    await expect(
      service.createPeriod(REQ, { name: 'FY2026-Q4', startDate: '2026-10-01', endDate: '2026-12-31' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('closes an open financial period and marks closedBy and closedAt', async () => {
    const period = {
      id: 'per-1',
      name: 'FY2026-Q3',
      isClosed: false,
      toJSON: () => ({ id: 'per-1', isClosed: false }),
    };
    repo.findPeriodById.mockResolvedValueOnce(period).mockResolvedValueOnce({
      ...period,
      isClosed: true,
      closedBy: 'finance-admin-1',
    });
    repo.updatePeriod.mockResolvedValue(undefined);

    const result = await service.closePeriod(REQ, 'per-1');
    expect(result.isClosed).toBe(true);
    expect(repo.updatePeriod).toHaveBeenCalledWith(
      period,
      expect.objectContaining({ isClosed: true, closedBy: 'finance-admin-1' })
    );
    expect(audit.record).toHaveBeenCalledWith(REQ, expect.objectContaining({ action: 'financial_period.close' }));
  });

  it('refuses to re-close an already closed period (409 Conflict)', async () => {
    repo.findPeriodById.mockResolvedValue({ id: 'per-1', isClosed: true });
    await expect(service.closePeriod(REQ, 'per-1')).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
