'use strict';

const { Op } = require('sequelize');
const db = require('../../models');

const roleInclude = { model: db.Role, as: 'roles', through: { attributes: [] } };

function buildWhere({ search, status, role }) {
  const where = {};
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${search}%` } },
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
    ];
  }
  return { where, role };
}

const list = async ({ filters = {}, page, limit, offset, sort = 'createdAt', order = 'DESC' }) => {
  const { where, role } = buildWhere(filters);
  const include = [{ ...roleInclude, ...(role ? { where: { name: role }, required: true } : {}) }];

  const { rows, count } = await db.User.findAndCountAll({ where, include, order: [[sort, order]], limit, offset, distinct: true });
  return { rows, count, page, limit };
};

const findById = (id) => db.User.findByPk(id, { include: [roleInclude] });
const findByEmail = (email) => db.User.findOne({ where: { email: String(email).toLowerCase() } });
const create = (payload, transaction) => db.User.create(payload, { transaction });
const update = (user, fields, transaction) => user.update(fields, { transaction });
const destroy = (user, transaction) => user.destroy({ transaction });
const findRolesByNames = (names, transaction) => db.Role.findAll({ where: { name: { [Op.in]: names } }, transaction });
const setRoles = (user, roles, transaction) => user.setRoles(roles, { transaction });
const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = { list, findById, findByEmail, create, update, destroy, findRolesByNames, setRoles, transaction };
