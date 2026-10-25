'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const service = require('./expense.service');

/**
 * @openapi
 * /expenses/categories:
 *   post:
 *     tags:
 *       - Expenses
 *     summary: Create an expense category
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Fabric & Raw Materials
 *               slug:
 *                 type: string
 *                 example: fabric
 *               description:
 *                 type: string
 *                 example: Textiles and trims
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Category created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Slug already in use
 */
const createCategory = catchAsync(async (req, res) => {
  const category = await service.createCategory(req, req.body);
  return success(res, { data: category, message: 'Expense category created', statusCode: 201 });
});

/**
 * @openapi
 * /expenses/categories:
 *   get:
 *     tags:
 *       - Expenses
 *     summary: List expense categories
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of categories
 */
const listCategories = catchAsync(async (req, res) => {
  const categories = await service.listCategories(req.query);
  return success(res, { data: categories });
});

/**
 * @openapi
 * /expenses/categories/{id}:
 *   patch:
 *     tags:
 *       - Expenses
 *     summary: Update an expense category
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Category updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
const updateCategory = catchAsync(async (req, res) => {
  const category = await service.updateCategory(req, req.params.id, req.body);
  return success(res, { data: category, message: 'Expense category updated' });
});

/**
 * @openapi
 * /expenses:
 *   post:
 *     tags:
 *       - Expenses
 *     summary: Record an expense
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryId
 *               - amount
 *               - date
 *             properties:
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 example: 25000.00
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2026-10-24"
 *               vendor:
 *                 type: string
 *                 example: "Arvind Mills"
 *               paymentMethod:
 *                 type: string
 *                 example: "BANK_TRANSFER"
 *               description:
 *                 type: string
 *                 example: "Cotton denim roll purchase"
 *               receiptUrl:
 *                 type: string
 *                 example: "https://storage.example.com/receipts/inv-101.pdf"
 *               isRecurring:
 *                 type: boolean
 *                 default: false
 *               recurringRule:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, PAID, CANCELLED]
 *                 default: PENDING
 *     responses:
 *       201:
 *         description: Expense recorded
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Date falls in a closed financial period
 */
const createExpense = catchAsync(async (req, res) => {
  const expense = await service.createExpense(req, req.body);
  return success(res, { data: expense, message: 'Expense recorded', statusCode: 201 });
});

/**
 * @openapi
 * /expenses:
 *   get:
 *     tags:
 *       - Expenses
 *     summary: List expenses with filters and pagination
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, PAID, CANCELLED]
 *       - in: query
 *         name: vendor
 *         schema:
 *           type: string
 *       - in: query
 *         name: isRecurring
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of expenses
 */
const listExpenses = catchAsync(async (req, res) => {
  const result = await service.listExpenses(req.query);
  return paginated(res, result);
});

/**
 * @openapi
 * /expenses/{id}:
 *   get:
 *     tags:
 *       - Expenses
 *     summary: Get an expense by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Expense details
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
const getExpense = catchAsync(async (req, res) => {
  const expense = await service.getExpense(req.params.id);
  return success(res, { data: expense });
});

/**
 * @openapi
 * /expenses/{id}:
 *   patch:
 *     tags:
 *       - Expenses
 *     summary: Update an expense
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date
 *               vendor:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *               description:
 *                 type: string
 *               receiptUrl:
 *                 type: string
 *               isRecurring:
 *                 type: boolean
 *               recurringRule:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, PAID, CANCELLED]
 *     responses:
 *       200:
 *         description: Expense updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Expense falls in a closed financial period
 */
const updateExpense = catchAsync(async (req, res) => {
  const expense = await service.updateExpense(req, req.params.id, req.body);
  return success(res, { data: expense, message: 'Expense updated' });
});

/**
 * @openapi
 * /expenses/{id}:
 *   delete:
 *     tags:
 *       - Expenses
 *     summary: Delete an expense
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Expense deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot delete an expense in a closed period
 */
const deleteExpense = catchAsync(async (req, res) => {
  const result = await service.deleteExpense(req, req.params.id);
  return success(res, { data: result, message: 'Expense deleted' });
});

module.exports = {
  createCategory,
  listCategories,
  updateCategory,
  createExpense,
  listExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
};
