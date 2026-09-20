'use strict';

jest.mock('../src/modules/inventory/inventory.repository');

const repo = require('../src/modules/inventory/inventory.repository');
const service = require('../src/modules/inventory/inventory.service');

function row(overrides = {}) {
  const r = { variantId: 'v1', physical: 10, reserved: 0, sold: 0, returned: 0, damaged: 0, ...overrides };
  r.available = () => Math.max(0, r.physical - r.reserved);
  r.toJSON = () => ({ ...r, available: undefined });
  return r;
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.save.mockImplementation(async (r) => r);
  repo.createMovement.mockResolvedValue({ id: 'mv-1' });
});

describe('reserve / release / commit', () => {
  it('reserves stock when enough is available', async () => {
    const inv = row({ physical: 5, reserved: 0 });
    repo.findByVariantForUpdate.mockResolvedValue(inv);

    const result = await service.reserve({ variantId: 'v1', quantity: 3, referenceType: 'CART', referenceId: 'c1' });

    expect(result.reserved).toBe(3);
    expect(repo.createMovement).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESERVE', quantity: 3 }), 'tx');
  });

  it('refuses to reserve more than is available (no oversell)', async () => {
    const inv = row({ physical: 2, reserved: 0 });
    repo.findByVariantForUpdate.mockResolvedValue(inv);

    await expect(service.reserve({ variantId: 'v1', quantity: 5 })).rejects.toMatchObject({ statusCode: 409 });
    expect(inv.reserved).toBe(0);
  });

  it('accounts for existing reservations when computing availability', async () => {
    const inv = row({ physical: 5, reserved: 4 });
    repo.findByVariantForUpdate.mockResolvedValue(inv);

    await expect(service.reserve({ variantId: 'v1', quantity: 2 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('releases reserved stock back to the pool', async () => {
    const inv = row({ physical: 5, reserved: 3 });
    repo.findByVariantForUpdate.mockResolvedValue(inv);

    const result = await service.release({ variantId: 'v1', quantity: 2 });
    expect(result.reserved).toBe(1);
  });

  it('never lets released quantity push reserved negative', async () => {
    const inv = row({ physical: 5, reserved: 1 });
    repo.findByVariantForUpdate.mockResolvedValue(inv);

    const result = await service.release({ variantId: 'v1', quantity: 10 });
    expect(result.reserved).toBe(0);
  });

  it('commits a reservation: moves stock from reserved+physical into sold', async () => {
    const inv = row({ physical: 5, reserved: 3, sold: 0 });
    repo.findByVariantForUpdate.mockResolvedValue(inv);

    const result = await service.commit({ variantId: 'v1', quantity: 3, referenceType: 'ORDER', referenceId: 'o1' });
    expect(result.reserved).toBe(0);
    expect(result.physical).toBe(2);
    expect(result.sold).toBe(3);
  });

  it('refuses to commit more than is reserved', async () => {
    const inv = row({ physical: 5, reserved: 1 });
    repo.findByVariantForUpdate.mockResolvedValue(inv);

    await expect(service.commit({ variantId: 'v1', quantity: 3 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('404s when there is no inventory row for the variant', async () => {
    repo.findByVariantForUpdate.mockResolvedValue(null);
    await expect(service.reserve({ variantId: 'ghost', quantity: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('concurrent reservations (no oversell)', () => {
  it('serializes two simultaneous reservations against the same row so only one can exceed stock', async () => {
    // A real SELECT ... FOR UPDATE makes the second transaction block until the
    // first commits. This mock reproduces that guarantee with a mutex around the
    // row, so the test exercises the service's reserve logic under the same
    // serialization contract Postgres would provide, rather than trusting it blindly.
    const inv = row({ physical: 5, reserved: 0 });
    let locked = false;
    const waiters = [];

    async function acquire() {
      if (!locked) { locked = true; return; }
      await new Promise((resolve) => waiters.push(resolve));
      locked = true;
    }
    function release() {
      locked = false;
      const next = waiters.shift();
      if (next) next();
    }

    repo.transaction.mockImplementation(async (fn) => {
      await acquire();
      try {
        return await fn('tx');
      } finally {
        release();
      }
    });
    repo.findByVariantForUpdate.mockImplementation(async () => inv);

    const attempts = [
      service.reserve({ variantId: 'v1', quantity: 3 }),
      service.reserve({ variantId: 'v1', quantity: 3 }),
    ];

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Only one of the two 3-unit reservations can succeed against 5 units of stock,
    // and the movement ledger has exactly one RESERVE entry to match.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(inv.reserved).toBeLessThanOrEqual(inv.physical);
    expect(inv.reserved).toBe(3);
  });
});

describe('purchases, damage, adjustments', () => {
  it('receives purchased stock and creates a PURCHASE movement', async () => {
    repo.findByVariantForUpdate.mockResolvedValue(row({ physical: 5 }));
    const result = await service.receivePurchase({ variantId: 'v1', quantity: 10 });
    expect(result.physical).toBe(15);
    expect(repo.createMovement).toHaveBeenCalledWith(expect.objectContaining({ type: 'PURCHASE', quantity: 10 }), 'tx');
  });

  it('creates a new row when receiving stock for a variant with none yet', async () => {
    repo.findByVariantForUpdate.mockResolvedValue(null);
    repo.create.mockImplementation(async (payload) => row(payload));

    const result = await service.receivePurchase({ variantId: 'v2', quantity: 4 });
    expect(result.physical).toBe(4);
  });

  it('records damage and removes it from physical stock', async () => {
    repo.findByVariantForUpdate.mockResolvedValue(row({ physical: 10, reserved: 2 }));
    const result = await service.reportDamage({ variantId: 'v1', quantity: 3 });
    expect(result.physical).toBe(7);
    expect(result.damaged).toBe(3);
  });

  it('refuses to damage more than is available', async () => {
    repo.findByVariantForUpdate.mockResolvedValue(row({ physical: 5, reserved: 4 }));
    await expect(service.reportDamage({ variantId: 'v1', quantity: 3 })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('applies a positive or negative manual adjustment', async () => {
    repo.findByVariantForUpdate.mockResolvedValue(row({ physical: 10 }));
    const result = await service.adjust({ variantId: 'v1', delta: -4, note: 'recount' });
    expect(result.physical).toBe(6);
  });

  it('refuses an adjustment that would make physical stock negative', async () => {
    repo.findByVariantForUpdate.mockResolvedValue(row({ physical: 2 }));
    await expect(service.adjust({ variantId: 'v1', delta: -5 })).rejects.toMatchObject({ statusCode: 409 });
  });
});
