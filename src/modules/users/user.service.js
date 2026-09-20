'use strict';

const bcrypt = require('bcrypt');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./user.repository');

const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];

function present(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  delete json.passwordHash;
  delete json.mfaSecretEncrypted;
  return { ...json, roles: (json.roles || []).map((r) => r.name || r) };
}

const list = async (query) => {
  const result = await repo.list(query);
  return { ...result, rows: result.rows.map(present) };
};

const get = async (id) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return present(user);
};

const create = async (req, payload) => {
  if (await repo.findByEmail(payload.email)) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(payload.password, config.auth.bcryptRounds);

  const user = await repo.transaction(async (t) => {
    const created = await repo.create(
      {
        email: payload.email, phone: payload.phone, passwordHash,
        firstName: payload.firstName, lastName: payload.lastName, status: payload.status || 'ACTIVE',
      },
      t
    );

    const roles = await repo.findRolesByNames(payload.roles && payload.roles.length ? payload.roles : ['customer'], t);
    if (payload.roles && roles.length !== payload.roles.length) throw ApiError.badRequest('One or more roles do not exist');
    await repo.setRoles(created, roles, t);

    await audit.record(req, { action: 'user.create', entityType: 'User', entityId: created.id, after: created, transaction: t });
    return created;
  });

  return get(user.id);
};

const update = async (req, id, payload) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  const before = present(user);
  const fields = ['firstName', 'lastName', 'phone'].reduce((acc, key) => {
    if (payload[key] !== undefined) acc[key] = payload[key];
    return acc;
  }, {});

  await repo.update(user, fields);
  await audit.record(req, { action: 'user.update', entityType: 'User', entityId: id, before, after: user });
  return get(id);
};

const changeStatus = async (req, id, { status, reason }) => {
  if (!STATUSES.includes(status)) throw ApiError.badRequest('Unknown status');
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.id === req.user.id) throw ApiError.badRequest('You cannot change your own status');

  const before = present(user);
  await repo.update(user, { status, ...(status === 'ACTIVE' ? { lockedUntil: null, failedLoginAttempts: 0 } : {}) });
  await audit.record(req, { action: 'user.status_change', entityType: 'User', entityId: id, before, after: { status, reason } });
  return get(id);
};

const assignRoles = async (req, id, { roles }) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.id === req.user.id) throw ApiError.badRequest('You cannot change your own roles');

  const before = present(user);
  const found = await repo.findRolesByNames(roles);
  if (found.length !== roles.length) throw ApiError.badRequest('One or more roles do not exist');

  await repo.setRoles(user, found);
  await audit.record(req, { action: 'user.roles_assign', entityType: 'User', entityId: id, before, after: { roles } });
  return get(id);
};

const remove = async (req, id) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.id === req.user.id) throw ApiError.badRequest('You cannot delete your own account');

  await repo.destroy(user);
  await audit.record(req, { action: 'user.delete', entityType: 'User', entityId: id, before: present(user) });
  return { deleted: true };
};

module.exports = { list, get, create, update, changeStatus, assignRoles, remove, present, STATUSES };
