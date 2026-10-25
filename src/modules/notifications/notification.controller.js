'use strict';

const catchAsync = require('../../utils/catchAsync');
const { success, paginated } = require('../../utils/apiResponse');
const service = require('./notification.service');

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: List notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, SENT, FAILED, CANCELLED] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: channel
 *         schema: { type: string, enum: [EMAIL, SMS, WHATSAPP, PUSH] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
const list = catchAsync(async (req, res) => {
  const result = await service.listNotifications(req, req.query);
  return paginated(res, {
    rows: result.items,
    count: result.total,
    page: result.page,
    limit: result.limit,
  });
});

/**
 * @openapi
 * /notifications/{id}:
 *   get:
 *     summary: Get notification details by ID
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
const getById = catchAsync(async (req, res) => {
  const result = await service.getNotificationById(req, req.params.id);
  return success(res, { data: result });
});

/**
 * @openapi
 * /notifications:
 *   post:
 *     summary: Send or enqueue a manual notification (Admin / System)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, channel, title, body]
 *             properties:
 *               customerId: { type: string, format: uuid }
 *               type: { type: string }
 *               channel: { type: string, enum: [EMAIL, SMS, WHATSAPP, PUSH] }
 *               recipient: { type: string }
 *               title: { type: string }
 *               body: { type: string }
 *               metadata: { type: object }
 *               force: { type: boolean }
 *     responses:
 *       201:
 *         description: Notification sent / recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
const send = catchAsync(async (req, res) => {
  const result = await service.sendNotification(req.body);
  return success(res, { data: result, message: 'Notification processed', statusCode: 201 });
});

/**
 * @openapi
 * /notifications/{id}/retry:
 *   post:
 *     summary: Retry a failed notification delivery (Admin)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification retried successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
const retry = catchAsync(async (req, res) => {
  const result = await service.retryNotification(req, req.params.id);
  return success(res, { data: result, message: 'Notification retried' });
});

module.exports = {
  list,
  getById,
  send,
  retry,
};
