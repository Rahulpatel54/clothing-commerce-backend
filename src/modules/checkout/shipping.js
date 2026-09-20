'use strict';

// Minimal server-side shipping calculation: flat rate, free above a threshold.
// Kept as its own module so a rate-table or carrier-API implementation can replace
// it later without touching the checkout flow.
const FLAT_RATE = 49;
const FREE_ABOVE = 999;

function calculate(subtotal) {
  return subtotal >= FREE_ABOVE ? 0 : FLAT_RATE;
}

module.exports = { calculate, FLAT_RATE, FREE_ABOVE };
