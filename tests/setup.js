'use strict';

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME || 'clothing_commerce_test';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

jest.setTimeout(20000);
