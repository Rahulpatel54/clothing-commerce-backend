'use strict';

const db = require('../../models');
const logger = require('../../config/logger');

const REDACTED_FIELDS = ['passwordHash', 'mfaSecretEncrypted', 'tokenHash', 'password'];

function scrub(state) {
  if (!state || typeof state !== 'object') return state;
  const plain = typeof state.toJSON === 'function' ? state.toJSON() : { ...state };
  REDACTED_FIELDS.forEach((f) => {
    if (f in plain) plain[f] = '[redacted]';
  });
  return plain;
}

/**
 * Writes one audit row for a privileged mutation.
 * Pass the transaction when the caller has one, so the audit row lives or dies
 * with the change it describes. Failure to audit never breaks the request.
 */
async function record(req, { action, entityType, entityId, before, after, transaction } = {}) {
  try {
    return await db.AuditLog.create(
      {
        actorUserId: req.user ? req.user.id : null,
        action,
        entityType,
        entityId: entityId != null ? String(entityId) : null,
        beforeState: scrub(before),
        afterState: scrub(after),
        ipAddress: req.ip,
        userAgent: (req.headers && req.headers['user-agent']) || null,
        requestId: req.id,
      },
      { transaction }
    );
  } catch (err) {
    logger.error({ err, action, entityType, entityId }, 'Failed to write audit log');
    return null;
  }
}

module.exports = { record, scrub };