'use strict';

// Single source of truth for the order lifecycle. Every transition anywhere in the
// codebase goes through this table so an invalid jump is rejected the same way everywhere.
const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURN_APPROVED'],
  RETURN_APPROVED: ['RETURNED'],
  RETURNED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

module.exports = { TRANSITIONS, canTransition };
