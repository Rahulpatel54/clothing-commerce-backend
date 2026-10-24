'use strict';

jest.mock('../src/modules/auth/auth.repository');

const request = require('supertest');
const app = require('../src/app');
const repo = require('../src/modules/auth/auth.repository');
const tokens = require('../src/modules/auth/token.service');

describe('Auth routes', () => {
  it('rejects a weak password and a bad email in one response', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });

  it('strips unknown fields so privileges cannot be self-assigned', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    repo.transaction.mockImplementation(async (fn) => fn('tx'));
    repo.createUser.mockImplementation(async (payload) => ({ id: 'u1', status: 'ACTIVE', ...payload }));
    repo.findRoleByName.mockResolvedValue({ id: 'r1', name: 'customer' });
    repo.assignRole.mockResolvedValue(undefined);
    repo.findUserWithRoles.mockResolvedValue({ roles: [{ name: 'customer', permissions: [] }] });
    repo.createRefreshToken.mockResolvedValue({ id: 'rt1' });

    const res = await request(app).post('/api/v1/auth/register').send({ email: 'new@example.com', password: 'Str0ngPass', status: 'ACTIVE', role: 'admin', isAdmin: true });

    expect(res.status).toBe(201);
    const created = repo.createUser.mock.calls[0][0];
    expect(created.role).toBeUndefined();
    expect(created.isAdmin).toBeUndefined();
  });

  it('requires a bearer token on /auth/me', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a forged access token', async () => {
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'user-1', type: 'access' })).toString('base64url'),
      '',
    ].join('.');
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('rejects a valid token whose account has been suspended', async () => {
    const token = tokens.signAccessToken({ id: 'user-1', email: 'a@b.com', roles: ['customer'], permissions: [] });
    repo.findUserById.mockResolvedValue({ id: 'user-1', email: 'a@b.com', status: 'SUSPENDED' });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('accepts a valid token and returns the current user', async () => {
    const token = tokens.signAccessToken({ id: 'user-1', email: 'a@b.com', roles: ['customer'], permissions: [] });
    repo.findUserById.mockResolvedValue({ id: 'user-1', email: 'a@b.com', status: 'ACTIVE', mfaEnabled: false });
    repo.findUserWithRoles.mockResolvedValue({ roles: [{ name: 'customer', permissions: [{ name: 'orders:read' }] }] });
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 'user-1', roles: ['customer'], permissions: ['orders:read'] });
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('resiliently handles accidental quotes and duplicate Bearer prefix from Swagger UI', async () => {
    const token = tokens.signAccessToken({ id: 'user-1', email: 'a@b.com', roles: ['customer'], permissions: [] });
    repo.findUserById.mockResolvedValue({ id: 'user-1', email: 'a@b.com', status: 'ACTIVE', mfaEnabled: false });
    repo.findUserWithRoles.mockResolvedValue({ roles: [{ name: 'customer', permissions: [] }] });

    // With duplicate Bearer prefix (when user enters "Bearer <token>" in Swagger Authorize dialog)
    const res1 = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer Bearer ${token}`);
    expect(res1.status).toBe(200);

    // With surrounding quotes (when user copies "token" from Swagger response JSON)
    const res2 = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer "${token}"`);
    expect(res2.status).toBe(200);

    // With both duplicate Bearer and quotes
    const res3 = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer Bearer "${token}"`);
    expect(res3.status).toBe(200);

    // When user accidentally copies trailing quote, comma, and refreshToken field from Swagger JSON
    const res4 = await request(app).get('/api/v1/auth/me').set(
      'Authorization',
      `Bearer ${token}",       "refreshToken": "98ae7f5a45e84d1f2ef4886cce9d3cf5fd2f4750c308d2b1ee2af68b678a835d7c9072721bc82596c5ecef07ca333dae`
    );
    expect(res4.status).toBe(200);
  });
});
