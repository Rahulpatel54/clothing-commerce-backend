'use strict';

const ApiError = require('../../utils/ApiError');
const audit = require('../audit/audit.service');
const repo = require('./marketing.repository');

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');

const createCampaign = async (req, payload) => {
  const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);
  const existing = await repo.findCampaignBySlug(slug);
  if (existing) throw ApiError.conflict('Campaign with this slug already exists');

  if (payload.startsAt && payload.endsAt && new Date(payload.startsAt) > new Date(payload.endsAt)) {
    throw ApiError.badRequest('startsAt must be before or equal to endsAt');
  }

  const campaign = await repo.createCampaign({
    name: payload.name.trim(),
    slug,
    channel: payload.channel || 'OTHER',
    budget: Number(payload.budget || 0),
    audience: payload.audience,
    utmSource: payload.utmSource || null,
    utmMedium: payload.utmMedium || null,
    utmCampaign: payload.utmCampaign || slug,
    utmTerm: payload.utmTerm || null,
    utmContent: payload.utmContent || null,
    discountCouponId: payload.discountCouponId || null,
    startsAt: payload.startsAt || null,
    endsAt: payload.endsAt || null,
    isActive: payload.isActive != null ? payload.isActive : true,
  });

  await audit.record(req, {
    action: 'campaign.create',
    entityType: 'Campaign',
    entityId: campaign.id,
    after: campaign.toJSON ? campaign.toJSON() : campaign,
  });

  return campaign;
};

const getCampaign = async (id) => {
  const campaign = await repo.findCampaignById(id);
  if (!campaign) throw ApiError.notFound('Campaign not found');

  const performance = await repo.getCampaignPerformance(id);
  const json = campaign.toJSON ? campaign.toJSON() : campaign;

  return {
    ...json,
    performance,
  };
};

const listCampaigns = async (query) => {
  return repo.listCampaigns({
    filters: query,
    page: query.page,
    limit: query.limit,
  });
};

const updateCampaign = async (req, id, payload) => {
  const campaign = await repo.findCampaignById(id);
  if (!campaign) throw ApiError.notFound('Campaign not found');

  const fields = {};
  if (payload.name) fields.name = payload.name.trim();
  if (payload.channel) fields.channel = payload.channel;
  if (payload.budget != null) fields.budget = Number(payload.budget);
  if (payload.audience !== undefined) fields.audience = payload.audience;
  if (payload.utmSource !== undefined) fields.utmSource = payload.utmSource;
  if (payload.utmMedium !== undefined) fields.utmMedium = payload.utmMedium;
  if (payload.utmCampaign !== undefined) fields.utmCampaign = payload.utmCampaign;
  if (payload.utmTerm !== undefined) fields.utmTerm = payload.utmTerm;
  if (payload.utmContent !== undefined) fields.utmContent = payload.utmContent;
  if (payload.discountCouponId !== undefined) fields.discountCouponId = payload.discountCouponId;
  if (payload.startsAt !== undefined) fields.startsAt = payload.startsAt;
  if (payload.endsAt !== undefined) fields.endsAt = payload.endsAt;
  if (payload.isActive !== undefined) fields.isActive = payload.isActive;

  if (payload.slug) {
    const slug = slugify(payload.slug);
    if (slug !== campaign.slug) {
      const existing = await repo.findCampaignBySlug(slug);
      if (existing) throw ApiError.conflict('Campaign with this slug already exists');
      fields.slug = slug;
    }
  }

  const before = campaign.toJSON ? campaign.toJSON() : campaign;
  await repo.updateCampaign(campaign, fields);

  await audit.record(req, {
    action: 'campaign.update',
    entityType: 'Campaign',
    entityId: id,
    before,
    after: fields,
  });

  return repo.findCampaignById(id);
};

const deleteCampaign = async (req, id) => {
  const campaign = await repo.findCampaignById(id);
  if (!campaign) throw ApiError.notFound('Campaign not found');

  await repo.deleteCampaign(id);

  await audit.record(req, {
    action: 'campaign.delete',
    entityType: 'Campaign',
    entityId: id,
    before: campaign.toJSON ? campaign.toJSON() : campaign,
  });

  return { deleted: true };
};

// Tracking UTM & User conversion events
const trackEvent = async (req, payload) => {
  let resolvedCampaignId = payload.campaignId || null;

  if (!resolvedCampaignId && (payload.utmCampaign || payload.utmSource)) {
    const campaign = await repo.findCampaignByUtm({
      utmSource: payload.utmSource,
      utmMedium: payload.utmMedium,
      utmCampaign: payload.utmCampaign,
    });
    if (campaign) resolvedCampaignId = campaign.id;
  }

  const customerId = req.customerId || (req.user && req.user.id) || payload.customerId || null;
  const sessionId = req.headers['x-session-id'] || payload.sessionId || null;

  const event = await repo.recordEvent({
    campaignId: resolvedCampaignId,
    customerId,
    sessionId,
    eventType: payload.eventType,
    metadata: {
      ...payload.metadata,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
    },
  });

  return { tracked: true, eventId: event.id, campaignId: resolvedCampaignId };
};

module.exports = {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  trackEvent,
};
