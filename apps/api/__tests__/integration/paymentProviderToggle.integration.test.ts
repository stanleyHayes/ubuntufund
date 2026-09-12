import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PaymentMethod } from '@ubuntu-fund/types';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { PaymentProviderModel } from '../../src/infrastructure/database/models/PaymentProviderModel.js';
import { MongoPaymentProviderRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoPaymentProviderRepository.js';

/**
 * The admin toggle used to change nothing: the donation rails were gated purely
 * by env flags, and switching Paystack off in the dashboard left it happily
 * taking money. These cover the seam that makes the toggle real — and the
 * safety property that matters more, which is that it can never accidentally
 * stop payments.
 */

const repo = new MongoPaymentProviderRepository();

beforeAll(async () => {
  await connectTestDatabase();
});

afterAll(async () => {
  await dropTestDatabase();
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await PaymentProviderModel.deleteMany({});
});

describe('gateway records', () => {
  it('creates the rails alongside the payment methods', async () => {
    // Paystack and Flutterwave had no records at all, which is why gating
    // payments on this collection would have stopped every donation.
    await repo.findAll();

    const paystack = await PaymentProviderModel.findOne({ slug: 'paystack' });
    expect(paystack, 'the rail itself needs a record to be switchable').not.toBeNull();
    expect(paystack!.type).toBe(PaymentMethod.GATEWAY);
  });

  it('backfills the rails into a database that already has the method rows', async () => {
    // The seed only ran on an empty collection, so an existing deployment
    // would never have got these — and a missing record is now the difference
    // between a rail being live and not.
    await PaymentProviderModel.create({
      name: 'Ujimora Wallet',
      slug: 'wallet',
      type: PaymentMethod.WALLET,
      enabled: true,
      isDefault: true,
      feePercent: 0,
      displayOrder: 1,
    });

    await repo.findAll();

    expect(await PaymentProviderModel.countDocuments({ type: PaymentMethod.GATEWAY })).toBe(2);
  });

  it('never overwrites an admin toggle on a later boot', async () => {
    await repo.findAll();
    await PaymentProviderModel.updateOne({ slug: 'paystack' }, { $set: { enabled: false } });

    await repo.findAll(); // a restart

    const paystack = await PaymentProviderModel.findOne({ slug: 'paystack' });
    expect(paystack!.enabled, 'an admin decision must survive a redeploy').toBe(false);
  });
});

describe('isGatewayEnabled', () => {
  it('reports a rail the admin switched off', async () => {
    await repo.findAll();
    await PaymentProviderModel.updateOne({ slug: 'paystack' }, { $set: { enabled: false } });

    expect(await repo.isGatewayEnabled('paystack')).toBe(false);
  });

  it('reports a rail that is on', async () => {
    await repo.findAll();
    await PaymentProviderModel.updateOne({ slug: 'paystack' }, { $set: { enabled: true } });

    expect(await repo.isGatewayEnabled('paystack')).toBe(true);
  });

  it('fails OPEN when the record is missing', async () => {
    // The single most important property here. This sits in the donation path,
    // so "I could not find the row" must never mean "stop taking money".
    await PaymentProviderModel.deleteMany({});

    expect(await repo.isGatewayEnabled('paystack')).toBe(true);
  });
});
