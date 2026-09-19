'use strict';

jest.mock('../src/modules/users/rbac.service');

const rbac = require('../src/modules/users/rbac.service');
const { authorize, authorizeSelfOr } = require('../src/middleware/authorize');

function run(middleware, req) {
  return new Promise((resolve) => middleware(req, {}, (err) => resolve(err)));
}

const reqFor = (user) => ({ user, params: {} });

describe('authorize', () => {
  it('allows a user holding the exact permission', async () => {
    rbac.permissionsFor.mockResolvedValue(new Set(['products:create']));

    await expect(run(authorize('products:create'), reqFor({ id: 'u1' }))).resolves.toBeUndefined();
  });

  it('denies with 403 when the permission is missing', async () => {
    rbac.permissionsFor.mockResolvedValue(new Set(['products:read']));

    const err = await run(authorize('products:create'), reqFor({ id: 'u1' }));
    expect(err).toMatchObject({ statusCode: 403 });
  });

  it('passes admins through any check', async () => {
    rbac.permissionsFor.mockResolvedValue(new Set(['*']));

    await expect(run(authorize('finance:delete'), reqFor({ id: 'admin' }))).resolves.toBeUndefined();
  });

  it('accepts any one of several permissions', async () => {
    rbac.permissionsFor.mockResolvedValue(new Set(['orders:update']));

    await expect(run(authorize('orders:create', 'orders:update'), reqFor({ id: 'u1' }))).resolves.toBeUndefined();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const err = await run(authorize('products:read'), { params: {} });
    expect(err).toMatchObject({ statusCode: 401 });
  });
});

describe('authorizeSelfOr', () => {
  it('lets a user act on their own record without the admin permission', async () => {
    rbac.permissionsFor.mockResolvedValue(new Set());
    const req = { user: { id: 'u1' }, params: { id: 'u1' } };

    await expect(run(authorizeSelfOr('users:read'), req)).resolves.toBeUndefined();
    expect(rbac.permissionsFor).not.toHaveBeenCalled();
  });

  it('blocks reading someone else without the permission (IDOR)', async () => {
    rbac.permissionsFor.mockResolvedValue(new Set(['products:read']));
    const req = { user: { id: 'u1' }, params: { id: 'victim' } };

    const err = await run(authorizeSelfOr('users:read'), req);
    expect(err).toMatchObject({ statusCode: 403 });
  });

  it('allows staff holding the permission to act on someone else', async () => {
    rbac.permissionsFor.mockResolvedValue(new Set(['users:read']));
    const req = { user: { id: 'staff' }, params: { id: 'victim' } };

    await expect(run(authorizeSelfOr('users:read'), req)).resolves.toBeUndefined();
  });
});