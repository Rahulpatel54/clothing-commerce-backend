'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const { getPagination } = require('../../utils/pagination');
const service = require('./ugc.service');

const submit = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /ugc:
   *   post:
   *     tags: [UGC]
   *     summary: Submit customer user-generated content for a delivered order
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [orderId, platform, mediaType, mediaUrl]
   *             properties:
   *               orderId: { type: string, format: uuid }
   *               productId: { type: string, format: uuid }
   *               platform: { type: string, enum: [INSTAGRAM, FACEBOOK, TIKTOK, YOUTUBE, PINTEREST, TWITTER, OTHER] }
   *               mediaType: { type: string, enum: [IMAGE, VIDEO, POST, STORY, REEL] }
   *               mediaUrl: { type: string }
   *               postUrl: { type: string }
   *               caption: { type: string }
   *     responses:
   *       201: { description: UGC submission created }
   *       400: { $ref: '#/components/responses/BadRequest' }
   *       403: { $ref: '#/components/responses/Forbidden' }
   */
  const submission = await service.submit(req, req.body);
  return success(res, { statusCode: 201, data: submission, message: 'UGC submitted successfully' });
});

const listSubmissions = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /ugc:
   *   get:
   *     tags: [UGC]
   *     summary: List UGC submissions (customers see own; staff see all)
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: customerId, schema: { type: string, format: uuid } }
   *       - { in: query, name: orderId, schema: { type: string, format: uuid } }
   *       - { in: query, name: status, schema: { type: string, enum: [PENDING, APPROVED, REJECTED] } }
   *       - { in: query, name: orderVerified, schema: { type: boolean } }
   *       - { in: query, name: adminVerified, schema: { type: boolean } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: UGC submissions }
   */
  const { page, limit } = getPagination(req.query);
  const { rows, count } = await service.listSubmissions(req, { ...req.query, page, limit });
  return paginated(res, { rows, count, page, limit });
});

const getSubmission = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /ugc/{id}:
   *   get:
   *     tags: [UGC]
   *     summary: Get UGC submission details
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     responses:
   *       200: { description: UGC submission details }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/NotFound' }
   */
  const submission = await service.getSubmission(req, req.params.id);
  return success(res, { data: submission });
});

const verify = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /ugc/{id}/verify:
   *   patch:
   *     tags: [UGC]
   *     summary: Admin verification of UGC submission (approves/rejects and credits wallet reward)
   *     security: [{ bearerAuth: [] }]
   *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status: { type: string, enum: [APPROVED, REJECTED] }
   *               rewardAmount: { type: number, minimum: 1 }
   *               rejectionReason: { type: string }
   *     responses:
   *       200: { description: UGC submission verified and rewarded }
   *       403: { $ref: '#/components/responses/Forbidden' }
   *       404: { $ref: '#/components/responses/NotFound' }
   *       409: { description: Already verified }
   */
  const result = await service.verifyAndReward(req, req.params.id, req.body);
  return success(res, { data: result, message: `UGC submission ${req.body.status.toLowerCase()}` });
});

const listRewards = catchAsync(async (req, res) => {
  /**
   * @openapi
   * /ugc/rewards:
   *   get:
   *     tags: [UGC]
   *     summary: List UGC rewards issued through wallet ledger
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - { in: query, name: customerId, schema: { type: string, format: uuid } }
   *       - { in: query, name: page, schema: { type: integer } }
   *       - { in: query, name: limit, schema: { type: integer } }
   *     responses:
   *       200: { description: UGC rewards list }
   */
  const { page, limit } = getPagination(req.query);
  const { rows, count } = await service.listRewards(req, { ...req.query, page, limit });
  return paginated(res, { rows, count, page, limit });
});

module.exports = {
  submit,
  listSubmissions,
  getSubmission,
  verify,
  listRewards,
};
