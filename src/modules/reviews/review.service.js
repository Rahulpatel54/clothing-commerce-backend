'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./review.repository');

async function getProductVariant(variantId) {
  try {
    // eslint-disable-next-line global-require
    const productRepo = require('../products/product.repository');
    return await productRepo.findVariantById(variantId);
  } catch (err) {
    return null;
  }
}

async function findEligibleDeliveredOrder(customerId, variantId) {
  try {
    // eslint-disable-next-line global-require
    const orderRepo = require('../orders/order.repository');
    const { rows: orders } = await orderRepo.list({
      filters: { customerId, status: 'DELIVERED' },
      limit: 100,
      offset: 0,
    });
    return orders.find((o) => o.items && o.items.some((item) => item.variantId === variantId)) || null;
  } catch (err) {
    return null;
  }
}

function isPrivilegedStaff(user) {
  if (!user) return false;
  const roles = user.roles || [];
  const perms = user.permissions || [];
  return roles.includes('admin') || perms.includes('reviews:update') || perms.includes('reviews:read');
}

const create = async (req, payload) => {
  const customerId = req.customerId;
  if (!customerId) throw ApiError.forbidden('Only customers can write reviews');

  const { variantId, rating, title, comment, fit, qualityRating, images = [] } = payload;

  const variant = await getProductVariant(variantId);
  if (!variant) throw ApiError.notFound('Product variant not found');

  const existing = await repo.findByCustomerAndVariant(customerId, variantId);
  if (existing) throw ApiError.conflict('You have already submitted a review for this variant');

  const eligibleOrder = await findEligibleDeliveredOrder(customerId, variantId);
  if (!eligibleOrder) {
    throw ApiError.forbidden('Reviews can only be submitted for delivered, non-returned purchases');
  }

  const runner = async (t) => {
    const review = await repo.create(
      {
        customerId,
        productId: variant.productId,
        variantId,
        orderId: eligibleOrder.id,
        rating,
        title,
        comment,
        fit,
        qualityRating,
        isVerifiedPurchase: true,
        status: 'PENDING',
      },
      t
    );

    if (images && images.length > 0) {
      const formattedImages = images.map((img, idx) => ({
        reviewId: review.id,
        url: typeof img === 'string' ? img : img.url,
        altText: typeof img === 'object' ? img.altText : null,
        displayOrder: typeof img === 'object' && img.displayOrder != null ? img.displayOrder : idx,
      }));
      await repo.createImages(formattedImages, t);
    }

    await audit.record(req, {
      action: 'review.create',
      entityType: 'Review',
      entityId: review.id,
      after: review.toJSON ? review.toJSON() : review,
      transaction: t,
    });

    return repo.findById(review.id, t);
  };

  return repo.transaction(runner);
};

const update = async (req, id, payload) => {
  const review = await repo.findById(id);
  if (!review) throw ApiError.notFound('Review not found');

  const isOwner = req.customerId && review.customerId === req.customerId;
  const isPrivileged = isPrivilegedStaff(req.user);
  if (!isOwner && !isPrivileged) throw ApiError.forbidden('Not allowed to update this review');

  const runner = async (t) => {
    const fieldsToUpdate = {};
    if (payload.rating != null) fieldsToUpdate.rating = payload.rating;
    if (payload.title !== undefined) fieldsToUpdate.title = payload.title;
    if (payload.comment !== undefined) fieldsToUpdate.comment = payload.comment;
    if (payload.fit !== undefined) fieldsToUpdate.fit = payload.fit;
    if (payload.qualityRating !== undefined) fieldsToUpdate.qualityRating = payload.qualityRating;

    // Shopper edits require re-moderation; staff edits preserve or adjust status explicitly.
    if (isOwner && !isPrivileged) {
      fieldsToUpdate.status = 'PENDING';
    }

    await repo.update(review, fieldsToUpdate, t);

    if (payload.images !== undefined) {
      await repo.deleteImages(review.id, t);
      if (Array.isArray(payload.images) && payload.images.length > 0) {
        const formattedImages = payload.images.map((img, idx) => ({
          reviewId: review.id,
          url: typeof img === 'string' ? img : img.url,
          altText: typeof img === 'object' ? img.altText : null,
          displayOrder: typeof img === 'object' && img.displayOrder != null ? img.displayOrder : idx,
        }));
        await repo.createImages(formattedImages, t);
      }
    }

    await audit.record(req, {
      action: 'review.update',
      entityType: 'Review',
      entityId: review.id,
      before: review.toJSON ? review.toJSON() : review,
      after: fieldsToUpdate,
      transaction: t,
    });

    return repo.findById(review.id, t);
  };

  return repo.transaction(runner);
};

const moderate = async (req, id, { status, moderationNote }) => {
  const review = await repo.findById(id);
  if (!review) throw ApiError.notFound('Review not found');

  const runner = async (t) => {
    const updated = await repo.update(
      review,
      {
        status,
        moderationNote,
        moderatedBy: req.user ? req.user.id : null,
        moderatedAt: new Date(),
      },
      t
    );

    await audit.record(req, {
      action: 'review.moderate',
      entityType: 'Review',
      entityId: review.id,
      before: { status: review.status, moderationNote: review.moderationNote },
      after: { status, moderationNote },
      transaction: t,
    });

    return repo.findById(updated.id, t);
  };

  return repo.transaction(runner);
};

const remove = async (req, id) => {
  const review = await repo.findById(id);
  if (!review) throw ApiError.notFound('Review not found');

  const isOwner = req.customerId && review.customerId === req.customerId;
  const isPrivileged = req.user && ((req.user.permissions || []).includes('reviews:delete') || (req.user.roles || []).includes('admin'));
  if (!isOwner && !isPrivileged) throw ApiError.forbidden('Not allowed to delete this review');

  const runner = async (t) => {
    await repo.deleteImages(review.id, t);
    await repo.deleteReview(review.id, t);

    await audit.record(req, {
      action: 'review.delete',
      entityType: 'Review',
      entityId: review.id,
      before: review.toJSON ? review.toJSON() : review,
      transaction: t,
    });

    return { deleted: true };
  };

  return repo.transaction(runner);
};

const voteHelpful = async (req, id) => {
  const review = await repo.findById(id);
  if (!review) throw ApiError.notFound('Review not found');
  if (review.status !== 'APPROVED') {
    throw ApiError.badRequest('Only approved reviews can receive helpful votes');
  }
  return repo.incrementHelpful(id);
};

const get = async (req, id) => {
  const review = await repo.findById(id);
  if (!review) throw ApiError.notFound('Review not found');

  if (review.status !== 'APPROVED') {
    const isOwner = req.customerId && review.customerId === req.customerId;
    const isPrivileged = isPrivilegedStaff(req.user);
    if (!isOwner && !isPrivileged) throw ApiError.notFound('Review not found');
  }

  return review;
};

const list = async (req, query) => {
  const filters = { ...query };
  const isPrivileged = isPrivilegedStaff(req.user);

  if (!isPrivileged) {
    filters.status = 'APPROVED';
  }

  return repo.list({
    filters,
    page: query.page,
    limit: query.limit,
    sort: query.sort,
  });
};

const getProductSummary = async (productId) => {
  return repo.getProductSummary(productId);
};

module.exports = {
  create,
  update,
  moderate,
  remove,
  voteHelpful,
  get,
  list,
  getProductSummary,
};
