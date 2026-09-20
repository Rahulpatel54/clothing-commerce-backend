'use strict';

const request = require('supertest');
const app = require('../src/app');

describe('Health module', () => {
  it('returns a live status in the standard envelope', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: 'ok' } });
    expect(res.body.requestId).toBeDefined();
  });

  it('echoes a caller-supplied request id', async () => {
    const res = await request(app).get('/api/v1/health/live').set('x-request-id', 'test-request-id');
    expect(res.headers['x-request-id']).toBe('test-request-id');
    expect(res.body.requestId).toBe('test-request-id');
  });
});
