'use strict';

const db = require('../models');
const ApiError = require('./ApiError');

/**
 * Generic idempotency-key guard for POST endpoints that must not double-execute
 * (checkout, payment webhooks). Stores the key + a hash of the request body,
 * plus the response payload once the operation completes, so a retried request
 * with the same key returns the original result instead of re-running side effects.
 */
async function withIdempotency({ key, scope, requestFingerprint, transaction }, fn) {
  if (!key) return fn();

  const existing = await db.IdempotencyKey.findOne({ where: { key, scope }, transaction });
  if (existing) {
    if (existing.requestFingerprint && existing.requestFingerprint !== requestFingerprint) {
      throw ApiError.conflict('Idempotency key was already used with a different request payload');
    }
    if (existing.status === 'COMPLETED') return existing.responseBody;
    throw ApiError.conflict('A request with this idempotency key is already in progress');
  }

  const record = await db.IdempotencyKey.create(
    { key, scope, requestFingerprint, status: 'IN_PROGRESS' },
    { transaction }
  );

  const result = await fn();
  await record.update({ status: 'COMPLETED', responseBody: result }, { transaction });
  return result;
}

module.exports = { withIdempotency };
