'use strict';

jest.mock('../src/modules/products/product.repository');
jest.mock('../src/modules/cart/cart.repository');
jest.mock('../src/modules/auth/auth.repository');

const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config');
const { validateImageUpload, detectImageType } = require('../src/utils/fileUploadValidator');
const { scrub } = require('../src/modules/audit/audit.service');
const productRepo = require('../src/modules/products/product.repository');

describe('OWASP Top 10 & Node.js Security Hardening Test Suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OWASP A01: Broken Access Control & IDOR', () => {
    it('rejects path traversal attempts on API endpoints without filesystem escape', async () => {
      productRepo.findBySlug.mockResolvedValue(null);
      const res = await request(app).get('/api/v1/products/../../../../etc/passwd');
      expect([400, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('rejects URL-encoded path traversal characters', async () => {
      productRepo.findBySlug.mockResolvedValue(null);
      const res = await request(app).get('/api/v1/products/%2e%2e%2f%2e%2e%2fetc%2fpasswd');
      expect([400, 404]).toContain(res.status);
    });

    it('blocks unauthenticated access to privileged administrative endpoints', async () => {
      const endpoints = [
        ['GET', '/api/v1/users'],
        ['POST', '/api/v1/users'],
        ['GET', '/api/v1/finance/pnl'],
        ['POST', '/api/v1/expenses'],
        ['POST', '/api/v1/marketing/campaigns'],
        ['GET', '/api/v1/notifications'],
      ];

      for (const [method, path] of endpoints) {
        const req = method === 'GET' ? request(app).get(path) : request(app).post(path);
        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      }
    });
  });

  describe('OWASP A02: Cryptographic Failures & Sensitive Data Scrubbing', () => {
    it('detects tampering in AES-256-GCM ciphertext and refuses decryption (AEAD integrity)', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let ciphertext = cipher.update('Confidential data', 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Tampered ciphertext (flip last character)
      const tamperedCiphertext = ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'a' ? 'b' : 'a');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      expect(() => {
        decipher.update(tamperedCiphertext, 'hex', 'utf8');
        decipher.final('utf8');
      }).toThrow();
    });

    it('detects tampering in Auth Tag and refuses decryption', () => {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let ciphertext = cipher.update('Integrity Guard', 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      const tamperedTag = crypto.randomBytes(16); // corrupted tag
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tamperedTag);
      expect(() => {
        decipher.update(ciphertext, 'hex', 'utf8');
        decipher.final('utf8');
      }).toThrow();
    });

    it('scrubs sensitive credentials from audit log before/after states', () => {
      const rawState = {
        id: 'u123',
        email: 'user@example.com',
        password: 'PlainTextPassword123!',
        passwordHash: '$2b$12$eX4mPl3H4sh...',
        tokenHash: 'abc123tokenhash',
        mfaSecretEncrypted: 'v1:abcd:1234:5678',
        firstName: 'Alice',
      };

      const scrubbed = scrub(rawState);
      expect(scrubbed.password).toBe('[redacted]');
      expect(scrubbed.passwordHash).toBe('[redacted]');
      expect(scrubbed.tokenHash).toBe('[redacted]');
      expect(scrubbed.mfaSecretEncrypted).toBe('[redacted]');
      expect(scrubbed.email).toBe('user@example.com');
      expect(scrubbed.firstName).toBe('Alice');
    });
  });

  describe('OWASP A03: Injection & Parameter Sanitization', () => {
    it('safely handles SQL injection attempts in search queries without DB errors', async () => {
      productRepo.search.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20 });
      const injectionPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE products; --",
        "' UNION SELECT NULL, NULL, NULL --",
        "admin'--",
      ];

      for (const payload of injectionPayloads) {
        const res = await request(app).get(`/api/v1/products?search=${encodeURIComponent(payload)}`);
        expect([200, 422]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body.success).toBe(true);
        }
      }
    });

    it('rejects invalid sort parameters preventing SQL clause injection', async () => {
      const res = await request(app).get('/api/v1/products?sort=price;DROP+TABLE+users;--');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('prevents NoSQL/Object operator injection in query params', async () => {
      const res = await request(app).get('/api/v1/products?categoryId[$ne]=null');
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('OWASP A04: Insecure Design & Business Logic Validation', () => {
    it('rejects negative quantity when adding items to cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('x-session-id', 'security-test-session')
        .send({
          variantId: '550e8400-e29b-41d4-a716-446655440000',
          quantity: -5,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects decimal/fractional quantity when adding items to cart', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('x-session-id', 'security-test-session')
        .send({
          variantId: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 2.5,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-numeric string quantity in cart payload', async () => {
      const res = await request(app)
        .post('/api/v1/cart/items')
        .set('x-session-id', 'security-test-session')
        .send({
          variantId: '550e8400-e29b-41d4-a716-446655440000',
          quantity: 'ten',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('OWASP A05: Security Misconfiguration & HTTP Response Headers', () => {
    it('sets critical Helmet security headers on all responses', async () => {
      const res = await request(app).get('/api/v1/health/live');
      expect(res.status).toBe(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-download-options']).toBe('noopen');
    });

    it('removes x-powered-by header to conceal Express runtime fingerprint', async () => {
      const res = await request(app).get('/api/v1/health/live');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('returns standardized 404 JSON for non-existent routes without leaking server info', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint-xyz');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('OWASP A07: Authentication & Token Security', () => {
    it('rejects tokens forged with alg: none', async () => {
      const forged = [
        Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
        Buffer.from(JSON.stringify({ sub: 'user-admin', type: 'access', roles: ['admin'] })).toString('base64url'),
        '',
      ].join('.');

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects expired JWT access tokens', async () => {
      const expiredPayload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        type: 'access',
        roles: ['customer'],
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      const expiredToken = jwt.sign(expiredPayload, config.auth.accessSecret);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(['TOKEN_EXPIRED', 'UNAUTHENTICATED']).toContain(res.body.error.code);
    });

    it('rejects tokens signed with invalid secret signature', async () => {
      const fakeToken = jwt.sign(
        { sub: '550e8400-e29b-41d4-a716-446655440000', type: 'access', roles: ['admin'] },
        'wrong-secret-key-that-does-not-match'
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('OWASP A08: Software & Data Integrity (File Upload Security)', () => {
    it('rejects executable scripts disguised with image extensions (polyglot / script upload)', () => {
      const phpScript = Buffer.from('<?php echo system($_GET["cmd"]); ?>');
      expect(() => validateImageUpload(phpScript)).toThrow(/Invalid file format/i);
    });

    it('rejects Windows PE executable files (MZ magic bytes) disguised as PNG', () => {
      const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
      expect(() => validateImageUpload(exeBuffer)).toThrow(/Invalid file format/i);
    });

    it('rejects Linux ELF binary files disguised as WebP', () => {
      const elfBuffer = Buffer.from('\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00');
      expect(() => validateImageUpload(elfBuffer)).toThrow(/Invalid file format/i);
    });

    it('accepts legitimate JPEG image buffer with valid magic bytes (FF D8 FF)', () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const result = validateImageUpload(validJpeg);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('accepts legitimate PNG image buffer with valid magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const result = validateImageUpload(validPng);
      expect(result.valid).toBe(true);
      expect(result.mimeType).toBe('image/png');
    });
  });

  describe('Node.js Specific Security Hardening', () => {
    it('prevents prototype pollution via __proto__ in request payloads', async () => {
      const pollutedPayload = JSON.parse('{"__proto__": {"polluted": true}, "name": "Test Category"}');

      await request(app)
        .post('/api/v1/categories')
        .send(pollutedPayload);

      expect(({})['polluted']).toBeUndefined();
      expect(Object.prototype['polluted']).toBeUndefined();
    });

    it('prevents prototype pollution via constructor.prototype in request payloads', async () => {
      const pollutedPayload = JSON.parse('{"constructor": {"prototype": {"adminExploit": true}}}');

      await request(app)
        .post('/api/v1/categories')
        .send(pollutedPayload);

      expect(({})['adminExploit']).toBeUndefined();
      expect(Object.prototype['adminExploit']).toBeUndefined();
    });

    it('rejects request bodies exceeding 1MB limit with 413 Payload Too Large', async () => {
      const largeData = 'x'.repeat(1024 * 1024 + 100);
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'large@example.com', password: 'Password123!', data: largeData });

      expect(res.status).toBe(413);
    });

    it('safely handles malformed JSON without crashing the Node.js event loop', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ "email": "broken-json, missing-closing-bracket');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
