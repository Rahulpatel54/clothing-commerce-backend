'use strict';

const crypto = require('crypto');
const { buildUser } = require('./user.factory');

function buildCustomer(overrides = {}) {
  const id = overrides.id || crypto.randomUUID();
  const user = overrides.user || buildUser();
  return {
    id,
    userId: overrides.userId || user.id,
    user,
    marketingEmail: overrides.marketingEmail !== undefined ? overrides.marketingEmail : true,
    marketingSms: overrides.marketingSms !== undefined ? overrides.marketingSms : true,
    marketingWhatsapp: overrides.marketingWhatsapp !== undefined ? overrides.marketingWhatsapp : false,
    totalSpend: overrides.totalSpend || '0.00',
    orderCount: overrides.orderCount || 0,
    tags: overrides.tags || ['regular'],
    addresses: overrides.addresses || [],
    toJSON: function () {
      return { ...this };
    },
    ...overrides,
  };
}

module.exports = { buildCustomer };
