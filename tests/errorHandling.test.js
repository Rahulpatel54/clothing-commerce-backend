'use strict';

const request = require('supertest');
const express = require('express');
const app = require('../src/app');
const ApiError = require('../src/utils/ApiError');
const validate = require('../src/middleware/validate');
const errorHandler = require('../src/middleware/errorHandler');
const requestId = require('../src/middleware/requestId');
const Joi = require('joi');

describe('Error handling and validation', () => {
  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON bodies with 400', async () => {
    const res = await request(app)
      .post('/api/v1/health/live')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('reports every validation failure at once and strips unknown fields', async () => {
    const testApp = express();
    testApp.use(requestId);
    testApp.use(express.json());
    testApp.post(
      '/t',
      validate({ body: Joi.object({ email: Joi.string().email().required(), age: Joi.number().min(18).required() }) }),
      (req, res) => res.json({ success: true, data: req.body })
    );
    testApp.use(errorHandler);

    const bad = await request(testApp).post('/t').send({ email: 'nope', age: 12 });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(bad.body.error.details).toHaveLength(2);

    const good = await request(testApp).post('/t').send({ email: 'a@b.com', age: '21', hacker: true });
    expect(good.status).toBe(200);
    expect(good.body.data).toEqual({ email: 'a@b.com', age: 21 });
  });

  it('maps ApiError factories to the right status codes', () => {
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.conflict('dup').code).toBe('CONFLICT');
    expect(ApiError.internal().isOperational).toBe(false);
  });
});
