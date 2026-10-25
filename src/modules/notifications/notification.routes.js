'use strict';

const express = require('express');
const controller = require('./notification.controller');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { sendNotificationSchema, listNotificationsSchema } = require('./notification.validation');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(listNotificationsSchema, 'query'), controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize('admin', 'staff'), validate(sendNotificationSchema, 'body'), controller.send);
router.post('/:id/retry', authorize('admin'), controller.retry);

module.exports = router;
