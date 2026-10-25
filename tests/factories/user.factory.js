'use strict';

const crypto = require('crypto');

function buildUser(overrides = {}) {
  const id = overrides.id || crypto.randomUUID();
  const email = overrides.email || `user-${id.slice(0, 8)}@example.com`;
  return {
    id,
    email,
    phone: overrides.phone || `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
    firstName: overrides.firstName || 'Jane',
    lastName: overrides.lastName || 'Doe',
    status: overrides.status || 'ACTIVE',
    mfaEnabled: overrides.mfaEnabled || false,
    mfaSecretEncrypted: overrides.mfaSecretEncrypted || null,
    roles: overrides.roles || [{ name: 'customer' }],
    toJSON: function () {
      return { ...this };
    },
    ...overrides,
  };
}

module.exports = { buildUser };
