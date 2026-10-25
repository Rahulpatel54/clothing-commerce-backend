'use strict';

const db = require('../../models');

const customerInclude = { model: db.Customer, as: 'customer', attributes: ['id', 'userId'], include: [{ model: db.User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }] };
const variantInclude = { model: db.ProductVariant, as: 'variant', attributes: ['id', 'sku', 'size', 'color'] };
const imageInclude = { model: db.ReviewImage, as: 'images', attributes: ['id', 'url', 'altText', 'displayOrder'], order: [['displayOrder', 'ASC']] };

const create = (payload, transaction) => db.Review.create(payload, { transaction });

const createImages = (images, transaction) => {
  if (!images || images.length === 0) return Promise.resolve([]);
  return db.ReviewImage.bulkCreate(images, { transaction });
};

const findById = (id, transaction) =>
  db.Review.findByPk(id, {
    include: [customerInclude, variantInclude, imageInclude],
    transaction,
  });

const findByCustomerAndVariant = (customerId, variantId, transaction) =>
  db.Review.findOne({ where: { customerId, variantId }, transaction });

const list = async ({ filters = {}, page = 1, limit = 20, sort = 'recent' }) => {
  const where = {};
  if (filters.productId) where.productId = filters.productId;
  if (filters.variantId) where.variantId = filters.variantId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.status) where.status = filters.status;
  if (filters.rating) where.rating = filters.rating;
  if (filters.isVerifiedPurchase != null) where.isVerifiedPurchase = filters.isVerifiedPurchase;

  let order = [['createdAt', 'DESC']];
  if (sort === 'highest_rated') order = [['rating', 'DESC'], ['createdAt', 'DESC']];
  else if (sort === 'lowest_rated') order = [['rating', 'ASC'], ['createdAt', 'DESC']];
  else if (sort === 'most_helpful') order = [['helpfulCount', 'DESC'], ['createdAt', 'DESC']];

  const offset = (page - 1) * limit;

  const { rows, count } = await db.Review.findAndCountAll({
    where,
    include: [customerInclude, variantInclude, imageInclude],
    order,
    limit,
    offset,
    distinct: true,
  });

  return { rows, count, page, limit };
};

const update = (review, fields, transaction) => review.update(fields, { transaction });

const deleteReview = (id, transaction) => db.Review.destroy({ where: { id }, transaction });

const deleteImages = (reviewId, transaction) => db.ReviewImage.destroy({ where: { reviewId }, transaction });

const incrementHelpful = async (id, transaction) => {
  await db.Review.increment('helpfulCount', { by: 1, where: { id }, transaction });
  return findById(id, transaction);
};

const getProductSummary = async (productId) => {
  const reviews = await db.Review.findAll({
    where: { productId, status: 'APPROVED' },
    attributes: ['rating', 'fit', 'qualityRating'],
  });

  const totalCount = reviews.length;
  if (totalCount === 0) {
    return {
      averageRating: 0,
      totalCount: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      fitBreakdown: { RUNS_SMALL: 0, TRUE_TO_SIZE: 0, RUNS_LARGE: 0 },
      averageQuality: 0,
    };
  }

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const fitBreakdown = { RUNS_SMALL: 0, TRUE_TO_SIZE: 0, RUNS_LARGE: 0 };
  let ratingSum = 0;
  let qualitySum = 0;
  let qualityCount = 0;

  reviews.forEach((r) => {
    ratingSum += Number(r.rating);
    if (ratingBreakdown[r.rating] != null) ratingBreakdown[r.rating] += 1;
    if (r.fit && fitBreakdown[r.fit] != null) fitBreakdown[r.fit] += 1;
    if (r.qualityRating != null) {
      qualitySum += Number(r.qualityRating);
      qualityCount += 1;
    }
  });

  return {
    averageRating: Number((ratingSum / totalCount).toFixed(2)),
    totalCount,
    ratingBreakdown,
    fitBreakdown,
    averageQuality: qualityCount > 0 ? Number((qualitySum / qualityCount).toFixed(2)) : 0,
  };
};

const transaction = (fn) => db.sequelize.transaction(fn);

module.exports = {
  create,
  createImages,
  findById,
  findByCustomerAndVariant,
  list,
  update,
  deleteReview,
  deleteImages,
  incrementHelpful,
  getProductSummary,
  transaction,
};
