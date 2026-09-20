'use strict';

const db = require('../../models');

const findUserByEmail = (email, { withSecrets = false } = {}) =>
  (withSecrets ? db.User.scope('withSecrets') : db.User).findOne({ where: { email: String(email).toLowerCase() } });

const findUserById = (id, { withSecrets = false } = {}) =>
  (withSecrets ? db.User.scope('withSecrets') : db.User).findByPk(id);

const findUserWithRoles = (id) =>
  db.User.findByPk(id, {
    include: [
      {
        model: db.Role,
        as: 'roles',
        through: { attributes: [] },
        include: [{ model: db.Permission, as: 'permissions', through: { attributes: [] } }],
      },
    ],
  });

const createUser = (payload, transaction) => db.User.create(payload, { transaction });
const updateUser = (user, fields, transaction) => user.update(fields, { transaction });
const findRoleByName = (name, transaction) => db.Role.findOne({ where: { name }, transaction });
const assignRole = (user, role, transaction) => user.addRole(role, { transaction });
const createRefreshToken = (payload, transaction) => db.RefreshToken.create(payload, { transaction });
const findRefreshTokenByHash = (tokenHash, transaction) => db.RefreshToken.findOne({ where: { tokenHash }, transaction });

const revokeRefreshToken = (token, { reason, replacedByTokenId = null, transaction } = {}) =>
  token.update({ revokedAt: new Date(), revokedReason: reason, replacedByTokenId }, { transaction });

const revokeAllRefreshTokensForUser = (userId, { reason, transaction } = {}) =>
  db.RefreshToken.update(
    { revokedAt: new Date(), revokedReason: reason },
    { where: { userId, revokedAt: null }, transaction }
  );

const createPasswordResetToken = (payload, transaction) => db.PasswordResetToken.create(payload, { transaction });
const findPasswordResetByHash = (tokenHash, transaction) => db.PasswordResetToken.findOne({ where: { tokenHash }, transaction });
const markPasswordResetUsed = (token, transaction) => token.update({ usedAt: new Date() }, { transaction });

const invalidateOtherPasswordResets = (userId, transaction) =>
  db.PasswordResetToken.update({ usedAt: new Date() }, { where: { userId, usedAt: null }, transaction });

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  findUserByEmail, findUserById, findUserWithRoles, createUser, updateUser, findRoleByName, assignRole,
  createRefreshToken, findRefreshTokenByHash, revokeRefreshToken, revokeAllRefreshTokensForUser,
  createPasswordResetToken, findPasswordResetByHash, markPasswordResetUsed, invalidateOtherPasswordResets, transaction,
};
