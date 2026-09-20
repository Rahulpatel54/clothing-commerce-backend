'use strict';

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

async function uniqueSlug(value, exists, { ignoreId } = {}) {
  const base = slugify(value) || 'item';
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await exists(candidate, ignoreId)) {
    candidate = `${base}-${n}`;
    n += 1;
    if (n > 500) throw new Error('Could not generate a unique slug');
  }
  return candidate;
}

module.exports = { slugify, uniqueSlug };
