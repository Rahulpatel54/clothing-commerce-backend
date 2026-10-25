'use strict';

const Joi = require('joi');

const idParam = Joi.object({
  id: Joi.string().uuid().required(),
});

const CHANNELS = ['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'WHATSAPP', 'ORGANIC', 'REFERRAL', 'DIRECT', 'EMAIL', 'OTHER'];
const EVENT_TYPES = ['CLICK', 'VISIT', 'SIGNUP', 'CART_ADD', 'CHECKOUT_START', 'PURCHASE'];

const createCampaign = {
  body: Joi.object({
    name: Joi.string().trim().max(100).required(),
    slug: Joi.string().trim().max(100).lowercase(),
    channel: Joi.string().valid(...CHANNELS).default('OTHER'),
    budget: Joi.number().min(0).precision(2).default(0),
    audience: Joi.string().trim().max(255).allow('', null),
    utmSource: Joi.string().trim().max(100).allow('', null),
    utmMedium: Joi.string().trim().max(100).allow('', null),
    utmCampaign: Joi.string().trim().max(100).allow('', null),
    utmTerm: Joi.string().trim().max(100).allow('', null),
    utmContent: Joi.string().trim().max(100).allow('', null),
    discountCouponId: Joi.string().uuid().allow(null),
    startsAt: Joi.string().isoDate().allow(null),
    endsAt: Joi.string().isoDate().allow(null),
    isActive: Joi.boolean().default(true),
  }),
};

const updateCampaign = {
  params: idParam,
  body: Joi.object({
    name: Joi.string().trim().max(100),
    slug: Joi.string().trim().max(100).lowercase(),
    channel: Joi.string().valid(...CHANNELS),
    budget: Joi.number().min(0).precision(2),
    audience: Joi.string().trim().max(255).allow('', null),
    utmSource: Joi.string().trim().max(100).allow('', null),
    utmMedium: Joi.string().trim().max(100).allow('', null),
    utmCampaign: Joi.string().trim().max(100).allow('', null),
    utmTerm: Joi.string().trim().max(100).allow('', null),
    utmContent: Joi.string().trim().max(100).allow('', null),
    discountCouponId: Joi.string().uuid().allow(null),
    startsAt: Joi.string().isoDate().allow(null),
    endsAt: Joi.string().isoDate().allow(null),
    isActive: Joi.boolean(),
  }).min(1),
};

const listCampaigns = {
  query: Joi.object({
    channel: Joi.string().valid(...CHANNELS),
    isActive: Joi.boolean(),
    search: Joi.string().trim(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const getCampaign = {
  params: idParam,
};

const deleteCampaign = {
  params: idParam,
};

const trackEvent = {
  body: Joi.object({
    eventType: Joi.string().valid(...EVENT_TYPES).required(),
    campaignId: Joi.string().uuid().allow(null),
    utmSource: Joi.string().trim().max(100).allow('', null),
    utmMedium: Joi.string().trim().max(100).allow('', null),
    utmCampaign: Joi.string().trim().max(100).allow('', null),
    utmTerm: Joi.string().trim().max(100).allow('', null),
    utmContent: Joi.string().trim().max(100).allow('', null),
    sessionId: Joi.string().trim().max(128).allow('', null),
    customerId: Joi.string().uuid().allow(null),
    metadata: Joi.object().allow(null),
  }),
};

module.exports = {
  createCampaign,
  updateCampaign,
  listCampaigns,
  getCampaign,
  deleteCampaign,
  trackEvent,
};
