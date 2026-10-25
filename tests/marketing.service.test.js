'use strict';

jest.mock('../src/modules/marketing/marketing.repository');
jest.mock('../src/modules/audit/audit.service');

const repo = require('../src/modules/marketing/marketing.repository');
const audit = require('../src/modules/audit/audit.service');
const service = require('../src/modules/marketing/marketing.service');

const REQ = {
  user: { id: 'marketing-admin-1', roles: ['admin'], permissions: ['*'] },
  headers: { 'x-session-id': 'sess-123', referer: 'https://instagram.com' },
  ip: '127.0.0.1',
};

function sampleCampaign(overrides = {}) {
  return {
    id: 'camp-1',
    name: 'Winter Festive Drop',
    slug: 'winter-festive-drop',
    channel: 'INSTAGRAM',
    budget: '50000.00',
    utmSource: 'instagram',
    utmMedium: 'influencer',
    utmCampaign: 'winter_drop',
    isActive: true,
    toJSON: () => ({ id: 'camp-1', name: 'Winter Festive Drop', slug: 'winter-festive-drop' }),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  audit.record.mockResolvedValue({});
});

describe('Marketing Campaigns', () => {
  it('creates a campaign and auto-derives the slug', async () => {
    repo.findCampaignBySlug.mockResolvedValue(null);
    repo.createCampaign.mockImplementation(async (p) => ({ ...p, id: 'camp-1' }));

    const result = await service.createCampaign(REQ, {
      name: 'Summer Sale 2026',
      channel: 'INSTAGRAM',
      budget: 25000,
    });

    expect(result.slug).toBe('summer-sale-2026');
    expect(repo.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ slug: 'summer-sale-2026', budget: 25000 }));
    expect(audit.record).toHaveBeenCalledWith(REQ, expect.objectContaining({ action: 'campaign.create' }));
  });

  it('rejects duplicate campaign slugs with 409 Conflict', async () => {
    repo.findCampaignBySlug.mockResolvedValue(sampleCampaign());
    await expect(
      service.createCampaign(REQ, { name: 'Winter Festive Drop', slug: 'winter-festive-drop' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects inverted dates where startsAt is after endsAt (400)', async () => {
    repo.findCampaignBySlug.mockResolvedValue(null);
    await expect(
      service.createCampaign(REQ, {
        name: 'Bad Dates Campaign',
        startsAt: '2026-12-31',
        endsAt: '2026-10-01',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns campaign details with performance ROI metrics', async () => {
    repo.findCampaignById.mockResolvedValue(sampleCampaign());
    repo.getCampaignPerformance.mockResolvedValue({
      clicks: 1200,
      visits: 850,
      signups: 45,
      cartAdds: 30,
      checkoutStarts: 20,
      purchases: 15,
      attributedOrders: 15,
      attributedRevenue: 45000,
    });

    const result = await service.getCampaign('camp-1');
    expect(result.id).toBe('camp-1');
    expect(result.performance.clicks).toBe(1200);
    expect(result.performance.attributedRevenue).toBe(45000);
  });

  it('updates a campaign and records an audit log', async () => {
    const camp = sampleCampaign();
    repo.findCampaignById.mockResolvedValue(camp);
    repo.updateCampaign.mockResolvedValue(undefined);

    await service.updateCampaign(REQ, 'camp-1', { budget: 75000 });
    expect(repo.updateCampaign).toHaveBeenCalledWith(camp, expect.objectContaining({ budget: 75000 }));
    expect(audit.record).toHaveBeenCalledWith(REQ, expect.objectContaining({ action: 'campaign.update' }));
  });

  it('deletes a campaign', async () => {
    const camp = sampleCampaign();
    repo.findCampaignById.mockResolvedValue(camp);
    repo.deleteCampaign.mockResolvedValue(1);

    const result = await service.deleteCampaign(REQ, 'camp-1');
    expect(result.deleted).toBe(true);
    expect(repo.deleteCampaign).toHaveBeenCalledWith('camp-1');
  });
});

describe('Marketing Event Tracking', () => {
  it('tracks an event directly with campaignId', async () => {
    repo.recordEvent.mockResolvedValue({ id: 'evt-1' });

    const result = await service.trackEvent(REQ, {
      eventType: 'CLICK',
      campaignId: 'camp-1',
    });

    expect(result.tracked).toBe(true);
    expect(result.campaignId).toBe('camp-1');
    expect(repo.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'camp-1',
        eventType: 'CLICK',
        sessionId: 'sess-123',
      })
    );
  });

  it('resolves campaign from UTM tags when campaignId is omitted', async () => {
    repo.findCampaignByUtm.mockResolvedValue(sampleCampaign({ id: 'camp-resolved' }));
    repo.recordEvent.mockResolvedValue({ id: 'evt-2' });

    const result = await service.trackEvent(REQ, {
      eventType: 'VISIT',
      utmSource: 'instagram',
      utmCampaign: 'winter_drop',
    });

    expect(result.tracked).toBe(true);
    expect(result.campaignId).toBe('camp-resolved');
    expect(repo.findCampaignByUtm).toHaveBeenCalledWith({
      utmSource: 'instagram',
      utmMedium: undefined,
      utmCampaign: 'winter_drop',
    });
  });
});
