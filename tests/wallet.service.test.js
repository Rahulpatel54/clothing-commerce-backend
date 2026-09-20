'use strict';

jest.mock('../src/modules/loyalty/wallet.repository');

const repo = require('../src/modules/loyalty/wallet.repository');
const service = require('../src/modules/loyalty/wallet.service');

beforeEach(() => {
  repo.transaction.mockImplementation(async (fn) => fn('tx'));
  repo.createTransaction.mockResolvedValue({ id: 'wt-1' });
});

describe('getBalance', () => {
  it('returns zero for a customer with no wallet yet', async () => {
    repo.findByCustomer.mockResolvedValue(null);
    await expect(service.getBalance('cust-1')).resolves.toBe(0);
  });

  it('sums the ledger for an existing wallet', async () => {
    repo.findByCustomer.mockResolvedValue({ id: 'wallet-1' });
    repo.sumBalance.mockResolvedValue(250.5);
    await expect(service.getBalance('cust-1')).resolves.toBe(250.5);
  });
});

describe('credit', () => {
  it('creates the wallet on first credit and writes a positive ledger row with an expiry', async () => {
    repo.findByCustomerForUpdate.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 'wallet-1' });

    await service.credit({ customerId: 'cust-1', type: 'REFERRAL_CREDIT', amount: 100 });

    const written = repo.createTransaction.mock.calls[0][0];
    expect(written.amount).toBe(100);
    expect(written.expiresAt).toBeInstanceOf(Date);
  });

  it('rejects a non-positive credit amount', async () => {
    await expect(service.credit({ customerId: 'cust-1', type: 'UGC_CREDIT', amount: 0 })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('debit (never goes negative)', () => {
  it('debits when there is enough balance', async () => {
    repo.findByCustomerForUpdate.mockResolvedValue({ id: 'wallet-1' });
    repo.sumBalance.mockResolvedValue(200);

    await service.debit({ customerId: 'cust-1', amount: 150 });
    const written = repo.createTransaction.mock.calls[0][0];
    expect(written.amount).toBe(-150);
  });

  it('refuses a debit larger than the current balance', async () => {
    repo.findByCustomerForUpdate.mockResolvedValue({ id: 'wallet-1' });
    repo.sumBalance.mockResolvedValue(50);

    await expect(service.debit({ customerId: 'cust-1', amount: 100 })).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createTransaction).not.toHaveBeenCalled();
  });

  it('never allows balance to go negative even when it is already zero', async () => {
    repo.findByCustomerForUpdate.mockResolvedValue(null);
    repo.create.mockResolvedValue({ id: 'wallet-1' });
    repo.sumBalance.mockResolvedValue(0);

    await expect(service.debit({ customerId: 'cust-1', amount: 1 })).rejects.toMatchObject({ statusCode: 409 });
  });
});
