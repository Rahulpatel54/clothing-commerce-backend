'use strict';

const express = require('express');
const healthRoutes = require('./health/health.routes');
const authRoutes = require('./auth/auth.routes');

const router = express.Router();

// Register one line per domain module as each phase lands.
const routes = [
  { path: '/health', router: healthRoutes },
  { path: '/auth', router: authRoutes },
  // { path: '/users', router: require('./users/user.routes') },
  // { path: '/products', router: require('./products/product.routes') },
];

routes.forEach(({ path, router: moduleRouter }) => router.use(path, moduleRouter));

module.exports = router;
