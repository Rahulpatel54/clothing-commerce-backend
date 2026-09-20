'use strict';

jest.mock('../src/modules/auth/auth.repository');

const bcrypt = require('bcrypt');
const repo = require('../src/modules/auth/auth.repository');
const service = require('../src/modules/auth/auth.service');
const tokens = require('../src/modules/auth/token.service');

const ROLES = [{ name: 'customer', permissions: [{ name: 'orders:read' }] }];

function fakeUser(overrides = {}) {
  return {
    id: 'user-1', email: 'shopper@example.com', firstName: 'Shop', lastName: 'Per',
    status: 'ACTIVE', mfaEnabled: false, failedLoginAttempts: 0, lockedUntil: null, passwordHash: null, ...overrides,
  };
}

beforeEach(() => {
  repo.findUserWithRoles.mockResolvedValue({ roles: ROLES });
  repo.createRefreshToken.mockImplementation(async (payload) => ({ id: 'rt-new', ...payload }));
  repo.updateUser.mockImplementation(async (user, fields) => Object.assign(user, fields));
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.revokeAllRefreshTokensForUser.mockResolvedValue([1]);
  repo.revokeRefreshToken.mockImplementation(async (token, opts) => Object.assign(token, { revokedAt: new Date(), revokedReason: opts.reason }));
});

describe('register', () => {
  it('creates the account, assigns the customer role and issues a session', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    repo.findRoleByName.mockResolvedValue({ id: 'role-1', name: 'customer' });
    repo.createUser.mockImplementation(async (payload) => fakeUser(payload));
    repo.assignRole.mockResolvedValue(undefined);

    const result = await service.register({ email: 'shopper@example.com', password: 'Str0ngPass' });

    expect(repo.assignRole).toHaveBeenCalled();
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toHaveLength(96);
    expect(result.user.passwordHash).toBeUndefined();

    const stored = repo.createUser.mock.calls[0][0].passwordHash;
    expect(stored).not.toBe('Str0ngPass');
    await expect(bcrypt.compare('Str0ngPass', stored)).resolves.toBe(true);
  });

  it('rejects a duplicate email with 409', async () => {
    repo.findUserByEmail.mockResolvedValue(fakeUser());
    await expect(service.register({ email: 'shopper@example.com', password: 'Str0ngPass' })).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createUser).not.toHaveBeenCalled();
  });
});

describe('login', () => {
  const password = 'Str0ngPass';
  let user;

  beforeEach(async () => {
    user = fakeUser({ passwordHash: await bcrypt.hash(password, 4) });
    repo.findUserByEmail.mockResolvedValue(user);
  });

  it('issues a session and clears the failure counter', async () => {
    user.failedLoginAttempts = 2;
    const result = await service.login({ email: user.email, password });
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.roles).toEqual(['customer']);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });

  it('counts a wrong password and returns a generic 401', async () => {
    await expect(service.login({ email: user.email, password: 'wrong-password' })).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    expect(user.failedLoginAttempts).toBe(1);
  });

  it('locks the account once the attempt limit is reached', async () => {
    user.failedLoginAttempts = 2;
    await expect(service.login({ email: user.email, password: 'wrong-password' })).rejects.toMatchObject({ statusCode: 401 });
    expect(user.lockedUntil).toBeInstanceOf(Date);
    expect(user.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    expect(user.failedLoginAttempts).toBe(0);
  });

  it('refuses a locked account even with the correct password', async () => {
    user.lockedUntil = new Date(Date.now() + 60000);
    await expect(service.login({ email: user.email, password })).rejects.toMatchObject({ statusCode: 423, code: 'ACCOUNT_LOCKED' });
  });

  it('refuses a suspended account', async () => {
    user.status = 'SUSPENDED';
    await expect(service.login({ email: user.email, password })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('gives the same error for an unknown email as for a wrong password', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    await expect(service.login({ email: 'nobody@example.com', password })).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });
});

describe('refresh token rotation', () => {
  const raw = 'a'.repeat(96);

  function storedToken(overrides = {}) {
    return { id: 'rt-old', userId: 'user-1', tokenHash: tokens.hashToken(raw), expiresAt: new Date(Date.now() + 86400000), revokedAt: null, ...overrides };
  }

  it('rotates: old token revoked and linked to its replacement', async () => {
    const record = storedToken();
    repo.findRefreshTokenByHash.mockResolvedValue(record);
    repo.findUserById.mockResolvedValue(fakeUser());
    const result = await service.refresh({ refreshToken: raw });
    expect(result.tokens.refreshToken).not.toBe(raw);
    expect(repo.revokeRefreshToken).toHaveBeenCalledWith(record, expect.objectContaining({ reason: 'ROTATED', replacedByTokenId: 'rt-new' }));
  });

  it('treats a revoked token as reuse and kills every session for that user', async () => {
    repo.findRefreshTokenByHash.mockResolvedValue(storedToken({ revokedAt: new Date() }));
    await expect(service.refresh({ refreshToken: raw })).rejects.toMatchObject({ statusCode: 401 });
    expect(repo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-1', { reason: 'REUSE_DETECTED' });
  });

  it('rejects an expired refresh token without revoking the family', async () => {
    repo.findRefreshTokenByHash.mockResolvedValue(storedToken({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.refresh({ refreshToken: raw })).rejects.toMatchObject({ statusCode: 401, message: 'Refresh token expired' });
    expect(repo.revokeAllRefreshTokensForUser).not.toHaveBeenCalled();
  });

  it('rejects an unknown token', async () => {
    repo.findRefreshTokenByHash.mockResolvedValue(null);
    await expect(service.refresh({ refreshToken: raw })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('refuses to refresh for a deactivated account', async () => {
    repo.findRefreshTokenByHash.mockResolvedValue(storedToken());
    repo.findUserById.mockResolvedValue(fakeUser({ status: 'SUSPENDED' }));
    await expect(service.refresh({ refreshToken: raw })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('logout is idempotent', async () => {
    repo.findRefreshTokenByHash.mockResolvedValue(storedToken({ revokedAt: new Date() }));
    await expect(service.logout({ refreshToken: raw })).resolves.toEqual({ loggedOut: true });
    expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    repo.findRefreshTokenByHash.mockResolvedValue(null);
    await expect(service.logout({ refreshToken: raw })).resolves.toEqual({ loggedOut: true });
  });
});

describe('password reset', () => {
  const raw = 'b'.repeat(96);

  function resetRecord(overrides = {}) {
    return { id: 'prt-1', userId: 'user-1', tokenHash: tokens.hashToken(raw), expiresAt: new Date(Date.now() + 600000), usedAt: null, ...overrides };
  }

  it('does not reveal whether the email exists', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    await expect(service.requestPasswordReset({ email: 'ghost@example.com' })).resolves.toMatchObject({ requested: true });
    expect(repo.createPasswordResetToken).not.toHaveBeenCalled();
  });

  it('stores only the hash of the reset token', async () => {
    repo.findUserByEmail.mockResolvedValue(fakeUser());
    repo.invalidateOtherPasswordResets.mockResolvedValue([1]);
    repo.createPasswordResetToken.mockResolvedValue({ id: 'prt-1' });
    const result = await service.requestPasswordReset({ email: 'shopper@example.com' });
    const saved = repo.createPasswordResetToken.mock.calls[0][0];
    expect(saved.tokenHash).toBe(tokens.hashToken(result.resetToken));
    expect(saved.tokenHash).not.toBe(result.resetToken);
  });

  it('resets the password, consumes the token and revokes all sessions', async () => {
    const record = resetRecord();
    const user = fakeUser({ passwordHash: 'old-hash', failedLoginAttempts: 3 });
    repo.findPasswordResetByHash.mockResolvedValue(record);
    repo.findUserById.mockResolvedValue(user);
    repo.markPasswordResetUsed.mockImplementation(async (t) => Object.assign(t, { usedAt: new Date() }));
    await expect(service.confirmPasswordReset({ token: raw, password: 'N3wStrongPass' })).resolves.toEqual({ reset: true });
    await expect(bcrypt.compare('N3wStrongPass', user.passwordHash)).resolves.toBe(true);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(repo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ reason: 'PASSWORD_RESET' }));
  });

  it('rejects a replayed reset token', async () => {
    repo.findPasswordResetByHash.mockResolvedValue(resetRecord({ usedAt: new Date() }));
    await expect(service.confirmPasswordReset({ token: raw, password: 'N3wStrongPass' })).rejects.toMatchObject({ statusCode: 400, message: 'This reset token has already been used' });
  });

  it('rejects an expired reset token', async () => {
    repo.findPasswordResetByHash.mockResolvedValue(resetRecord({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.confirmPasswordReset({ token: raw, password: 'N3wStrongPass' })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an unknown reset token', async () => {
    repo.findPasswordResetByHash.mockResolvedValue(null);
    await expect(service.confirmPasswordReset({ token: 'nope', password: 'N3wStrongPass' })).rejects.toMatchObject({ statusCode: 400 });
  });
});
