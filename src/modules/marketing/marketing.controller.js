'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const service = require('./marketing.service');

/**
 * @openapi
 * /marketing/campaigns:
 *   post:
 *     tags:
 *       - Marketing
 *     summary: Create a marketing campaign
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Diwali Fest 2026"
 *               slug:
 *                 type: string
 *                 example: "diwali-fest-2026"
 *               channel:
 *                 type: string
 *                 enum: [INSTAGRAM, FACEBOOK, YOUTUBE, WHATSAPP, ORGANIC, REFERRAL, DIRECT, EMAIL, OTHER]
 *                 default: OTHER
 *               budget:
 *                 type: number
 *                 example: 50000.00
 *               audience:
 *                 type: string
 *                 example: "Men and Women 18-35 metro cities"
 *               utmSource:
 *                 type: string
 *                 example: "instagram"
 *               utmMedium:
 *                 type: string
 *                 example: "influencer"
 *               utmCampaign:
 *                 type: string
 *                 example: "diwali_drop"
 *               discountCouponId:
 *                 type: string
 *                 format: uuid
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *               endsAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Campaign created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Slug conflict
 */
const createCampaign = catchAsync(async (req, res) => {
  const campaign = await service.createCampaign(req, req.body);
  return success(res, { data: campaign, message: 'Campaign created', statusCode: 201 });
});

/**
 * @openapi
 * /marketing/campaigns:
 *   get:
 *     tags:
 *       - Marketing
 *     summary: List marketing campaigns
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [INSTAGRAM, FACEBOOK, YOUTUBE, WHATSAPP, ORGANIC, REFERRAL, DIRECT, EMAIL, OTHER]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of campaigns
 */
const listCampaigns = catchAsync(async (req, res) => {
  const result = await service.listCampaigns(req.query);
  return paginated(res, result);
});

/**
 * @openapi
 * /marketing/campaigns/{id}:
 *   get:
 *     tags:
 *       - Marketing
 *     summary: Get a marketing campaign with ROI and performance metrics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign details and live performance metrics
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
const getCampaign = catchAsync(async (req, res) => {
  const campaign = await service.getCampaign(req.params.id);
  return success(res, { data: campaign });
});

/**
 * @openapi
 * /marketing/campaigns/{id}:
 *   patch:
 *     tags:
 *       - Marketing
 *     summary: Update campaign parameters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               budget:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Campaign updated
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
const updateCampaign = catchAsync(async (req, res) => {
  const campaign = await service.updateCampaign(req, req.params.id, req.body);
  return success(res, { data: campaign, message: 'Campaign updated' });
});

/**
 * @openapi
 * /marketing/campaigns/{id}:
 *   delete:
 *     tags:
 *       - Marketing
 *     summary: Delete a marketing campaign
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
const deleteCampaign = catchAsync(async (req, res) => {
  const result = await service.deleteCampaign(req, req.params.id);
  return success(res, { data: result, message: 'Campaign deleted' });
});

/**
 * @openapi
 * /marketing/events:
 *   post:
 *     tags:
 *       - Marketing
 *     summary: Track a marketing or conversion event
 *     description: Public ingestion endpoint for tracking visits, clicks, cart additions, and signups.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *             properties:
 *               eventType:
 *                 type: string
 *                 enum: [CLICK, VISIT, SIGNUP, CART_ADD, CHECKOUT_START, PURCHASE]
 *               campaignId:
 *                 type: string
 *                 format: uuid
 *               utmSource:
 *                 type: string
 *               utmMedium:
 *                 type: string
 *               utmCampaign:
 *                 type: string
 *               sessionId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event tracked successfully
 */
const trackEvent = catchAsync(async (req, res) => {
  const result = await service.trackEvent(req, req.body);
  return success(res, { data: result, message: 'Event tracked' });
});

module.exports = {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  trackEvent,
};
