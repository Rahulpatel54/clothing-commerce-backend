'use strict';

const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('../config');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Clothing Commerce & Business Management API',
      version: require('../../package.json').version,
      description: 'Commerce, operations and business management backend. Documentation is generated from JSDoc annotations inside each controller handler.',
    },
    servers: [{ url: `http://localhost:${config.port}${config.apiPrefix}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste your JWT access token here (quotes and "Bearer " prefix are stripped automatically).',
        },
      },
      schemas: {
        SuccessResponse: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: 'OK' }, data: { nullable: true }, requestId: { type: 'string', format: 'uuid' } } },
        ErrorResponse: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string', example: 'VALIDATION_ERROR' }, message: { type: 'string' }, details: { type: 'array', items: { type: 'object' } } } }, requestId: { type: 'string', format: 'uuid' } } },
      },
      responses: {
        BadRequest: { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        Unauthorized: { description: 'Missing or invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        Forbidden: { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        NotFound: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        ValidationError: { description: 'Request validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      },
    },
    tags: [
      { name: 'Health', description: 'Liveness and readiness probes' },
      { name: 'Auth', description: 'Registration, login, token rotation and password reset' },
      { name: 'Users', description: 'Admin user management, roles and status' },
      { name: 'Customers', description: 'Customer profiles, addresses and marketing preferences' },
      { name: 'Catalog', description: 'Admin catalog management: products, variants, categories, collections' },
      { name: 'Discovery', description: 'Public product search, filters and recommendations' },
      { name: 'Wishlist', description: 'Customer wishlists' },
      { name: 'Inventory', description: 'Stock levels and movements' },
      { name: 'Cart', description: 'Guest and customer shopping carts' },
      { name: 'Promotions', description: 'Coupons and the promotion rule engine' },
      { name: 'Checkout', description: 'Checkout and order placement' },
      { name: 'Orders', description: 'Order lifecycle' },
      { name: 'Payments', description: 'Payments and refunds' },
      { name: 'Loyalty', description: 'Wallet ledger' },
      { name: 'Referrals', description: 'Referral program' },
      { name: 'Reviews', description: 'Product reviews, ratings and moderation' },
      { name: 'UGC', description: 'User-generated content submissions and rewards' },
      { name: 'Expenses', description: 'Operational expense tracking and categories' },
      { name: 'Finance', description: 'Financial statements, P&L reports and period closing' },
      { name: 'Marketing', description: 'Campaign tracking, UTM attribution and conversion events' },
      { name: 'Analytics', description: 'Indexed aggregated commerce metrics (Sales, Customers, Products, Marketing, Operations)' },
      { name: 'Notifications', description: 'Multi-channel notifications and customer delivery status' },
    ],
  },
  // Every @openapi block lives inside its controller function, right after the
  // opening line of the handler — not in the route file. This is the single
  // source of truth /docs is generated from; see DEVELOPER_GUIDE.md.
  apis: [path.join(__dirname, '..', 'modules', '**', '*.controller.js').replace(/\\/g, '/')],
});

function mountSwagger(app) {
  app.get('/docs.json', (req, res) => res.json(spec));
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Commerce API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
    })
  );
}

module.exports = { spec, mountSwagger };
