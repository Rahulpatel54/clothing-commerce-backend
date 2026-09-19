'use strict';

const { Op } = require('sequelize');
const db = require('../../models');

const userInclude = { model: db.User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName', 'phone', 'status'] };
const addressInclude = { model: db.Address, as: 'addresses', separate: true, order: [['createdAt', 'DESC']] };

const list = async ({ filters = {}, page, limit, offset, sort = 'createdAt', order = 'DESC' }) => {
  const where = {};
  if (filters.tag) where.tags = { [Op.contains]: [filters.tag] };
  if (filters.acquisitionSource) where.acquisitionSource = filters.acquisitionSource;
  if (filters.minSpend) where.totalSpend = { [Op.gte]: filters.minSpend };

  const userWhere = filters.search
    ? {
        [Op.or]: [
          { email: { [Op.iLike]: `%${filters.search}%` } },
          { firstName: { [Op.iLike]: `%${filters.search}%` } },
          { lastName: { [Op.iLike]: `%${filters.search}%` } },
        ],
      }
    : undefined;

  const { rows, count } = await db.Customer.findAndCountAll({
    where,
    include: [{ ...userInclude, ...(userWhere ? { where: userWhere, required: true } : {}) }],
    order: [[sort, order]],
    limit,
    offset,
    distinct: true,
  });
  return { rows, count, page, limit };
};

const findById = (id) => db.Customer.findByPk(id, { include: [userInclude, addressInclude] });
const findByUserId = (userId) => db.Customer.findOne({ where: { userId }, include: [userInclude, addressInclude] });
const create = (payload, transaction) => db.Customer.create(payload, { transaction });
const update = (customer, fields, transaction) => customer.update(fields, { transaction });

const findAddress = (id, customerId) => db.Address.findOne({ where: { id, customerId } });
const listAddresses = (customerId) => db.Address.findAll({ where: { customerId }, order: [['createdAt', 'DESC']] });
const countAddresses = (customerId, transaction) => db.Address.count({ where: { customerId }, transaction });
const createAddress = (payload, transaction) => db.Address.create(payload, { transaction });
const updateAddress = (address, fields, transaction) => address.update(fields, { transaction });
const destroyAddress = (address, transaction) => address.destroy({ transaction });

// Clears the flag everywhere else so "default" can only ever point at one row.
const clearDefaults = (customerId, field, exceptId, transaction) =>
  db.Address.update(
    { [field]: false },
    { where: { customerId, ...(exceptId ? { id: { [Op.ne]: exceptId } } : {}) }, transaction }
  );

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  list,
  findById,
  findByUserId,
  create,
  update,
  findAddress,
  listAddresses,
  countAddresses,
  createAddress,
  updateAddress,
  destroyAddress,
  clearDefaults,
  transaction,
};