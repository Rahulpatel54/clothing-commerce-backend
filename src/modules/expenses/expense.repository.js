'use strict';

const { Op } = require('sequelize');
const db = require('../../models');

const categoryInclude = { model: db.ExpenseCategory, as: 'category', attributes: ['id', 'name', 'slug'] };
const creatorInclude = { model: db.User, as: 'creator', attributes: ['id', 'email', 'firstName', 'lastName'] };
const approverInclude = { model: db.User, as: 'approver', attributes: ['id', 'email', 'firstName', 'lastName'] };

// Categories
const createCategory = (payload, transaction) => db.ExpenseCategory.create(payload, { transaction });

const findCategoryById = (id, transaction) => db.ExpenseCategory.findByPk(id, { transaction });

const findCategoryBySlug = (slug, transaction) => db.ExpenseCategory.findOne({ where: { slug }, transaction });

const listCategories = async ({ includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) where.isActive = true;
  return db.ExpenseCategory.findAll({ where, order: [['name', 'ASC']] });
};

const updateCategory = (category, fields, transaction) => category.update(fields, { transaction });

// Expenses
const createExpense = (payload, transaction) => db.Expense.create(payload, { transaction });

const findExpenseById = (id, transaction) =>
  db.Expense.findByPk(id, {
    include: [categoryInclude, creatorInclude, approverInclude],
    transaction,
  });

const listExpenses = async ({ filters = {}, page = 1, limit = 20 }) => {
  const where = {};
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.status) where.status = filters.status;
  if (filters.vendor) where.vendor = { [Op.iLike]: `%${filters.vendor}%` };
  if (filters.isRecurring != null) where.isRecurring = filters.isRecurring;

  if (filters.startDate && filters.endDate) {
    where.date = { [Op.between]: [filters.startDate, filters.endDate] };
  } else if (filters.startDate) {
    where.date = { [Op.gte]: filters.startDate };
  } else if (filters.endDate) {
    where.date = { [Op.lte]: filters.endDate };
  }

  const offset = (page - 1) * limit;

  const { rows, count } = await db.Expense.findAndCountAll({
    where,
    include: [categoryInclude, creatorInclude, approverInclude],
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { rows, count, page, limit };
};

const updateExpense = (expense, fields, transaction) => expense.update(fields, { transaction });

const deleteExpense = (id, transaction) => db.Expense.destroy({ where: { id }, transaction });

// Checks whether a given calendar date falls inside a closed financial period
const isDateInClosedPeriod = async (date, transaction) => {
  if (!db.FinancialPeriod) return false;
  const period = await db.FinancialPeriod.findOne({
    where: {
      isClosed: true,
      startDate: { [Op.lte]: date },
      endDate: { [Op.gte]: date },
    },
    transaction,
  });
  return Boolean(period);
};

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  createCategory,
  findCategoryById,
  findCategoryBySlug,
  listCategories,
  updateCategory,
  createExpense,
  findExpenseById,
  listExpenses,
  updateExpense,
  deleteExpense,
  isDateInClosedPeriod,
  transaction,
};
