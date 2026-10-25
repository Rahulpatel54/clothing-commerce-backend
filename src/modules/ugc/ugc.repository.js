'use strict';

const db = require('../../models');

const customerInclude = { model: db.Customer, as: 'customer', attributes: ['id', 'userId'], include: [{ model: db.User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }] };
const orderInclude = { model: db.Order, as: 'order', attributes: ['id', 'orderNumber', 'status', 'deliveredAt'] };
const rewardInclude = { model: db.UgcReward, as: 'reward' };

const createSubmission = (payload, transaction) => db.UgcSubmission.create(payload, { transaction });

const createReward = (payload, transaction) => db.UgcReward.create(payload, { transaction });

const findSubmissionById = (id, transaction) =>
  db.UgcSubmission.findByPk(id, {
    include: [customerInclude, orderInclude, rewardInclude],
    transaction,
  });

const findRewardBySubmissionId = (submissionId, transaction) =>
  db.UgcReward.findOne({ where: { submissionId }, transaction });

const listSubmissions = async ({ filters = {}, page = 1, limit = 20 }) => {
  const where = {};
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.status) where.status = filters.status;
  if (filters.orderVerified != null) where.orderVerified = filters.orderVerified;
  if (filters.adminVerified != null) where.adminVerified = filters.adminVerified;

  const offset = (page - 1) * limit;

  const { rows, count } = await db.UgcSubmission.findAndCountAll({
    where,
    include: [customerInclude, orderInclude, rewardInclude],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { rows, count, page, limit };
};

const listRewards = async ({ filters = {}, page = 1, limit = 20 }) => {
  const where = {};
  if (filters.customerId) where.customerId = filters.customerId;

  const offset = (page - 1) * limit;

  const { rows, count } = await db.UgcReward.findAndCountAll({
    where,
    include: [
      customerInclude,
      { model: db.UgcSubmission, as: 'submission', attributes: ['id', 'platform', 'mediaType', 'mediaUrl', 'status'] },
    ],
    order: [['issuedAt', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  return { rows, count, page, limit };
};

const updateSubmission = (submission, fields, transaction) => submission.update(fields, { transaction });

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  createSubmission,
  createReward,
  findSubmissionById,
  findRewardBySubmissionId,
  listSubmissions,
  listRewards,
  updateSubmission,
  transaction,
};
