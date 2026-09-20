'use strict';

const db = require('../../models');

// Tax settings are stored in the `settings` table (seeded as { inclusive, defaultRate }).
// Inclusive: the listed price already contains tax, so taxAmount is only reported for
// the invoice and is not added on top. Exclusive: tax is computed on the subtotal and added.
async function calculate(subtotal) {
  let settings = { inclusive: true, defaultRate: 5 };
  try {
    const row = await db.Setting.findOne({ where: { key: 'tax' } });
    if (row && row.value) settings = { ...settings, ...row.value };
  } catch (err) { /* settings table optional in isolated tests */ }

  const rate = Number(settings.defaultRate) || 0;
  if (settings.inclusive) {
    const taxAmount = subtotal - subtotal / (1 + rate / 100);
    return { taxAmount: Number(taxAmount.toFixed(2)), addOn: 0, inclusive: true, rate };
  }
  const addOn = Number(((subtotal * rate) / 100).toFixed(2));
  return { taxAmount: addOn, addOn, inclusive: false, rate };
}

module.exports = { calculate };
