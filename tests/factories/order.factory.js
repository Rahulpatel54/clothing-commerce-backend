'use strict';

const crypto = require('crypto');
const { buildCustomer } = require('./customer.factory');

function buildOrder(overrides = {}) {
  const id = overrides.id || crypto.randomUUID();
  const customer = overrides.customer || buildCustomer();
  const orderNumber = overrides.orderNumber || `ORD${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`.slice(0, 20);

  return {
    id,
    orderNumber,
    customerId: overrides.customerId || customer.id,
    customer,
    status: overrides.status || 'CONFIRMED',
    paymentStatus: overrides.paymentStatus || 'PAID',
    subtotal: overrides.subtotal || '100.00',
    shippingAmount: overrides.shippingAmount || '10.00',
    taxAmount: overrides.taxAmount || '5.00',
    discountAmount: overrides.discountAmount || '0.00',
    totalAmount: overrides.totalAmount || '115.00',
    shippingAddress: overrides.shippingAddress || {
      street: '123 Main St',
      city: 'Metropolis',
      state: 'NY',
      zip: '10001',
      country: 'US',
    },
    items: overrides.items || [
      {
        id: crypto.randomUUID(),
        orderId: id,
        variantId: crypto.randomUUID(),
        quantity: 2,
        unitPrice: '50.00',
        totalPrice: '100.00',
        costPrice: '20.00',
      },
    ],
    placedAt: overrides.placedAt || new Date(),
    toJSON: function () {
      return { ...this };
    },
    ...overrides,
  };
}

module.exports = { buildOrder };
