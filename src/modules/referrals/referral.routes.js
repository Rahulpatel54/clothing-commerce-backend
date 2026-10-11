'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./referral.validation');
const controller = require('./referral.controller');

const router = express.Router();
router.use(authenticate);

router.get('/me', controller.getMyCode);
router.post('/validate', authorize('referrals:update'), validate(schema.validate), controller.validate);

module.exports = router;
