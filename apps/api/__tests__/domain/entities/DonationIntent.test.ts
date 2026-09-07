import { describe, it, expect } from 'vitest';
import { DonationIntentEntity } from '../../../src/domain/entities/DonationIntent.js';
import { JournalEntryEntity } from '../../../src/domain/entities/JournalEntry.js';
import { FeePolicy } from '../../../src/application/services/FeePolicy.js';
import type { DonationSettlementBreakdown } from '@ubuntu-fund/types';

function makeIntent(overrides: Partial<ConstructorParameters<typeof DonationIntentEntity>[0]> = {}) {
  const now = new Date('2026-01-01');
  return new DonationIntentEntity({
    id: 'intent-1',
    campaignId: 'campaign-1',
    amount: 500,
    currency: 'GHS',
    donorUserId: 'user-1',
    isAnonymous: false,
    tip: 0,
    status: 'CREATED',
    provider: 'wallet',
    idempotencyKey: 'key-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('DonationIntentEntity state machine', () => {
  it('allows CREATED → SUCCEEDED for the synchronous wallet rail', () => {
    const intent = makeIntent();
    intent.markSucceeded('ref-1');
    expect(intent.status).toBe('SUCCEEDED');
    expect(intent.providerRef).toBe('ref-1');
  });

  it('allows CREATED → PENDING → SUCCEEDED for hosted rails', () => {
    const intent = makeIntent({ provider: 'paystack' });
    intent.markPending('ps_ref');
    expect(intent.status).toBe('PENDING');
    intent.markSucceeded();
    expect(intent.status).toBe('SUCCEEDED');
  });

  it('rejects illegal transitions out of a terminal state', () => {
    const intent = makeIntent();
    intent.markFailed();
    expect(intent.status).toBe('FAILED');
    expect(intent.isTerminal()).toBe(true);
    expect(() => intent.markSucceeded()).toThrow(/Illegal donation-intent transition/);
  });

  it('rejects a non-positive amount', () => {
    expect(() => makeIntent({ amount: 0 })).toThrow(/greater than zero/);
  });

  it('computes gross as amount + tip', () => {
    expect(makeIntent({ amount: 500, tip: 50 }).gross).toBe(550);
  });
});

describe('DonationIntentEntity extended state machine (spec §9)', () => {
  it('supports a 3-DS / async card path: PENDING → REQUIRES_ACTION → PROCESSING → SUCCEEDED', () => {
    const intent = makeIntent({ provider: 'paystack' });
    intent.markPending('ps');
    intent.markRequiresAction();
    expect(intent.status).toBe('REQUIRES_ACTION');
    intent.markProcessing();
    expect(intent.status).toBe('PROCESSING');
    intent.markSucceeded();
    expect(intent.status).toBe('SUCCEEDED');
  });

  it('allows a refund lifecycle out of SUCCEEDED', () => {
    const intent = makeIntent();
    intent.markSucceeded();
    intent.markRefundPending();
    expect(intent.status).toBe('REFUND_PENDING');
    intent.markRefunded();
    expect(intent.status).toBe('REFUNDED');
    expect(intent.isTerminal()).toBe(true);
  });

  it('allows a dispute → chargeback lifecycle out of SUCCEEDED', () => {
    const intent = makeIntent();
    intent.markSucceeded();
    intent.markDisputed();
    expect(intent.status).toBe('DISPUTED');
    intent.markChargeback();
    expect(intent.status).toBe('CHARGEBACK');
    expect(intent.isTerminal()).toBe(true);
  });

  it('a delayed/replayed webhook cannot move a terminal payment backward', () => {
    const refunded = makeIntent();
    refunded.markSucceeded();
    refunded.markRefundPending();
    refunded.markRefunded();
    expect(() => refunded.markSucceeded()).toThrow(/Illegal donation-intent transition/);

    const cancelled = makeIntent();
    cancelled.markCancelled();
    expect(cancelled.isTerminal()).toBe(true);
    expect(() => cancelled.markSucceeded()).toThrow(/Illegal/);
  });

  it('records the verified settlement money split in minor units (additive)', () => {
    const intent = makeIntent({ amount: 100, currency: 'GHS' });
    intent.recordSettlementFinancials({
      originalAmountMinor: 10000,
      originalCurrency: 'USD',
      settlementAmountMinor: 155000,
      settlementCurrency: 'GHS',
      fxRate: 15.5,
      fxSource: 'provider',
      providerFeeMinor: 4650,
      platformFeeMinor: 3000,
      netCampaignAmountMinor: 147350,
    });
    expect(intent.originalCurrency).toBe('USD');
    expect(intent.settlementAmountMinor).toBe(155000);
    expect(intent.fxRate).toBe(15.5);
    // legacy major-unit fields are left intact
    expect(intent.amount).toBe(100);
    expect(intent.currency).toBe('GHS');
  });
});

describe('JournalEntryEntity double-entry invariant', () => {
  const breakdown: DonationSettlementBreakdown = {
    amount: 500,
    tip: 50,
    processorFee: 20,
    platformFee: 30,
    beneficiaryNet: 450,
    gross: 550,
    currency: 'GHS',
  };

  it('builds a balanced entry from a donation breakdown', () => {
    const entry = JournalEntryEntity.forDonation(breakdown, {
      campaignId: 'campaign-1',
      donationId: 'donation-1',
      donationIntentId: 'intent-1',
    });
    expect(entry.totalDebits()).toBe(entry.totalCredits());
    // amount(500) + tip(50) debited; beneficiary(450)+platform(30)+processor(20)+tip-credit(50)
    expect(entry.totalDebits()).toBe(550);
    const campaignDebit = entry.lines.find(
      (l) => l.accountKind === 'campaign' && l.direction === 'debit'
    );
    expect(campaignDebit?.amount).toBe(500);
  });

  it('rejects a breakdown whose net does not equal amount minus fees', () => {
    expect(() =>
      JournalEntryEntity.forDonation(
        { ...breakdown, beneficiaryNet: 999 },
        { campaignId: 'c', donationId: 'd', donationIntentId: 'i' }
      )
    ).toThrow(/beneficiaryNet must equal/);
  });

  it('builds a balanced compensating refund entry (mirror of the donation legs)', () => {
    const entry = JournalEntryEntity.forDonationRefund({
      campaignId: 'campaign-1',
      amount: 500,
      beneficiaryNet: 450,
      platformFee: 30,
      processorFee: 20,
      currency: 'GHS',
    });
    expect(entry.totalDebits()).toBe(entry.totalCredits());
    const campaignCredit = entry.lines.find(
      (l) => l.accountKind === 'campaign' && l.direction === 'credit'
    );
    expect(campaignCredit?.amount).toBe(500);
    const beneficiaryDebit = entry.lines.find(
      (l) => l.accountKind === 'beneficiary' && l.direction === 'debit'
    );
    expect(beneficiaryDebit?.amount).toBe(450);
  });

  it('rejects a refund entry whose amount does not equal net + fees', () => {
    expect(() =>
      JournalEntryEntity.forDonationRefund({
        campaignId: 'c',
        amount: 500,
        beneficiaryNet: 400,
        platformFee: 30,
        processorFee: 20,
        currency: 'GHS',
      })
    ).toThrow(/must equal beneficiaryNet/);
  });
});

describe('FeePolicy', () => {
  it('takes no fees by default: beneficiary-net equals the amount', () => {
    const policy = new FeePolicy({ platformFeePercent: 0, paystackFeePercent: 0, paystackFlatFee: 0 });
    const b = policy.computeBreakdown(500, 50, 'GHS', 'wallet');
    expect(b.platformFee).toBe(0);
    expect(b.processorFee).toBe(0);
    expect(b.beneficiaryNet).toBe(500);
    expect(b.gross).toBe(550);
  });

  it('deducts a platform fee from the campaign amount, never from the tip', () => {
    const policy = new FeePolicy({ platformFeePercent: 5, paystackFeePercent: 0, paystackFlatFee: 0 });
    const b = policy.computeBreakdown(500, 50, 'GHS', 'wallet');
    expect(b.platformFee).toBe(25);
    expect(b.beneficiaryNet).toBe(475);
    expect(b.gross).toBe(550);
  });

  it('adds a processor fee only for hosted rails', () => {
    const policy = new FeePolicy({ platformFeePercent: 0, paystackFeePercent: 2, paystackFlatFee: 1 });
    expect(policy.computeBreakdown(100, 0, 'GHS', 'wallet').processorFee).toBe(0);
    expect(policy.computeBreakdown(100, 0, 'GHS', 'paystack').processorFee).toBe(3);
  });
});
