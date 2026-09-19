'use strict';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'clothing_commerce_test';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

process.env.BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS || '4';
process.env.AUTH_MAX_FAILED_ATTEMPTS = process.env.AUTH_MAX_FAILED_ATTEMPTS || '3';

jest.setTimeout(20000);
