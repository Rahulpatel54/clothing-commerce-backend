'use strict';

const express = require('express');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const schema = require('./ugc.validation');
const controller = require('./ugc.controller');

const router = express.Router();
router.use(authenticate);

router.use(async (req, res, next) => {
  try {
    // eslint-disable-next-line global-require
    const customerRepo = require('../customers/customer.repository');
    const customer = await customerRepo.findByUserId(req.user.id);
    req.customerId = customer ? customer.id : null;
    next();
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(schema.submit), controller.submit);
router.get('/rewards', validate(schema.listRewards), controller.listRewards);
router.get('/', validate(schema.listSubmissions), controller.listSubmissions);
router.get('/:id', validate(schema.byId), controller.getSubmission);
router.patch('/:id/verify', authorize('ugc:update'), validate(schema.verify), controller.verify);

module.exports = router;
