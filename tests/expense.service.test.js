'use strict';

jest.mock('../src/modules/expenses/expense.repository');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/expenses/expense.repository');
const audit = require('../src/modules/audit/audit.service');
const service = require('../src/modules/expenses/expense.service');

const REQ = { user: { id: 'user-admin-1', roles: ['admin'], permissions: ['*'] } };

function sampleCategory(overrides = {}) {
  return {
    id: 'cat-1',
    name: 'Manufacturing',
    slug: 'manufacturing',
    description: 'Production runs',
    isActive: true,
    toJSON: () => ({ id: 'cat-1', name: 'Manufacturing', slug: 'manufacturing', isActive: true }),
    ...overrides,
  };
}

function sampleExpense(overrides = {}) {
  return {
    id: 'exp-1',
    categoryId: 'cat-1',
    amount: '15000.00',
    date: '2026-10-15',
    vendor: 'Fabric Supplier Co',
    paymentMethod: 'BANK_TRANSFER',
    description: 'Cotton fabric roll',
    status: 'PENDING',
    createdBy: 'user-admin-1',
    approvedBy: null,
    toJSON: () => ({ id: 'exp-1', categoryId: 'cat-1', amount: '15000.00', date: '2026-10-15', status: 'PENDING' }),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.isDateInClosedPeriod.mockResolvedValue(false);
  audit.record.mockResolvedValue({});
});

describe('Expense Categories', () => {
  it('creates an expense category and normalizes the slug', async () => {
    repo.findCategoryBySlug.mockResolvedValue(null);
    repo.createCategory.mockImplementation(async (p) => sampleCategory(p));

    const result = await service.createCategory(REQ, { name: 'Fabric & Raw Materials' });
    expect(result.slug).toBe('fabric-raw-materials');
    expect(repo.createCategory).toHaveBeenCalledWith(expect.objectContaining({ slug: 'fabric-raw-materials' }));
    expect(audit.record).toHaveBeenCalledWith(REQ, expect.objectContaining({ action: 'expense_category.create' }));
  });

  it('rejects duplicate category slugs with 409 Conflict', async () => {
    repo.findCategoryBySlug.mockResolvedValue(sampleCategory());
    await expect(service.createCategory(REQ, { name: 'Manufacturing', slug: 'manufacturing' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('updates category details and verifies slug uniqueness', async () => {
    const cat = sampleCategory();
    repo.findCategoryById.mockResolvedValue(cat);
    repo.findCategoryBySlug.mockResolvedValue(null);
    repo.updateCategory.mockResolvedValue(undefined);

    await service.updateCategory(REQ, 'cat-1', { name: 'New Fabric Name', slug: 'new-fabric' });
    expect(repo.updateCategory).toHaveBeenCalledWith(cat, expect.objectContaining({ slug: 'new-fabric' }));
  });

  it('throws 404 if category to update is not found', async () => {
    repo.findCategoryById.mockResolvedValue(null);
    await expect(service.updateCategory(REQ, 'non-existent', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('Expenses CRUD & Period Locking', () => {
  it('records an expense against an active category', async () => {
    repo.findCategoryById.mockResolvedValue(sampleCategory({ isActive: true }));
    repo.isDateInClosedPeriod.mockResolvedValue(false);
    repo.createExpense.mockImplementation(async (p) => ({ ...p, id: 'exp-1' }));
    repo.findExpenseById.mockResolvedValue(sampleExpense());

    const result = await service.createExpense(REQ, {
      categoryId: 'cat-1',
      amount: 15000,
      date: '2026-10-15',
      vendor: 'Fabric Supplier Co',
      status: 'PENDING',
    });

    expect(result.id).toBe('exp-1');
    expect(repo.createExpense).toHaveBeenCalledWith(expect.objectContaining({ amount: 15000, createdBy: 'user-admin-1' }));
    expect(audit.record).toHaveBeenCalledWith(REQ, expect.objectContaining({ action: 'expense.create' }));
  });

  it('refuses to record an expense against an inactive category (400)', async () => {
    repo.findCategoryById.mockResolvedValue(sampleCategory({ isActive: false }));
    await expect(
      service.createExpense(REQ, { categoryId: 'cat-1', amount: 1000, date: '2026-10-15' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses to record an expense dated in a closed financial period (409 Conflict)', async () => {
    repo.findCategoryById.mockResolvedValue(sampleCategory({ isActive: true }));
    repo.isDateInClosedPeriod.mockResolvedValue(true);

    await expect(
      service.createExpense(REQ, { categoryId: 'cat-1', amount: 1000, date: '2026-09-01' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses to record an expense with a non-positive amount (400)', async () => {
    repo.findCategoryById.mockResolvedValue(sampleCategory({ isActive: true }));
    await expect(
      service.createExpense(REQ, { categoryId: 'cat-1', amount: -500, date: '2026-10-15' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses to modify an expense whose date falls in a closed financial period (409 Conflict)', async () => {
    repo.findExpenseById.mockResolvedValue(sampleExpense({ date: '2026-09-01' }));
    repo.isDateInClosedPeriod.mockResolvedValue(true);

    await expect(service.updateExpense(REQ, 'exp-1', { amount: 20000 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('refuses to move an expense into a closed financial period (409 Conflict)', async () => {
    repo.findExpenseById.mockResolvedValue(sampleExpense({ date: '2026-10-15' }));
    repo.isDateInClosedPeriod.mockImplementation(async (date) => date === '2026-08-31');

    await expect(service.updateExpense(REQ, 'exp-1', { date: '2026-08-31' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('sets approvedBy when expense status transitions to APPROVED', async () => {
    const expense = sampleExpense({ status: 'PENDING' });
    repo.findExpenseById.mockResolvedValue(expense);
    repo.isDateInClosedPeriod.mockResolvedValue(false);
    repo.updateExpense.mockResolvedValue(undefined);

    await service.updateExpense(REQ, 'exp-1', { status: 'APPROVED' });
    expect(repo.updateExpense).toHaveBeenCalledWith(expense, expect.objectContaining({ status: 'APPROVED', approvedBy: 'user-admin-1' }));
  });

  it('refuses to delete an expense in a closed financial period (409 Conflict)', async () => {
    repo.findExpenseById.mockResolvedValue(sampleExpense({ date: '2026-09-01' }));
    repo.isDateInClosedPeriod.mockResolvedValue(true);

    await expect(service.deleteExpense(REQ, 'exp-1')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('deletes an open expense and records an audit log', async () => {
    repo.findExpenseById.mockResolvedValue(sampleExpense());
    repo.isDateInClosedPeriod.mockResolvedValue(false);
    repo.deleteExpense.mockResolvedValue(1);

    const result = await service.deleteExpense(REQ, 'exp-1');
    expect(result.deleted).toBe(true);
    expect(repo.deleteExpense).toHaveBeenCalledWith('exp-1');
    expect(audit.record).toHaveBeenCalledWith(REQ, expect.objectContaining({ action: 'expense.delete' }));
  });
});
