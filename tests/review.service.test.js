'use strict';

jest.mock('../src/modules/reviews/review.repository');
jest.mock('../src/modules/products/product.repository');
jest.mock('../src/modules/orders/order.repository');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/reviews/review.repository');
const productRepo = require('../src/modules/products/product.repository');
const orderRepo = require('../src/modules/orders/order.repository');
const service = require('../src/modules/reviews/review.service');

const REQ_CUSTOMER = {
  customerId: 'cust-1',
  user: { id: 'user-1', roles: ['customer'], permissions: [] },
  ip: '127.0.0.1',
  headers: {},
  id: 'req-1',
};

const REQ_ADMIN = {
  customerId: null,
  user: { id: 'admin-1', roles: ['admin'], permissions: ['reviews:read', 'reviews:update', 'reviews:delete'] },
  ip: '127.0.0.1',
  headers: {},
  id: 'req-2',
};

const REQ_ANON = {
  customerId: null,
  user: null,
  ip: '127.0.0.1',
  headers: {},
  id: 'req-3',
};

function sampleReview(overrides = {}) {
  const r = {
    id: 'rev-1',
    customerId: 'cust-1',
    productId: 'prod-1',
    variantId: 'var-1',
    orderId: 'ord-1',
    rating: 5,
    title: 'Great fit',
    comment: 'Fits comfortably and great material.',
    fit: 'TRUE_TO_SIZE',
    qualityRating: 5,
    isVerifiedPurchase: true,
    status: 'APPROVED',
    helpfulCount: 2,
    images: [],
    toJSON: () => ({ ...r }),
    ...overrides,
  };
  return r;
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.create.mockImplementation(async (p) => sampleReview(p));
  repo.createImages.mockResolvedValue([]);
  repo.deleteImages.mockResolvedValue(1);
  repo.deleteReview.mockResolvedValue(1);
  repo.update.mockImplementation(async (r, fields) => ({ ...r, ...fields }));
  repo.incrementHelpful.mockImplementation(async (id) => sampleReview({ id, helpfulCount: 3 }));
});

describe('Review service - create', () => {
  it('rejects creation if caller is not an authenticated customer', async () => {
    await expect(
      service.create({ user: null, customerId: null }, { variantId: 'var-1', rating: 5, comment: 'Nice' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('404s if product variant does not exist', async () => {
    productRepo.findVariantById.mockResolvedValue(null);

    await expect(
      service.create(REQ_CUSTOMER, { variantId: 'var-x', rating: 5, comment: 'Great product' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses to allow duplicate reviews for the same variant by the same customer', async () => {
    productRepo.findVariantById.mockResolvedValue({ id: 'var-1', productId: 'prod-1' });
    repo.findByCustomerAndVariant.mockResolvedValue(sampleReview());

    await expect(
      service.create(REQ_CUSTOMER, { variantId: 'var-1', rating: 4, comment: 'Another review' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('forbids review if customer has no delivered, non-returned purchase of the variant', async () => {
    productRepo.findVariantById.mockResolvedValue({ id: 'var-1', productId: 'prod-1' });
    repo.findByCustomerAndVariant.mockResolvedValue(null);
    orderRepo.list.mockResolvedValue({ rows: [] });

    await expect(
      service.create(REQ_CUSTOMER, { variantId: 'var-1', rating: 5, comment: 'Loved it' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('successfully creates review with images and verified flag for eligible delivered purchase', async () => {
    productRepo.findVariantById.mockResolvedValue({ id: 'var-1', productId: 'prod-1' });
    repo.findByCustomerAndVariant.mockResolvedValue(null);
    orderRepo.list.mockResolvedValue({
      rows: [
        { id: 'ord-1', customerId: 'cust-1', status: 'DELIVERED', items: [{ variantId: 'var-1' }] },
      ],
    });
    repo.findById.mockResolvedValue(
      sampleReview({ id: 'rev-new', status: 'PENDING', isVerifiedPurchase: true })
    );

    const result = await service.create(REQ_CUSTOMER, {
      variantId: 'var-1',
      rating: 5,
      title: 'Awesome jacket',
      comment: 'Fits true to size and fabric is premium.',
      fit: 'TRUE_TO_SIZE',
      qualityRating: 5,
      images: ['https://example.com/img1.jpg'],
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        productId: 'prod-1',
        variantId: 'var-1',
        orderId: 'ord-1',
        isVerifiedPurchase: true,
        status: 'PENDING',
      }),
      'tx'
    );
    expect(repo.createImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ url: 'https://example.com/img1.jpg' })]),
      'tx'
    );
    expect(result.status).toBe('PENDING');
  });
});

describe('Review service - update', () => {
  it('404s if review does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.update(REQ_CUSTOMER, 'rev-x', { rating: 4 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('403s if caller is neither author nor privileged staff', async () => {
    repo.findById.mockResolvedValue(sampleReview({ customerId: 'other-cust' }));
    await expect(service.update(REQ_CUSTOMER, 'rev-1', { rating: 4 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('resets status to PENDING for re-moderation when author edits review', async () => {
    const existing = sampleReview({ customerId: 'cust-1', status: 'APPROVED' });
    repo.findById.mockResolvedValue(existing);

    await service.update(REQ_CUSTOMER, 'rev-1', { comment: 'Updated comment here' });

    expect(repo.update).toHaveBeenCalledWith(
      existing,
      expect.objectContaining({ comment: 'Updated comment here', status: 'PENDING' }),
      'tx'
    );
  });
});

describe('Review service - moderation', () => {
  it('moderates a review status and notes', async () => {
    const existing = sampleReview({ status: 'PENDING' });
    repo.findById.mockResolvedValue(existing);

    await service.moderate(REQ_ADMIN, 'rev-1', { status: 'APPROVED', moderationNote: 'Looks great' });

    expect(repo.update).toHaveBeenCalledWith(
      existing,
      expect.objectContaining({
        status: 'APPROVED',
        moderationNote: 'Looks great',
        moderatedBy: 'admin-1',
      }),
      'tx'
    );
  });
});

describe('Review service - delete', () => {
  it('allows author or admin to delete review', async () => {
    const existing = sampleReview({ customerId: 'cust-1' });
    repo.findById.mockResolvedValue(existing);

    const result = await service.remove(REQ_CUSTOMER, 'rev-1');
    expect(result).toEqual({ deleted: true });
    expect(repo.deleteReview).toHaveBeenCalledWith('rev-1', 'tx');
  });

  it('forbids non-owner non-admin from deleting review', async () => {
    const existing = sampleReview({ customerId: 'cust-other' });
    repo.findById.mockResolvedValue(existing);

    await expect(service.remove(REQ_CUSTOMER, 'rev-1')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('Review service - helpful vote', () => {
  it('increments helpful count on approved review', async () => {
    repo.findById.mockResolvedValue(sampleReview({ status: 'APPROVED' }));
    const result = await service.voteHelpful(REQ_ANON, 'rev-1');
    expect(repo.incrementHelpful).toHaveBeenCalledWith('rev-1');
    expect(result.helpfulCount).toBe(3);
  });

  it('refuses helpful vote on pending or rejected review', async () => {
    repo.findById.mockResolvedValue(sampleReview({ status: 'PENDING' }));
    await expect(service.voteHelpful(REQ_ANON, 'rev-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Review service - get and list', () => {
  it('hides pending review from public caller', async () => {
    repo.findById.mockResolvedValue(sampleReview({ status: 'PENDING', customerId: 'cust-1' }));
    await expect(service.get(REQ_ANON, 'rev-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('allows author to view their pending review', async () => {
    repo.findById.mockResolvedValue(sampleReview({ status: 'PENDING', customerId: 'cust-1' }));
    const result = await service.get(REQ_CUSTOMER, 'rev-1');
    expect(result.id).toBe('rev-1');
  });

  it('forces status=APPROVED filter for public list requests', async () => {
    repo.list.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20 });
    await service.list(REQ_ANON, { productId: 'prod-1', page: 1, limit: 20 });
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ status: 'APPROVED', productId: 'prod-1' }),
      })
    );
  });
});
