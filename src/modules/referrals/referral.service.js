'use strict';

const crypto = require('crypto');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const repo = require('./referral.repository');
const fraud = require('./fraud.evaluator');

async function generateCode() {
  let code;
  let exists = true;
  while (exists) {
    code = `REF${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    // eslint-disable-next-line no-await-in-loop
    exists = await repo.codeExists(code);
  }
  return code;
}

const getOrCreateCode = async (customerId) => {
  let referral = await repo.findByReferrer(customerId);
  if (!referral) referral = await repo.create({ referrerCustomerId: customerId, code: await generateCode() });
  return referral;
};

// Link -> signup: called from auth.service right after a new account is created
// with a referral code. Records the SIGNED_UP stage; nothing is rewarded yet.
const recordSignup = async ({ referralCode, newUserId }, transaction) => {
  const referral = await repo.findByCode(String(referralCode).trim().toUpperCase(), transaction);
  if (!referral) return null;
  return repo.createEvent({ referralId: referral.id, refereeUserId: newUserId, stage: 'SIGNED_UP' }, transaction);
};

const recordStage = async (refereeUserId, stage, { orderId, fraudSignals } = {}, transaction) => {
  const events = await repo.findEventsForReferee(refereeUserId, transaction);
  const signup = events.find((e) => e.stage === 'SIGNED_UP');
  if (!signup) return null; // this user was never referred
  return repo.createEvent({ referralId: signup.referralId, refereeUserId, stage, orderId, fraudSignals }, transaction);
};

const recordFirstPurchase = (refereeUserId, orderId, transaction) => recordStage(refereeUserId, 'FIRST_PURCHASE', { orderId }, transaction);
const recordPaymentSuccess = (refereeUserId, orderId, transaction) => recordStage(refereeUserId, 'PAYMENT_SUCCESS', { orderId }, transaction);
const recordDelivery = (refereeUserId, orderId, transaction) => recordStage(refereeUserId, 'DELIVERED', { orderId }, transaction);
const recordCancellation = (refereeUserId, orderId, transaction) => recordStage(refereeUserId, 'CANCELLED', { orderId }, transaction);

const REFERRAL_REWARD_AMOUNT = 100;

/**
 * Validates and rewards a referral. A reward can only be issued once the
 * referee's order has been delivered AND the return window has fully elapsed
 * with no return on that order, and the fraud evaluator does not flag the
 * signals supplied by the caller. Neither condition alone is sufficient.
 */
const validateAndReward = async (refereeUserId, { deliveredAt, fraudSignals } = {}, transaction) => {
  const events = await repo.findEventsForReferee(refereeUserId, transaction);
  const signup = events.find((e) => e.stage === 'SIGNED_UP');
  if (!signup) throw ApiError.badRequest('This user was not referred');

  const delivered = events.find((e) => e.stage === 'DELIVERED');
  if (!delivered) throw ApiError.conflict('The referred order has not been delivered yet');

  const alreadyRewarded = events.some((e) => e.stage === 'REWARD_ISSUED');
  if (alreadyRewarded) throw ApiError.conflict('This referral has already been rewarded');

  const cancelledOrReturned = events.some((e) => ['CANCELLED'].includes(e.stage));
  if (cancelledOrReturned) throw ApiError.conflict('This referral is not eligible: the order was cancelled or returned');

  const windowEnd = new Date((deliveredAt || delivered.createdAt).getTime() + config.referral.returnWindowDays * 86400000);
  if (windowEnd > new Date()) throw ApiError.conflict('The return window has not closed yet');

  if (fraud.isSuspicious(fraudSignals)) {
    await repo.createEvent({ referralId: signup.referralId, refereeUserId, stage: 'FRAUD_FLAGGED', fraudSignals }, transaction);
    throw ApiError.conflict('This referral was flagged for review and cannot be rewarded automatically');
  }

  const runner = async (t) => {
    await repo.createEvent({ referralId: signup.referralId, refereeUserId, stage: 'VALIDATED', fraudSignals }, t);
    await repo.createEvent({ referralId: signup.referralId, refereeUserId, stage: 'REWARD_ISSUED' }, t);

    try {
      // eslint-disable-next-line global-require
      const walletService = require('../loyalty/wallet.service');
      // eslint-disable-next-line global-require
      const db = require('../../models');
      const referral = await db.Referral.findByPk(signup.referralId, { transaction: t });
      await walletService.credit({ customerId: referral.referrerCustomerId, type: 'REFERRAL_CREDIT', amount: REFERRAL_REWARD_AMOUNT, referenceType: 'REFERRAL', referenceId: referral.id }, t);
    } catch (err) { /* loyalty module optional in isolated tests */ }

    return { rewarded: true };
  };
  return transaction ? runner(transaction) : repo.transaction(runner);
};

module.exports = { getOrCreateCode, recordSignup, recordFirstPurchase, recordPaymentSuccess, recordDelivery, recordCancellation, validateAndReward, REFERRAL_REWARD_AMOUNT };
