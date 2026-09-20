'use strict';

const db = require('../../models');

const findByCode = (code, transaction) => db.Referral.findOne({ where: { code }, transaction });
const findByReferrer = (referrerCustomerId) => db.Referral.findOne({ where: { referrerCustomerId } });
const create = (payload, transaction) => db.Referral.create(payload, { transaction });

const findEventsForReferee = (refereeUserId, transaction) =>
  db.ReferralEvent.findAll({ where: { refereeUserId }, order: [['createdAt', 'ASC']], transaction });

const findEventByStage = (referralId, refereeUserId, stage, transaction) =>
  db.ReferralEvent.findOne({ where: { referralId, refereeUserId, stage }, transaction });

const createEvent = (payload, transaction) => db.ReferralEvent.create(payload, { transaction });

const codeExists = async (code) => Boolean(await db.Referral.findOne({ where: { code }, attributes: ['id'] }));

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = { findByCode, findByReferrer, create, findEventsForReferee, findEventByStage, createEvent, codeExists, transaction };
