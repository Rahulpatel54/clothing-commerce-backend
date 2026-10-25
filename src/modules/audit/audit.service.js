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

async function record(req, { action, entityType, entity, entityId, before, after, details, transaction } = {}) {
  try {
    const resolvedEntityType = entityType || entity || 'Unknown';
    const resolvedAfter = after !== undefined ? after : details;
    return await db.AuditLog.create(
      {
        actorUserId: req.user ? req.user.id : null,
        action,
        entityType: resolvedEntityType,
        entityId: entityId != null ? String(entityId) : null,
        beforeState: scrub(before),
        afterState: scrub(resolvedAfter),
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
