'use strict';

const express = require('express');
const controller = require('./health.controller');

const router = express.Router();

/**
 * @openapi
 * /health/live:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     responses:
 *       200:
 *         description: Service process is running
 */
router.get('/live', controller.live);

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe (checks database and optional dependencies)
 *     responses:
 *       200: { description: All dependencies reachable }
 *       503: { description: One or more dependencies are down }
 */
router.get('/ready', controller.ready);

module.exports = router;
