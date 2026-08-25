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
