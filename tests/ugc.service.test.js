'use strict';

jest.mock('../src/modules/ugc/ugc.repository');
jest.mock('../src/modules/orders/order.repository');
jest.mock('../src/modules/loyalty/wallet.service');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/ugc/ugc.repository');
const orderRepo = require('../src/modules/orders/order.repository');
const walletService = require('../src/modules/loyalty/wallet.service');
const service = require('../src/modules/ugc/ugc.service');

const REQ_CUSTOMER = {
  customerId: 'cust-1',
  user: { id: 'user-1', roles: ['customer'], permissions: [] },
  ip: '127.0.0.1',
  headers: {},
  id: 'req-1',
};

const REQ_ADMIN = {
  customerId: null,
  user: { id: 'admin-1', roles: ['admin'], permissions: ['ugc:read', 'ugc:update'] },
  ip: '127.0.0.1',
  headers: {},
  id: 'req-2',
};

function sampleSubmission(overrides = {}) {
  const s = {
    id: 'ugc-1',
    customerId: 'cust-1',
    orderId: 'ord-1',
    productId: 'prod-1',
    platform: 'INSTAGRAM',
    mediaType: 'POST',
    mediaUrl: 'https://instagram.com/p/123/img.jpg',
    postUrl: 'https://instagram.com/p/123',
    caption: 'Loving this new collection drop! #style',
    status: 'PENDING',
    orderVerified: true,
    adminVerified: false,
    toJSON: () => ({ ...s }),
    ...overrides,
  };
  return s;
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.createSubmission.mockImplementation(async (p) => sampleSubmission(p));
  repo.createReward.mockImplementation(async (p) => ({ id: 'rew-1', ...p }));
  repo.updateSubmission.mockImplementation(async (s, fields) => ({ ...s, ...fields }));
  walletService.credit.mockResolvedValue({ id: 'wtx-1', amount: 50 });
});

describe('UGC service - submit', () => {
  it('rejects submission if caller is not an authenticated customer', async () => {
    await expect(
      service.submit({ user: null, customerId: null }, { orderId: 'ord-1', platform: 'INSTAGRAM', mediaType: 'IMAGE', mediaUrl: 'https://img.jpg' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('400s if order is not found or does not belong to the customer', async () => {
    orderRepo.findById.mockResolvedValue({ id: 'ord-1', customerId: 'other-cust', status: 'DELIVERED' });

    await expect(
      service.submit(REQ_CUSTOMER, { orderId: 'ord-1', platform: 'INSTAGRAM', mediaType: 'IMAGE', mediaUrl: 'https://img.jpg' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('400s if order has not been delivered', async () => {
    orderRepo.findById.mockResolvedValue({ id: 'ord-1', customerId: 'cust-1', status: 'CONFIRMED' });

    await expect(
      service.submit(REQ_CUSTOMER, { orderId: 'ord-1', platform: 'INSTAGRAM', mediaType: 'IMAGE', mediaUrl: 'https://img.jpg' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('creates UGC submission with orderVerified=true and status=PENDING for delivered order', async () => {
    orderRepo.findById.mockResolvedValue({
      id: 'ord-1',
      customerId: 'cust-1',
      status: 'DELIVERED',
      items: [{ productId: 'prod-1' }],
    });
    repo.findSubmissionById.mockResolvedValue(sampleSubmission());

    const result = await service.submit(REQ_CUSTOMER, {
      orderId: 'ord-1',
      platform: 'INSTAGRAM',
      mediaType: 'POST',
      mediaUrl: 'https://instagram.com/p/123/img.jpg',
      postUrl: 'https://instagram.com/p/123',
      caption: 'Look at this!',
    });

    expect(repo.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        orderId: 'ord-1',
        productId: 'prod-1',
        platform: 'INSTAGRAM',
        orderVerified: true,
        adminVerified: false,
        status: 'PENDING',
      }),
      'tx'
    );
    expect(result.status).toBe('PENDING');
  });
});

describe('UGC service - verifyAndReward', () => {
  it('404s if submission does not exist', async () => {
    repo.findSubmissionById.mockResolvedValue(null);
    await expect(
      service.verifyAndReward(REQ_ADMIN, 'ugc-x', { status: 'APPROVED' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses to reward an already verified submission', async () => {
    repo.findSubmissionById.mockResolvedValue(sampleSubmission({ status: 'APPROVED', adminVerified: true }));
    await expect(
      service.verifyAndReward(REQ_ADMIN, 'ugc-1', { status: 'APPROVED' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses to approve if order was not verified', async () => {
    repo.findSubmissionById.mockResolvedValue(sampleSubmission({ orderVerified: false }));
    await expect(
      service.verifyAndReward(REQ_ADMIN, 'ugc-1', { status: 'APPROVED' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('approves submission and credits reward through loyalty wallet ledger', async () => {
    const submission = sampleSubmission({ orderVerified: true, adminVerified: false, status: 'PENDING' });
    repo.findSubmissionById.mockResolvedValue(submission);

    await service.verifyAndReward(REQ_ADMIN, 'ugc-1', { status: 'APPROVED', rewardAmount: 75 });

    expect(repo.updateSubmission).toHaveBeenCalledWith(
      submission,
      expect.objectContaining({
        status: 'APPROVED',
        adminVerified: true,
        reviewedBy: 'admin-1',
      }),
      'tx'
    );
    expect(walletService.credit).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        type: 'UGC_CREDIT',
        amount: 75,
        referenceType: 'UGC_SUBMISSION',
        referenceId: 'ugc-1',
      }),
      'tx'
    );
    expect(repo.createReward).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: 'ugc-1',
        customerId: 'cust-1',
        amount: 75,
      }),
      'tx'
    );
  });

  it('rejects submission with reason and does not credit wallet', async () => {
    const submission = sampleSubmission({ orderVerified: true, adminVerified: false, status: 'PENDING' });
    repo.findSubmissionById.mockResolvedValue(submission);

    await service.verifyAndReward(REQ_ADMIN, 'ugc-1', { status: 'REJECTED', rejectionReason: 'Low image quality' });

    expect(repo.updateSubmission).toHaveBeenCalledWith(
      submission,
      expect.objectContaining({
        status: 'REJECTED',
        adminVerified: false,
        rejectionReason: 'Low image quality',
      }),
      'tx'
    );
    expect(walletService.credit).not.toHaveBeenCalled();
    expect(repo.createReward).not.toHaveBeenCalled();
  });
});

describe('UGC service - access control', () => {
  it('customer cannot view another customer UGC submission', async () => {
    repo.findSubmissionById.mockResolvedValue(sampleSubmission({ customerId: 'cust-other' }));
    await expect(service.getSubmission(REQ_CUSTOMER, 'ugc-1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('staff can view any customer UGC submission', async () => {
    repo.findSubmissionById.mockResolvedValue(sampleSubmission({ customerId: 'cust-other' }));
    const result = await service.getSubmission(REQ_ADMIN, 'ugc-1');
    expect(result.id).toBe('ugc-1');
  });

  it('scopes customer submission list to their own customerId', async () => {
    repo.listSubmissions.mockResolvedValue({ rows: [], count: 0, page: 1, limit: 20 });
    await service.listSubmissions(REQ_CUSTOMER, { page: 1, limit: 20 });

    expect(repo.listSubmissions).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ customerId: 'cust-1' }),
      })
    );
  });
});
