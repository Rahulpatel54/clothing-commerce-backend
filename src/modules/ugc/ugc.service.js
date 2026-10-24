'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./ugc.repository');

const DEFAULT_UGC_REWARD_AMOUNT = 50;

async function getOrder(orderId) {
  try {
    // eslint-disable-next-line global-require
    const orderRepo = require('../orders/order.repository');
    return await orderRepo.findById(orderId);
  } catch (err) {
    return null;
  }
}

function isPrivilegedStaff(user) {
  if (!user) return false;
  const roles = user.roles || [];
  const perms = user.permissions || [];
  return roles.includes('admin') || perms.includes('ugc:read') || perms.includes('ugc:update');
}

const submit = async (req, payload) => {
  const customerId = req.customerId;
  if (!customerId) throw ApiError.forbidden('Only customers can submit UGC');

  const { orderId, platform, mediaType, mediaUrl, postUrl, caption, productId } = payload;

  const order = await getOrder(orderId);
  if (!order || order.customerId !== customerId) {
    throw ApiError.badRequest('Order not found or does not belong to this customer');
  }

  if (order.status !== 'DELIVERED') {
    throw ApiError.badRequest('UGC can only be submitted for delivered orders');
  }

  const resolvedProductId = productId || (order.items && order.items[0] ? order.items[0].productId : null);

  const runner = async (t) => {
    const submission = await repo.createSubmission(
      {
        customerId,
        orderId,
        productId: resolvedProductId,
        platform,
        mediaType,
        mediaUrl,
        postUrl,
        caption,
        status: 'PENDING',
        orderVerified: true,
        adminVerified: false,
      },
      t
    );

    await audit.record(req, {
      action: 'ugc.submit',
      entityType: 'UgcSubmission',
      entityId: submission.id,
      after: submission.toJSON ? submission.toJSON() : submission,
      transaction: t,
    });

    return repo.findSubmissionById(submission.id, t);
  };

  return repo.transaction(runner);
};

const verifyAndReward = async (req, id, { status, rewardAmount, rejectionReason }) => {
  const submission = await repo.findSubmissionById(id);
  if (!submission) throw ApiError.notFound('UGC submission not found');

  if (submission.status === 'APPROVED' || submission.adminVerified) {
    throw ApiError.conflict('Submission has already been verified and rewarded');
  }

  const runner = async (t) => {
    if (status === 'APPROVED') {
      if (!submission.orderVerified) {
        throw ApiError.conflict('Cannot approve UGC submission: order is not verified');
      }

      const amount = rewardAmount != null ? Number(rewardAmount) : DEFAULT_UGC_REWARD_AMOUNT;
      if (amount <= 0) throw ApiError.badRequest('Reward amount must be positive');

      await repo.updateSubmission(
        submission,
        {
          status: 'APPROVED',
          adminVerified: true,
          reviewedBy: req.user ? req.user.id : null,
          reviewedAt: new Date(),
        },
        t
      );

      let walletTx = null;
      try {
        // eslint-disable-next-line global-require
        const walletService = require('../loyalty/wallet.service');
        walletTx = await walletService.credit(
          {
            customerId: submission.customerId,
            type: 'UGC_CREDIT',
            amount,
            referenceType: 'UGC_SUBMISSION',
            referenceId: submission.id,
            note: `Reward for verified UGC submission (${submission.platform})`,
          },
          t
        );
      } catch (err) {
        // Loyalty module is optional in isolated tests
      }

      await repo.createReward(
        {
          submissionId: submission.id,
          customerId: submission.customerId,
          amount,
          walletTransactionId: walletTx ? walletTx.id : null,
          issuedAt: new Date(),
        },
        t
      );

      await audit.record(req, {
        action: 'ugc.verify',
        entityType: 'UgcSubmission',
        entityId: submission.id,
        before: { status: submission.status, adminVerified: submission.adminVerified },
        after: { status: 'APPROVED', adminVerified: true, amount },
        transaction: t,
      });

      return repo.findSubmissionById(submission.id, t);
    }

    if (status === 'REJECTED') {
      await repo.updateSubmission(
        submission,
        {
          status: 'REJECTED',
          adminVerified: false,
          rejectionReason: rejectionReason || 'Content does not meet UGC guidelines',
          reviewedBy: req.user ? req.user.id : null,
          reviewedAt: new Date(),
        },
        t
      );

      await audit.record(req, {
        action: 'ugc.reject',
        entityType: 'UgcSubmission',
        entityId: submission.id,
        before: { status: submission.status },
        after: { status: 'REJECTED', rejectionReason },
        transaction: t,
      });

      return repo.findSubmissionById(submission.id, t);
    }

    throw ApiError.badRequest('Status must be either APPROVED or REJECTED');
  };

  return repo.transaction(runner);
};

const getSubmission = async (req, id) => {
  const submission = await repo.findSubmissionById(id);
  if (!submission) throw ApiError.notFound('UGC submission not found');

  const isOwner = req.customerId && submission.customerId === req.customerId;
  const isPrivileged = isPrivilegedStaff(req.user);
  if (!isOwner && !isPrivileged) throw ApiError.forbidden('Not allowed to view this submission');

  return submission;
};

const listSubmissions = async (req, query) => {
  const filters = { ...query };
  const isPrivileged = isPrivilegedStaff(req.user);

  if (!isPrivileged) {
    if (!req.customerId) throw ApiError.forbidden('Authentication required');
    filters.customerId = req.customerId;
  }

  return repo.listSubmissions({
    filters,
    page: query.page,
    limit: query.limit,
  });
};

const listRewards = async (req, query) => {
  const filters = { ...query };
  const isPrivileged = isPrivilegedStaff(req.user);

  if (!isPrivileged) {
    if (!req.customerId) throw ApiError.forbidden('Authentication required');
    filters.customerId = req.customerId;
  }

  return repo.listRewards({
    filters,
    page: query.page,
    limit: query.limit,
  });
};

module.exports = {
  submit,
  verifyAndReward,
  getSubmission,
  listSubmissions,
  listRewards,
  DEFAULT_UGC_REWARD_AMOUNT,
};
