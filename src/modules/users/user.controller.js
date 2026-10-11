'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./user.service');

const list = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users:
   *   get:
   *     tags: [Users]
   *     summary: List users (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *       - { in: query, name: search, schema: { type: string }, description: Matches email, first name or last name }
   *       - { in: query, name: status, schema: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION] } }
   *       - { in: query, name: role, schema: { type: string } }
   *       - { in: query, name: sort, schema: { type: string, enum: [createdAt, email, lastLoginAt] } }
   *       - { in: query, name: order, schema: { type: string, enum: [ASC, DESC] } }
   *     responses:
   *       200: { description: Paginated users }
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  const { page, limit, offset } = getPagination(req.query);
  const result = await service.list({ filters: req.query, page, limit, offset, sort: req.query.sort, order: req.query.order });
  return paginated(res, result);
});

const get = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users/{id}:
   *   get:
   *     tags: [Users]
   *     summary: Get a user (self or admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: User }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  return success(res, { data: await service.get(req.params.id) });
});

const create = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users:
   *   post:
   *     tags: [Users]
   *     summary: Create a user with roles (admin)
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string, format: email }
   *               password: { type: string, minLength: 8 }
   *               firstName: { type: string }
   *               lastName: { type: string }
   *               phone: { type: string }
   *               status: { type: string, enum: [ACTIVE, INACTIVE, PENDING_VERIFICATION] }
   *               roles: { type: array, items: { type: string }, description: "Defaults to ['customer'] when omitted" }
   *     responses:
   *       201: { description: User created }
   *       409: { description: Email already in use }
   */
  return success(res, { data: await service.create(req, req.body), message: 'User created', statusCode: 201 });
});

const update = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users/{id}:
   *   patch:
   *     tags: [Users]
   *     summary: Update profile fields (self or admin)
   *     description: Only firstName/lastName/phone are writable here — status and roles have their own dedicated endpoints so they can't be smuggled in through a profile edit.
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties: { firstName: { type: string }, lastName: { type: string }, phone: { type: string, nullable: true } }
   *     responses:
   *       200: { description: User updated }
   */
  return success(res, { data: await service.update(req, req.params.id, req.body), message: 'User updated' });
});

const changeStatus = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users/{id}/status:
   *   patch:
   *     tags: [Users]
   *     summary: Change account status (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION] }
   *               reason: { type: string }
   *     responses:
   *       200: { description: Status updated }
   *       400: { description: Cannot change your own status }
   */
  return success(res, { data: await service.changeStatus(req, req.params.id, req.body), message: 'Status updated' });
});

const assignRoles = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users/{id}/roles:
   *   put:
   *     tags: [Users]
   *     summary: Replace the full role set for a user (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object, required: [roles], properties: { roles: { type: array, items: { type: string }, minItems: 1 } } }
   *     responses:
   *       200: { description: Roles updated }
   *       400: { description: One or more roles do not exist, or you tried to change your own roles }
   */
  return success(res, { data: await service.assignRoles(req, req.params.id, req.body), message: 'Roles updated' });
});

const remove = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /users/{id}:
   *   delete:
   *     tags: [Users]
   *     summary: Soft-delete a user (admin)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: User deleted }
   *       400: { description: Cannot delete your own account }
   */
  return success(res, { data: await service.remove(req, req.params.id), message: 'User deleted' });
});

module.exports = { list, get, create, update, changeStatus, assignRoles, remove };
