'use strict';

const express = require('express');
const healthRoutes = require('./health/health.routes');
const authRoutes = require('./auth/auth.routes');
const userRoutes = require('./users/user.routes');
const productRoutes = require('./products/product.routes');
const categoryRoutes = require('./products/category.routes');
const collectionRoutes = require('./products/collection.routes');
const customerRoutes = require('./customers/customer.routes');
const inventoryRoutes = require('./inventory/inventory.routes');
const cartRoutes = require('./cart/cart.routes');
const checkoutRoutes = require('./checkout/checkout.routes');
const orderRoutes = require('./orders/order.routes');
const paymentRoutes = require('./payments/payment.routes');
const promotionRoutes = require('./promotions/promotion.routes');
const walletRoutes = require('./loyalty/wallet.routes');
const referralRoutes = require('./referrals/referral.routes');

const router = express.Router();

// Register one line per domain module as each phase lands.
const routes = [
  { path: '/health', router: healthRoutes },
  { path: '/auth', router: authRoutes },
  { path: '/users', router: userRoutes },
  { path: '/products', router: productRoutes },
  { path: '/categories', router: categoryRoutes },
  { path: '/collections', router: collectionRoutes },
  { path: '/customers', router: customerRoutes }, // also mounts wishlist at /customers/:id/wishlist
  { path: '/inventory', router: inventoryRoutes },
  { path: '/cart', router: cartRoutes },
  { path: '/checkout', router: checkoutRoutes },
  { path: '/orders', router: orderRoutes },
  { path: '/payments', router: paymentRoutes },
  { path: '/promotions', router: promotionRoutes },
  { path: '/loyalty', router: walletRoutes },
  { path: '/referrals', router: referralRoutes },
];

routes.forEach(({ path, router: moduleRouter }) => router.use(path, moduleRouter));

module.exports = router;
