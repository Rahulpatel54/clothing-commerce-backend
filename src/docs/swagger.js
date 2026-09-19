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
      description: 'Commerce, operations and business management backend. Documentation is generated from JSDoc annotations on route files.',
    },
    servers: [{ url: `http://localhost:${config.port}${config.apiPrefix}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'OK' },
            data: { nullable: true },
            requestId: { type: 'string', format: 'uuid' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
            requestId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responses: {
        BadRequest: { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        Unauthorized: { description: 'Missing or invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        Forbidden: { description: 'Insufficient permissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        NotFound: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        ValidationError: { description: 'Request validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
      },
    },
    tags: [{ name: 'Health', description: 'Liveness and readiness probes' }],
  },
  apis: [path.join(__dirname, '..', 'modules', '**', '*.routes.js')],
});

function mountSwagger(app) {
  app.get('/docs.json', (req, res) => res.json(spec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Commerce API Docs' }));
}

module.exports = { spec, mountSwagger };
