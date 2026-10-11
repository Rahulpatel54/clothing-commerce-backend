'use strict';

const express = require('express');
const controller = require('./health.controller');

const router = express.Router();

// Swagger docs for these routes live in health.controller.js, right inside each
// handler — that's the single source of truth the /docs page is generated from.
router.get('/live', controller.live);
router.get('/ready', controller.ready);

module.exports = router;
