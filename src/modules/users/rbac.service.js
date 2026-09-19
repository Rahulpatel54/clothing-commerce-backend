'use strict';

const db = require('../../models');

const ADMIN_ROLE = 'admin';

/**
 * Resolves the effective permission set for the authenticated user.
 * Cached on the request object, so several authorize() calls in one route
 * cost a single query at most. Token claims are never trusted on their own:
 * a role revoked after the token was issued must take effect immediately.
 */
async function permissionsFor(req) {
  if (req.rbacCache) return req.rbacCache;

  const user = await db.User.findByPk(req.user.id, {
    include: [
      {
        model: db.Role,
        as: 'roles',
        through: { attributes: [] },
        include: [{ model: db.Permission, as: 'permissions', through: { attributes: [] } }],
      },
    ],
  });

  const roles = (user && user.roles) || [];
  const granted = new Set();
  roles.forEach((role) => {
    if (role.name === ADMIN_ROLE) granted.add('*');
    (role.permissions || []).forEach((p) => granted.add(p.name));
  });

  req.user.roles = roles.map((r) => r.name);
  req.rbacCache = granted;
  return granted;
}

const hasRole = (req, role) => (req.user.roles || []).includes(role);

module.exports = { permissionsFor, hasRole, ADMIN_ROLE };