'use strict';

const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(4000),
  API_PREFIX: Joi.string().default('/api/v1'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_SSL: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().default(10),
  DB_POOL_MIN: Joi.number().default(0),

  JWT_ACCESS_SECRET: Joi.string().default('change-me-access'),
  JWT_REFRESH_SECRET: Joi.string().default('change-me-refresh'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  BCRYPT_ROUNDS: Joi.number().default(12),
  AUTH_MAX_FAILED_ATTEMPTS: Joi.number().default(5),
  AUTH_LOCK_MINUTES: Joi.number().default(15),
  PASSWORD_RESET_EXPIRES_MINUTES: Joi.number().default(30),

  REDIS_ENABLED: Joi.boolean().default(false),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  CORS_ORIGINS: Joi.string().default('*'),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: Joi.number().default(300),
  LOG_LEVEL: Joi.string().default('info'),

  SEED_ADMIN_EMAIL: Joi.string().email().default('admin@example.com'),
  SEED_ADMIN_PASSWORD: Joi.string().default('ChangeMe123!'),
}).unknown();

const { value: env, error } = schema.validate(process.env, { abortEarly: false });
if (error) {
  throw new Error(`Invalid environment configuration: ${error.message}`);
}

module.exports = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    name: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
    logging: env.DB_LOGGING,
    pool: { max: env.DB_POOL_MAX, min: env.DB_POOL_MIN, acquire: 30000, idle: 10000 },
  },
  auth: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    bcryptRounds: env.BCRYPT_ROUNDS,
    maxFailedAttempts: env.AUTH_MAX_FAILED_ATTEMPTS,
    lockMinutes: env.AUTH_LOCK_MINUTES,
    passwordResetExpiresMinutes: env.PASSWORD_RESET_EXPIRES_MINUTES,
  },
  redis: { enabled: env.REDIS_ENABLED, url: env.REDIS_URL },
  security: {
    corsOrigins: env.CORS_ORIGINS === '*' ? '*' : env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    rateLimit: { windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX },
  },
  logLevel: env.LOG_LEVEL,
  seed: { adminEmail: env.SEED_ADMIN_EMAIL, adminPassword: env.SEED_ADMIN_PASSWORD },
};
