'use strict';

const bcrypt = require('bcrypt');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const logger = require('../../config/logger');
const repo = require('./auth.repository');
const tokens = require('./token.service');
const mfa = require('./mfa/mfa.provider');

const INVALID_CREDENTIALS = 'Invalid email or password';

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
  };
}

async function loadRolesAndPermissions(userId) {
  const user = await repo.findUserWithRoles(userId);
  const roles = (user && user.roles) || [];
  return {
    roles: roles.map((r) => r.name),
    permissions: [...new Set(roles.flatMap((r) => (r.permissions || []).map((p) => p.name)))],
  };
}

async function issueSession(user, context = {}, transaction) {
  const { roles, permissions } = await loadRolesAndPermissions(user.id);
  const accessToken = tokens.signAccessToken({ id: user.id, email: user.email, roles, permissions });
  const { raw, hash } = tokens.generateRefreshToken();

  const record = await repo.createRefreshToken(
    {
      userId: user.id,
      tokenHash: hash,
      userAgent: context.userAgent,
      ipAddress: context.ip,
      deviceLabel: context.deviceLabel,
      expiresAt: tokens.refreshExpiryDate(),
    },
    transaction
  );

  return {
    user: publicUser(user),
    roles,
    tokens: { accessToken, refreshToken: raw, tokenType: 'Bearer', expiresIn: config.auth.accessExpiresIn },
    refreshTokenId: record.id,
  };
}

async function register(payload, context = {}) {
  const existing = await repo.findUserByEmail(payload.email);
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(payload.password, config.auth.bcryptRounds);

  const user = await repo.transaction(async (t) => {
    const created = await repo.createUser(
      {
        email: payload.email,
        phone: payload.phone,
        passwordHash,
        firstName: payload.firstName,
        lastName: payload.lastName,
        status: 'ACTIVE',
      },
      t
    );

    const customerRole = await repo.findRoleByName('customer', t);
    if (customerRole) await repo.assignRole(created, customerRole, t);
    return created;
  });

  return issueSession(user, context);
}

function lockState(user) {
  return Boolean(user.lockedUntil && user.lockedUntil.getTime() > Date.now());
}

async function registerFailedAttempt(user) {
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const fields = { failedLoginAttempts: attempts };

  if (attempts >= config.auth.maxFailedAttempts) {
    fields.lockedUntil = new Date(Date.now() + config.auth.lockMinutes * 60 * 1000);
    fields.failedLoginAttempts = 0;
    logger.warn({ userId: user.id }, 'Account locked after repeated failed logins');
  }
  await repo.updateUser(user, fields);
}

async function login({ email, password }, context = {}) {
  const user = await repo.findUserByEmail(email, { withSecrets: true });
  // Same error and shape whether the account exists or not.
  if (!user) throw ApiError.unauthorized(INVALID_CREDENTIALS);

  if (lockState(user)) {
    throw new ApiError(423, 'Account temporarily locked after too many failed attempts', { code: 'ACCOUNT_LOCKED' });
  }
  if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
    throw ApiError.forbidden('This account is not active');
  }

  const matches = await bcrypt.compare(password, user.passwordHash || '');
  if (!matches) {
    await registerFailedAttempt(user);
    throw ApiError.unauthorized(INVALID_CREDENTIALS);
  }

  await repo.updateUser(user, { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() });

  const challenge = await mfa.get().startChallenge(user);
  if (challenge.required) {
    return { mfaRequired: true, challengeId: challenge.challengeId, method: challenge.method };
  }

  return issueSession(user, context);
}

async function refresh({ refreshToken }, context = {}) {
  const hash = tokens.hashToken(refreshToken);
  const record = await repo.findRefreshTokenByHash(hash);
  if (!record) throw ApiError.unauthorized('Invalid refresh token');

  // A revoked token being presented again means the token was replayed or stolen:
  // kill the whole family for that user rather than just this one.
  if (record.revokedAt) {
    await repo.revokeAllRefreshTokensForUser(record.userId, { reason: 'REUSE_DETECTED' });
    logger.warn({ userId: record.userId }, 'Refresh token reuse detected; all sessions revoked');
    throw ApiError.unauthorized('Refresh token has been revoked');
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  const user = await repo.findUserById(record.userId);
  if (!user || user.status !== 'ACTIVE') throw ApiError.unauthorized('Account is not active');

  return repo.transaction(async (t) => {
    const session = await issueSession(user, context, t);
    await repo.revokeRefreshToken(record, {
      reason: 'ROTATED',
      replacedByTokenId: session.refreshTokenId,
      transaction: t,
    });
    return session;
  });
}

async function logout({ refreshToken }) {
  const record = await repo.findRefreshTokenByHash(tokens.hashToken(refreshToken));
  // Idempotent: logging out twice is not an error.
  if (record && !record.revokedAt) await repo.revokeRefreshToken(record, { reason: 'LOGOUT' });
  return { loggedOut: true };
}

async function requestPasswordReset({ email }, context = {}) {
  const user = await repo.findUserByEmail(email);
  // Always the same answer, so the endpoint cannot be used to enumerate accounts.
  if (!user) return { requested: true };

  const { raw, hash } = tokens.generateRefreshToken();
  await repo.transaction(async (t) => {
    await repo.invalidateOtherPasswordResets(user.id, t);
    await repo.createPasswordResetToken(
      {
        userId: user.id,
        tokenHash: hash,
        requestIp: context.ip,
        expiresAt: new Date(Date.now() + config.auth.passwordResetExpiresMinutes * 60 * 1000),
      },
      t
    );
  });

  // Delivery moves to the notifications module in a later phase; never returned in production.
  logger.info({ userId: user.id }, 'Password reset token issued');
  return { requested: true, ...(config.isProduction ? {} : { resetToken: raw }) };
}

async function confirmPasswordReset({ token, password }) {
  const record = await repo.findPasswordResetByHash(tokens.hashToken(token));
  if (!record) throw ApiError.badRequest('Invalid or expired reset token');
  if (record.usedAt) throw ApiError.badRequest('This reset token has already been used');
  if (record.expiresAt.getTime() <= Date.now()) throw ApiError.badRequest('Invalid or expired reset token');

  const user = await repo.findUserById(record.userId, { withSecrets: true });
  if (!user) throw ApiError.badRequest('Invalid or expired reset token');

  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

  await repo.transaction(async (t) => {
    await repo.updateUser(user, { passwordHash, failedLoginAttempts: 0, lockedUntil: null }, t);
    await repo.markPasswordResetUsed(record, t);
    // A password change invalidates every existing session.
    await repo.revokeAllRefreshTokensForUser(user.id, { reason: 'PASSWORD_RESET', transaction: t });
  });

  return { reset: true };
}

async function me(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw ApiError.notFound('User not found');
  const { roles, permissions } = await loadRolesAndPermissions(userId);
  return { ...publicUser(user), roles, permissions };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  me,
  publicUser,
};
