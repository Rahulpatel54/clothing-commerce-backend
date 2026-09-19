'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success } = require('../../utils/apiResponse');
const service = require('./auth.service');

const context = (req) => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  deviceLabel: req.headers['x-device-label'],
});

const register = catchAsync(async (req, res) => {
  const result = await service.register(req.body, context(req));
  return success(res, { data: result, message: 'Account created', statusCode: 201 });
});

const login = catchAsync(async (req, res) => {
  const result = await service.login(req.body, context(req));
  return success(res, { data: result, message: result.mfaRequired ? 'MFA required' : 'Logged in' });
});

const refresh = catchAsync(async (req, res) => {
  const result = await service.refresh(req.body, context(req));
  return success(res, { data: result, message: 'Token refreshed' });
});

const logout = catchAsync(async (req, res) => {
  const result = await service.logout(req.body);
  return success(res, { data: result, message: 'Logged out' });
});

const requestPasswordReset = catchAsync(async (req, res) => {
  const result = await service.requestPasswordReset(req.body, context(req));
  return success(res, { data: result, message: 'If the account exists, a reset link has been sent' });
});

const confirmPasswordReset = catchAsync(async (req, res) => {
  const result = await service.confirmPasswordReset(req.body);
  return success(res, { data: result, message: 'Password updated' });
});

const me = catchAsync(async (req, res) => {
  const result = await service.me(req.user.id);
  return success(res, { data: result });
});

module.exports = { register, login, refresh, logout, requestPasswordReset, confirmPasswordReset, me };
