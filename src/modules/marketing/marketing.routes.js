'use strict';

const express = require('express');
const authenticate = require('../../middleware/authenticate');
const { optionalAuthenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const schema = require('./marketing.validation');
const controller = require('./marketing.controller');

const router = express.Router();

// Campaign Management (Staff)
router.post('/campaigns', authenticate, authorize('marketing:create'), validate(schema.createCampaign), controller.createCampaign);
router.get('/campaigns', authenticate, authorize('marketing:read'), validate(schema.listCampaigns), controller.listCampaigns);
router.get('/campaigns/:id', authenticate, authorize('marketing:read'), validate(schema.getCampaign), controller.getCampaign);
router.patch('/campaigns/:id', authenticate, authorize('marketing:update'), validate(schema.updateCampaign), controller.updateCampaign);
router.delete('/campaigns/:id', authenticate, authorize('marketing:delete'), validate(schema.deleteCampaign), controller.deleteCampaign);

// Event Ingestion (Public / Tracked)
router.post('/events', optionalAuthenticate, validate(schema.trackEvent), controller.trackEvent);

module.exports = router;
