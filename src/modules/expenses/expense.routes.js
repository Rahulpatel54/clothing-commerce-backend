'use strict';

const express = require('express');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const schema = require('./expense.validation');
const controller = require('./expense.controller');

const router = express.Router();

// Categories
router.post('/categories', authenticate, authorize('expenses:create'), validate(schema.createCategory), controller.createCategory);
router.get('/categories', authenticate, authorize('expenses:read'), validate(schema.listCategories), controller.listCategories);
router.patch('/categories/:id', authenticate, authorize('expenses:update'), validate(schema.updateCategory), controller.updateCategory);

// Expenses CRUD
router.post('/', authenticate, authorize('expenses:create'), validate(schema.createExpense), controller.createExpense);
router.get('/', authenticate, authorize('expenses:read'), validate(schema.listExpenses), controller.listExpenses);
router.get('/:id', authenticate, authorize('expenses:read'), validate(schema.getExpense), controller.getExpense);
router.patch('/:id', authenticate, authorize('expenses:update'), validate(schema.updateExpense), controller.updateExpense);
router.delete('/:id', authenticate, authorize('expenses:delete'), validate(schema.deleteExpense), controller.deleteExpense);

module.exports = router;
