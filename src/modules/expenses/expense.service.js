'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./expense.repository');

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');

// Category Services
const createCategory = async (req, payload) => {
  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);
  const existing = await repo.findCategoryBySlug(slug);
  if (existing) {
    throw ApiError.conflict('Expense category with this slug already exists');
  }

  const category = await repo.createCategory({
    name: payload.name.trim(),
    slug,
    description: payload.description,
    isActive: payload.isActive != null ? payload.isActive : true,
  });

  await audit.record(req, {
    action: 'expense_category.create',
    entityType: 'ExpenseCategory',
    entityId: category.id,
    after: category.toJSON ? category.toJSON() : category,
  });

  return category;
};

const listCategories = async (options = {}) => {
  return repo.listCategories(options);
};

const updateCategory = async (req, id, payload) => {
  const category = await repo.findCategoryById(id);
  if (!category) throw ApiError.notFound('Expense category not found');

  const fields = {};
  if (payload.name) fields.name = payload.name.trim();
  if (payload.description !== undefined) fields.description = payload.description;
  if (payload.isActive !== undefined) fields.isActive = payload.isActive;

  if (payload.slug) {
    const slug = slugify(payload.slug);
    if (slug !== category.slug) {
      const existing = await repo.findCategoryBySlug(slug);
      if (existing) throw ApiError.conflict('Expense category with this slug already exists');
      fields.slug = slug;
    }
  }

  const before = category.toJSON ? category.toJSON() : category;
  await repo.updateCategory(category, fields);

  await audit.record(req, {
    action: 'expense_category.update',
    entityType: 'ExpenseCategory',
    entityId: id,
    before,
    after: fields,
  });

  return repo.findCategoryById(id);
};

// Expense Services
const createExpense = async (req, payload) => {
  const category = await repo.findCategoryById(payload.categoryId);
  if (!category) throw ApiError.notFound('Expense category not found');
  if (!category.isActive) throw ApiError.badRequest('Cannot add expenses to an inactive category');

  const isClosed = await repo.isDateInClosedPeriod(payload.date);
  if (isClosed) {
    throw ApiError.conflict('Cannot post expenses to a closed financial period');
  }

  const amount = Number(payload.amount);
  if (isNaN(amount) || amount <= 0) {
    throw ApiError.badRequest('Expense amount must be a positive number');
  }

  const expenseData = {
    categoryId: payload.categoryId,
    amount,
    date: payload.date,
    vendor: payload.vendor,
    paymentMethod: payload.paymentMethod,
    description: payload.description,
    receiptUrl: payload.receiptUrl,
    isRecurring: Boolean(payload.isRecurring),
    recurringRule: payload.recurringRule || null,
    status: payload.status || 'PENDING',
    createdBy: req.user ? req.user.id : null,
    approvedBy: payload.status === 'APPROVED' && req.user ? req.user.id : null,
  };

  const expense = await repo.createExpense(expenseData);

  await audit.record(req, {
    action: 'expense.create',
    entityType: 'Expense',
    entityId: expense.id,
    after: expense.toJSON ? expense.toJSON() : expense,
  });

  return repo.findExpenseById(expense.id);
};

const getExpense = async (id) => {
  const expense = await repo.findExpenseById(id);
  if (!expense) throw ApiError.notFound('Expense not found');
  return expense;
};

const listExpenses = async (query) => {
  return repo.listExpenses({
    filters: query,
    page: query.page,
    limit: query.limit,
  });
};

const updateExpense = async (req, id, payload) => {
  const expense = await repo.findExpenseById(id);
  if (!expense) throw ApiError.notFound('Expense not found');

  // Guard against mutating an expense in a closed period
  const currentlyClosed = await repo.isDateInClosedPeriod(expense.date);
  if (currentlyClosed) {
    throw ApiError.conflict('Cannot modify an expense in a closed financial period');
  }

  // Guard against moving an expense into a closed period
  if (payload.date && payload.date !== expense.date) {
    const targetClosed = await repo.isDateInClosedPeriod(payload.date);
    if (targetClosed) {
      throw ApiError.conflict('Cannot move an expense into a closed financial period');
    }
  }

  if (payload.categoryId) {
    const category = await repo.findCategoryById(payload.categoryId);
    if (!category) throw ApiError.notFound('Expense category not found');
  }

  const fields = {};
  if (payload.categoryId) fields.categoryId = payload.categoryId;
  if (payload.amount != null) {
    const amount = Number(payload.amount);
    if (isNaN(amount) || amount <= 0) throw ApiError.badRequest('Expense amount must be a positive number');
    fields.amount = amount;
  }
  if (payload.date) fields.date = payload.date;
  if (payload.vendor !== undefined) fields.vendor = payload.vendor;
  if (payload.paymentMethod !== undefined) fields.paymentMethod = payload.paymentMethod;
  if (payload.description !== undefined) fields.description = payload.description;
  if (payload.receiptUrl !== undefined) fields.receiptUrl = payload.receiptUrl;
  if (payload.isRecurring !== undefined) fields.isRecurring = payload.isRecurring;
  if (payload.recurringRule !== undefined) fields.recurringRule = payload.recurringRule;

  if (payload.status) {
    fields.status = payload.status;
    if (payload.status === 'APPROVED' && expense.status !== 'APPROVED') {
      fields.approvedBy = req.user ? req.user.id : null;
    }
  }

  const before = expense.toJSON ? expense.toJSON() : expense;
  await repo.updateExpense(expense, fields);

  await audit.record(req, {
    action: 'expense.update',
    entityType: 'Expense',
    entityId: id,
    before,
    after: fields,
  });

  return repo.findExpenseById(id);
};

const deleteExpense = async (req, id) => {
  const expense = await repo.findExpenseById(id);
  if (!expense) throw ApiError.notFound('Expense not found');

  const isClosed = await repo.isDateInClosedPeriod(expense.date);
  if (isClosed) {
    throw ApiError.conflict('Cannot delete an expense in a closed financial period');
  }

  await repo.deleteExpense(id);

  await audit.record(req, {
    action: 'expense.delete',
    entityType: 'Expense',
    entityId: id,
    before: expense.toJSON ? expense.toJSON() : expense,
  });

  return { deleted: true };
};

module.exports = {
  createCategory,
  listCategories,
  updateCategory,
  createExpense,
  getExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
};
