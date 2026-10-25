'use strict';

const crypto = require('crypto');
const db = require('../models');
const ApiError = require('./ApiError');

const IN_PROGRESS_LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function normalizeFingerprint(fp) {
  if (!fp) return null;
  if (typeof fp === 'string' && fp.length === 64 && /^[0-9a-fA-F]{64}$/.test(fp)) {
    return fp;
  }
  return crypto.createHash('sha256').update(typeof fp === 'string' ? fp : JSON.stringify(fp)).digest('hex');
}

/**
 * Generic idempotency-key guard for POST endpoints that must not double-execute
 * (checkout, payment webhooks). Stores the key + a hash of the request body,
 * plus the response payload once the operation completes, so a retried request
 * with the same key returns the original result instead of re-running side effects.
 */
async function withIdempotency({ key, scope, requestFingerprint, transaction }, fn) {
  if (!key) return fn();

  const fp = normalizeFingerprint(requestFingerprint);

  const existing = await db.IdempotencyKey.findOne({ where: { key, scope }, transaction });
  if (existing) {
    if (existing.requestFingerprint && existing.requestFingerprint !== fp) {
      throw ApiError.conflict('Idempotency key was already used with a different request payload');
    }
    if (existing.status === 'COMPLETED') return existing.responseBody;

    const isStale = existing.createdAt && (Date.now() - new Date(existing.createdAt).getTime() > IN_PROGRESS_LOCK_TIMEOUT_MS);
    if (!isStale) {
      throw ApiError.conflict('A request with this idempotency key is already in progress');
    }

    await existing.update({ status: 'IN_PROGRESS', requestFingerprint: fp }, { transaction });
    try {
      const result = await fn();
      await existing.update({ status: 'COMPLETED', responseBody: result }, { transaction });
      return result;
    } catch (err) {
      await existing.destroy({ transaction }).catch(() => {});
      throw err;
    }
  }

  const record = await db.IdempotencyKey.create(
    { key, scope, requestFingerprint: fp, status: 'IN_PROGRESS' },
    { transaction }
  );

  try {
    const result = await fn();
    await record.update({ status: 'COMPLETED', responseBody: result }, { transaction });
    return result;
  } catch (err) {
    await record.destroy({ transaction }).catch(() => {});
    throw err;
  }
}

module.exports = { withIdempotency };
