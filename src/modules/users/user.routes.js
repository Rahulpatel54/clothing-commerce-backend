'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize, authorizeSelfOr } = require('../../middleware/authorize');
const schema = require('./user.validation');
const controller = require('./user.controller');

const router = express.Router();

router.use(authenticate);

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
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION] } }
 *       - { in: query, name: role, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated users }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *   post:
 *     tags: [Users]
 *     summary: Create a user with roles (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email already in use }
 */
router.get('/', authorize('users:read'), validate(schema.list), controller.list);
router.post('/', authorize('users:create'), validate(schema.create), controller.create);

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
 *   patch:
 *     tags: [Users]
 *     summary: Update profile fields (self or admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: User updated }
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a user (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: User deleted }
 */
router.get('/:id', authorizeSelfOr('users:read'), validate(schema.byId), controller.get);
router.patch('/:id', authorizeSelfOr('users:update'), validate(schema.update), controller.update);
router.delete('/:id', authorize('users:delete'), validate(schema.byId), controller.remove);

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Change account status (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Cannot change your own status }
 */
router.patch('/:id/status', authorize('users:update'), validate(schema.changeStatus), controller.changeStatus);

/**
 * @openapi
 * /users/{id}/roles:
 *   put:
 *     tags: [Users]
 *     summary: Replace the role set for a user (admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses:
 *       200: { description: Roles updated }
 */
router.put('/:id/roles', authorize('users:update'), validate(schema.assignRoles), controller.assignRoles);

module.exports = router;