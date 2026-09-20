'use strict';

jest.mock('../src/modules/referrals/referral.repository');

const repo = require('../src/modules/referrals/referral.repository');
const service = require('../src/modules/referrals/referral.service');
const config = require('../src/config');

const RETURN_WINDOW_MS = config.referral.returnWindowDays * 86400000;

function event(stage, overrides = {}) {
  return { id: `evt-${stage}`, referralId: 'ref-1', refereeUserId: 'user-2', stage, createdAt: new Date(), ...overrides };
}

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.createEvent.mockResolvedValue({});
});

describe('recordSignup', () => {
  it('records a SIGNED_UP event when the code is valid', async () => {
    repo.findByCode.mockResolvedValue({ id: 'ref-1', code: 'REFABCD' });
    await service.recordSignup({ referralCode: 'refabcd', newUserId: 'user-2' });
    expect(repo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ referralId: 'ref-1', refereeUserId: 'user-2', stage: 'SIGNED_UP' }), undefined);
  });

  it('does nothing for an unknown code', async () => {
    repo.findByCode.mockResolvedValue(null);
    const result = await service.recordSignup({ referralCode: 'GHOST', newUserId: 'user-2' });
    expect(result).toBeNull();
    expect(repo.createEvent).not.toHaveBeenCalled();
  });
});

describe('validateAndReward', () => {
  it('rejects a user who was never referred', async () => {
    repo.findEventsForReferee.mockResolvedValue([]);
    await expect(service.validateAndReward('user-2')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses to reward before the order has been delivered', async () => {
    repo.findEventsForReferee.mockResolvedValue([event('SIGNED_UP')]);
    await expect(service.validateAndReward('user-2')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses to reward before the return window has closed', async () => {
    repo.findEventsForReferee.mockResolvedValue([event('SIGNED_UP'), event('DELIVERED', { createdAt: new Date() })]);
    await expect(service.validateAndReward('user-2')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rewards once the return window has fully elapsed with no cancellation', async () => {
    const deliveredAt = new Date(Date.now() - RETURN_WINDOW_MS - 1000);
    repo.findEventsForReferee.mockResolvedValue([event('SIGNED_UP'), event('DELIVERED', { createdAt: deliveredAt })]);

    const result = await service.validateAndReward('user-2');
    expect(result.rewarded).toBe(true);
    expect(repo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: 'VALIDATED' }), 'tx');
    expect(repo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: 'REWARD_ISSUED' }), 'tx');
  });

  it('refuses to reward a cancelled referral order', async () => {
    const deliveredAt = new Date(Date.now() - RETURN_WINDOW_MS - 1000);
    repo.findEventsForReferee.mockResolvedValue([event('SIGNED_UP'), event('DELIVERED', { createdAt: deliveredAt }), event('CANCELLED')]);
    await expect(service.validateAndReward('user-2')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses to reward twice', async () => {
    const deliveredAt = new Date(Date.now() - RETURN_WINDOW_MS - 1000);
    repo.findEventsForReferee.mockResolvedValue([event('SIGNED_UP'), event('DELIVERED', { createdAt: deliveredAt }), event('REWARD_ISSUED')]);
    await expect(service.validateAndReward('user-2')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('flags suspicious signals instead of rewarding', async () => {
    const deliveredAt = new Date(Date.now() - RETURN_WINDOW_MS - 1000);
    repo.findEventsForReferee.mockResolvedValue([event('SIGNED_UP'), event('DELIVERED', { createdAt: deliveredAt })]);

    await expect(
      service.validateAndReward('user-2', { fraudSignals: { ipReused: true, phoneReused: true, deviceReused: true } })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createEvent).toHaveBeenCalledWith(expect.objectContaining({ stage: 'FRAUD_FLAGGED' }), undefined);
  });
});
