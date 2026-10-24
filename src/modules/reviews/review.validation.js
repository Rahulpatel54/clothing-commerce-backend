'use strict';

const Joi = require('joi');

const id = Joi.string().uuid().required();

const imageSchema = Joi.alternatives().try(
  Joi.string().uri(),
  Joi.object({
    url: Joi.string().uri().required(),
    altText: Joi.string().max(255).allow('', null),
    displayOrder: Joi.number().integer().min(0),
  })
);

module.exports = {
  create: {
    body: Joi.object({
      variantId: id,
      rating: Joi.number().integer().min(1).max(5).required(),
      title: Joi.string().max(255).allow('', null),
      comment: Joi.string().min(5).max(5000).required(),
      fit: Joi.string().valid('RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'),
      qualityRating: Joi.number().integer().min(1).max(5),
      images: Joi.array().items(imageSchema).max(10),
    }),
  },

  update: {
    params: Joi.object({ id }),
    body: Joi.object({
      rating: Joi.number().integer().min(1).max(5),
      title: Joi.string().max(255).allow('', null),
      comment: Joi.string().min(5).max(5000),
      fit: Joi.string().valid('RUNS_SMALL', 'TRUE_TO_SIZE', 'RUNS_LARGE'),
      qualityRating: Joi.number().integer().min(1).max(5),
      images: Joi.array().items(imageSchema).max(10),
    }).min(1),
  },

  byId: {
    params: Joi.object({ id }),
  },

  list: {
    query: Joi.object({
      productId: Joi.string().uuid(),
      variantId: Joi.string().uuid(),
      customerId: Joi.string().uuid(),
      status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED'),
      rating: Joi.number().integer().min(1).max(5),
      sort: Joi.string().valid('recent', 'highest_rated', 'lowest_rated', 'most_helpful'),
      page: Joi.number().integer().min(1),
      limit: Joi.number().integer().min(1).max(100),
    }),
  },

  summary: {
    query: Joi.object({
      productId: id,
    }),
  },

  moderate: {
    params: Joi.object({ id }),
    body: Joi.object({
      status: Joi.string().valid('APPROVED', 'REJECTED').required(),
      moderationNote: Joi.string().max(1000).allow('', null),
    }),
  },
};
