'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rateLimiter');
const schema = require('./auth.validation');
const controller = require('./auth.controller');

const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a customer account
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
 *     responses:
 *       201:
 *         description: Account created, session issued
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessResponse' }
 *       409: { $ref: '#/components/responses/BadRequest' }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
router.post('/register', authLimiter, validate(schema.register), controller.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate and receive an access/refresh token pair
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Session issued (or an MFA challenge when enabled) }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       423: { description: Account locked after repeated failed attempts }
 */
router.post('/login', authLimiter, validate(schema.login), controller.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate a refresh token
 *     description: The presented token is revoked and replaced. Replaying a revoked token revokes every session for that user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New token pair issued }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/refresh', validate(schema.refresh), controller.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke a refresh token (idempotent)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Session revoked }
 */
router.post('/logout', validate(schema.logout), controller.logout);

/**
 * @openapi
 * /auth/password/reset-request:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset token
 *     description: Always returns 200 so the endpoint cannot be used to enumerate accounts.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Request accepted }
 */
router.post('/password/reset-request', authLimiter, validate(schema.requestPasswordReset), controller.requestPasswordReset);

/**
 * @openapi
 * /auth/password/reset:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm a password reset
 *     description: Single-use token. Resetting revokes every active session for the account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password updated }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post('/password/reset', authLimiter, validate(schema.confirmPasswordReset), controller.confirmPasswordReset);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current user with roles and permissions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', authenticate, controller.me);

module.exports = router;
