'use strict';

jest.mock('../src/modules/products/product.repository');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/products/product.repository');
const service = require('../src/modules/products/product.service');
const { slugify, uniqueSlug } = require('../src/utils/slugify');

const REQ = { user: { id: 'admin-1', roles: ['admin'] }, headers: {}, ip: '127.0.0.1', id: 'req-1' };

function product(overrides = {}) {
  const row = {
    id: 'prod-1',
    name: 'Heavyweight Oversized Tee',
    slug: 'heavyweight-oversized-tee',
    sku: 'TEE-001',
    price: '1499.00',
    costPrice: '450.00',
    compareAtPrice: '1999.00',
    status: 'ACTIVE',
    categoryId: 'cat-1',
    tags: ['tee', 'oversized'],
    publishedAt: new Date('2026-01-01'),
    variants: [
      { id: 'v1', sku: 'TEE-001-M-BLK', size: 'M', color: 'Black', price: null, costPrice: '450.00' },
      { id: 'v2', sku: 'TEE-001-L-BLK', size: 'L', color: 'Black', price: '1599.00', costPrice: '460.00' },
    ],
    ...overrides,
  };
  row.toJSON = () => JSON.parse(JSON.stringify({ ...row, toJSON: undefined, toPublicJSON: undefined }));
  row.toPublicJSON = () => {
    const json = row.toJSON();
    delete json.costPrice;
    json.variants = (json.variants || []).map((v) => {
      const copy = { ...v };
      delete copy.costPrice;
      return copy;
    });
    return json;
  };
  return row;
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
});

describe('slug generation', () => {
  it('normalises a product name into a slug', () => {
    expect(slugify('  Heavyweight  Oversized Tee — 240 GSM! ')).toBe('heavyweight-oversized-tee-240-gsm');
  });

  it('appends a counter until the slug is free', async () => {
    const taken = new Set(['summer-drop', 'summer-drop-2']);
    await expect(uniqueSlug('Summer Drop', async (s) => taken.has(s))).resolves.toBe('summer-drop-3');
  });
});

describe('price presentation', () => {
  it('resolves variant price from the override, falling back to the parent', () => {
    const result = service.present(product());

    expect(result.variants[0].effectivePrice).toBe(1499); // inherits
    expect(result.variants[1].effectivePrice).toBe(1599); // override
  });

  it('never exposes cost price on the public shape', () => {
    const result = service.present(product());

    expect(result.costPrice).toBeUndefined();
    expect(result.variants.every((v) => v.costPrice === undefined)).toBe(true);
  });

  it('keeps cost price for staff reads', () => {
    const result = service.present(product(), { includeCost: true });

    expect(result.costPrice).toBe('450.00');
  });
});

describe('create', () => {
  beforeEach(() => {
    repo.skuExists.mockResolvedValue(false);
    repo.variantSkuExists.mockResolvedValue(false);
    repo.slugExists.mockResolvedValue(false);
    repo.create.mockImplementation(async (payload) => ({ id: 'prod-new', ...payload }));
    repo.createVariant.mockResolvedValue({ id: 'v-new' });
    repo.findById.mockResolvedValue(product({ id: 'prod-new' }));
  });

  it('generates the slug and stamps publishedAt when created live', async () => {
    await service.create(REQ, { name: 'New Drop Hoodie', sku: 'HOOD-01', price: 2999, status: 'ACTIVE' });

    const written = repo.create.mock.calls[0][0];
    expect(written.slug).toBe('new-drop-hoodie');
    expect(written.publishedAt).toBeInstanceOf(Date);
  });

  it('leaves publishedAt null for a draft', async () => {
    await service.create(REQ, { name: 'Draft Hoodie', sku: 'HOOD-02', price: 2999, status: 'DRAFT' });

    expect(repo.create.mock.calls[0][0].publishedAt).toBeNull();
  });

  it('rejects a duplicate product SKU with 409', async () => {
    repo.skuExists.mockResolvedValue(true);

    await expect(service.create(REQ, { name: 'Dup', sku: 'TEE-001', price: 100 })).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate variant SKU and rolls the transaction back', async () => {
    repo.variantSkuExists.mockResolvedValue(true);

    await expect(
      service.create(REQ, {
        name: 'Tee',
        sku: 'TEE-777',
        price: 100,
        variants: [{ sku: 'TEE-001-M-BLK', size: 'M', color: 'Black' }],
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects unknown collection ids', async () => {
    repo.findCollectionsByIds.mockResolvedValue([]);

    await expect(
      service.create(REQ, { name: 'Tee', sku: 'TEE-888', price: 100, collectionIds: ['c1', 'c2'] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('update', () => {
  it('re-slugs on rename but never rewrites an existing publishedAt', async () => {
    const existing = product();
    repo.findById.mockResolvedValue(existing);
    repo.slugExists.mockResolvedValue(false);
    repo.update.mockResolvedValue(undefined);

    await service.update(REQ, 'prod-1', { name: 'Boxy Heavyweight Tee', status: 'ACTIVE' });

    const written = repo.update.mock.calls[0][1];
    expect(written.slug).toBe('boxy-heavyweight-tee');
    expect(written.publishedAt).toBeUndefined();
  });

  it('stamps publishedAt the first time a draft goes live', async () => {
    repo.findById.mockResolvedValue(product({ status: 'DRAFT', publishedAt: null }));
    repo.update.mockResolvedValue(undefined);

    await service.update(REQ, 'prod-1', { status: 'ACTIVE' });

    expect(repo.update.mock.calls[0][1].publishedAt).toBeInstanceOf(Date);
  });

  it('404s an unknown product', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(service.update(REQ, 'nope', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('discovery', () => {
  it('records a view but still returns the product if tracking fails', async () => {
    repo.findBySlug.mockResolvedValue(product());
    repo.recordView.mockRejectedValue(new Error('db down'));

    const result = await service.getBySlug('heavyweight-oversized-tee', { sessionId: 'sess-1' });

    expect(result.id).toBe('prod-1');
    expect(repo.recordView).toHaveBeenCalledWith({ productId: 'prod-1', customerId: undefined, sessionId: 'sess-1' });
  });

  it('does not record a view for an untracked visitor', async () => {
    repo.findBySlug.mockResolvedValue(product());

    await service.getBySlug('heavyweight-oversized-tee', {});

    expect(repo.recordView).not.toHaveBeenCalled();
  });

  it('returns nothing for recently-viewed without a customer or session', async () => {
    await expect(service.discovery.recentlyViewed({})).resolves.toEqual([]);
    expect(repo.recentlyViewed).not.toHaveBeenCalled();
  });

  it('404s related products for an unknown slug', async () => {
    repo.findBySlug.mockResolvedValue(null);

    await expect(service.discovery.related('ghost')).rejects.toMatchObject({ statusCode: 404 });
  });
});