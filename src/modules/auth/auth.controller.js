'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./auth.service');

const context = (req) => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  deviceLabel: req.headers['x-device-label'],
  sessionId: req.headers['x-session-id'],
});

const register = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /auth/register:
   *   post:
   *     tags: [Auth]
   *     summary: Register a customer account
   *     description: Creates the user, assigns the `customer` role, creates a linked customer profile, and issues an access/refresh token pair. Unknown body fields (e.g. `role`, `isAdmin`) are stripped by validation and can never be self-assigned.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string, format: email }
   *               password: { type: string, minLength: 8, description: "Must contain a lowercase, uppercase and digit character" }
   *               firstName: { type: string }
   *               lastName: { type: string }
   *               phone: { type: string }
   *               referralCode: { type: string, description: "Optional code from another customer's referral link" }
   *     responses:
   *       201:
   *         description: Account created, session issued
   *         content:
   *           application/json:
   *             schema: { $ref: '#/components/schemas/SuccessResponse' }
   *       409: { description: An account with this email already exists }
   *       422: { $ref: '#/components/responses/ValidationError' }
   */
  const result = await service.register(req.body, context(req));
  return success(res, { data: result, message: 'Account created', statusCode: 201 });
});

const login = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Authenticate and receive an access/refresh token pair
   *     description: Locks the account after repeated failed attempts, returns a generic 401 whether the email exists or not, and folds a guest cart into the customer's cart when an X-Session-Id header is present.
   *     parameters:
   *       - { in: header, name: X-Session-Id, schema: { type: string }, description: Guest cart session to merge on successful login }
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
  const result = await service.login(req.body, context(req));
  return success(res, { data: result, message: result.mfaRequired ? 'MFA required' : 'Logged in' });
});

const refresh = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /auth/refresh:
   *   post:
   *     tags: [Auth]
   *     summary: Rotate a refresh token
   *     description: The presented token is revoked and replaced. Replaying an already-revoked token is treated as theft and revokes every session for that user.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refreshToken]
   *             properties: { refreshToken: { type: string } }
   *     responses:
   *       200: { description: New token pair issued }
   *       401: { $ref: '#/components/responses/Unauthorized' }
   */
  const result = await service.refresh(req.body, context(req));
  return success(res, { data: result, message: 'Token refreshed' });
});

const logout = catchAsync(async (req, res) => {
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
   *             properties: { refreshToken: { type: string } }
   *     responses:
   *       200: { description: Session revoked (or already was) }
   */
  const result = await service.logout(req.body);
  return success(res, { data: result, message: 'Logged out' });
});

const requestPasswordReset = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /auth/password/reset-request:
   *   post:
   *     tags: [Auth]
   *     summary: Request a password reset token
   *     description: Always returns 200 so the endpoint cannot be used to enumerate accounts. Outside production, the raw reset token is included in the response body until the notifications module can deliver it by email.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties: { email: { type: string, format: email } }
   *     responses:
   *       200: { description: Request accepted }
   */
  const result = await service.requestPasswordReset(req.body, context(req));
  return success(res, { data: result, message: 'If the account exists, a reset link has been sent' });
});

const confirmPasswordReset = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /auth/password/reset:
   *   post:
   *     tags: [Auth]
   *     summary: Confirm a password reset
   *     description: Single-use token. A successful reset revokes every active refresh token for the account.
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
  const result = await service.confirmPasswordReset(req.body);
  return success(res, { data: result, message: 'Password updated' });
});

const me = catchAsync(async (req, res) => {
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
  const result = await service.me(req.user.id);
  return success(res, { data: result });
});

module.exports = { register, login, refresh, logout, requestPasswordReset, confirmPasswordReset, me };
