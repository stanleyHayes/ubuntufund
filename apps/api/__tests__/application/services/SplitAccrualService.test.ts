import { describe, it, expect, beforeEach } from 'vitest';
import { SplitAccrualService } from '../../../src/application/services/SplitAccrualService.js';
import { CampaignSplitVersionEntity } from '../../../src/domain/entities/CampaignSplitVersion.js';
import type { CampaignSplitRepositoryPort } from '../../../src/domain/ports/outbound/CampaignSplitRepositoryPort.js';
import type { CampaignBeneficiaryBalanceRepositoryPort } from '../../../src/domain/ports/outbound/CampaignBeneficiaryBalanceRepositoryPort.js';
import type { CampaignBeneficiaryAccrualRepositoryPort } from '../../../src/domain/ports/outbound/CampaignBeneficiaryAccrualRepositoryPort.js';
import type {
  CampaignBeneficiaryAccrual,
  DonationSettlementBreakdown,
} from '@ubuntu-fund/types';

function activeSplit(campaignId: string) {
  return new CampaignSplitVersionEntity({
    id: 's1',
    campaignId,
    version: 1,
    status: 'active',
    locked: false,
    createdBy: 'owner',
    createdAt: new Date(),
    updatedAt: new Date(),
    allocations: [
      { beneficiaryId: 'A', name: 'Ama', shareBps: 6000, consent: 'accepted' },
      { beneficiaryId: 'B', name: 'Kofi', shareBps: 4000, consent: 'accepted' },
    ],
  });
}

/** In-memory fakes just rich enough to exercise the accrual arithmetic. */
function makeFakes(campaignId: string, hasSplit = true) {
  let locked = false;
  const pending = new Map<string, number>();
  const accruals = new Map<string, CampaignBeneficiaryAccrual>();

  const splitRepo = {
    async lockActive() {
      locked = true;
      return null;
    },
    async findActive() {
      return hasSplit ? activeSplit(campaignId) : null;
    },
  } as unknown as CampaignSplitRepositoryPort;

  const balanceRepo = {
    async accruePending(_c: string, b: string, _cur: string, amount: number) {
      pending.set(b, (pending.get(b) ?? 0) + amount);
      return {} as never;
    },
    async reversePending(_c: string, b: string, _cur: string, amount: number) {
      const have = pending.get(b) ?? 0;
      if (have < amount) return false;
      pending.set(b, have - amount);
      return true;
    },
  } as unknown as CampaignBeneficiaryBalanceRepositoryPort;

  const accrualRepo = {
    async record(a: CampaignBeneficiaryAccrual) {
      if (accruals.has(a.donationIntentId)) return false;
      accruals.set(a.donationIntentId, { ...a });
      return true;
    },
    async findByDonationIntent(id: string) {
      return accruals.get(id) ?? null;
    },
    async recordReversal(id: string, minor: number, total: number) {
      const a = accruals.get(id);
      if (!a) return;
      a.reversedMinor += minor;
      if (a.reversedMinor >= total) a.reversed = true;
    },
  } as unknown as CampaignBeneficiaryAccrualRepositoryPort;

  return {
    splitRepo,
    balanceRepo,
    accrualRepo,
    pending,
    accruals,
    isLocked: () => locked,
  };
}

const breakdown = (beneficiaryNet: number): DonationSettlementBreakdown =>
  ({
    amount: beneficiaryNet,
    gross: beneficiaryNet,
    beneficiaryNet,
    platformFee: 0,
    processorFee: 0,
    tip: 0,
    currency: 'GHS',
    providerRef: 'ref',
  }) as unknown as DonationSettlementBreakdown;

describe('SplitAccrualService', () => {
  const campaignId = 'c1';
  let f: ReturnType<typeof makeFakes>;

  beforeEach(() => {
    f = makeFakes(campaignId);
  });

  it('distributes beneficiary-net across the split and locks it', async () => {
    const svc = new SplitAccrualService(true, f.splitRepo, f.balanceRepo, f.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(965));
    expect(f.pending.get('A')).toBe(579); // 60%
    expect(f.pending.get('B')).toBe(386); // 40%
    expect(f.pending.get('A')! + f.pending.get('B')!).toBe(965);
    expect(f.isLocked()).toBe(true);
    expect(f.accruals.get('don-1')?.entries).toEqual([
      { beneficiaryId: 'A', amount: 579 },
      { beneficiaryId: 'B', amount: 386 },
    ]);
  });

  it('is idempotent per donation — a re-run does not double-accrue', async () => {
    const svc = new SplitAccrualService(true, f.splitRepo, f.balanceRepo, f.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(965));
    await svc.accrue(campaignId, 'don-1', breakdown(965));
    expect(f.pending.get('A')).toBe(579);
    expect(f.pending.get('B')).toBe(386);
  });

  it('reverses a full refund by the exact amounts credited', async () => {
    const svc = new SplitAccrualService(true, f.splitRepo, f.balanceRepo, f.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(965));
    const actual = await svc.reverse(campaignId, 'don-1', 965);
    expect(actual).toBe(965); // fully clawed back
    expect(f.pending.get('A')).toBe(0);
    expect(f.pending.get('B')).toBe(0);
    expect(f.accruals.get('don-1')?.reversed).toBe(true);
  });

  it('returns only the amount ACTUALLY clawed back when a beneficiary already withdrew', async () => {
    const svc = new SplitAccrualService(true, f.splitRepo, f.balanceRepo, f.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(1000)); // A 600, B 400
    f.pending.set('B', 0); // B already withdrew their share
    const actual = await svc.reverse(campaignId, 'don-1', 1000);
    // A's 600 reversed; B's 400 could not be (short) → actual excludes it, so
    // the caller subtracts only 600 from the campaign aggregate (no over-claw).
    expect(actual).toBe(600);
    expect(f.pending.get('A')).toBe(0);
    expect(f.accruals.get('don-1')?.reversed).toBe(true);
  });

  it('returns null for a non-split donation (no accrual recorded)', async () => {
    const svc = new SplitAccrualService(true, f.splitRepo, f.balanceRepo, f.accrualRepo);
    const actual = await svc.reverse(campaignId, 'never-accrued', 500);
    expect(actual).toBeNull();
  });

  it('reverses a partial refund proportionally, leaving the accrual open', async () => {
    const svc = new SplitAccrualService(true, f.splitRepo, f.balanceRepo, f.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(1000)); // A 600, B 400
    await svc.reverse(campaignId, 'don-1', 500); // half → A 300, B 200
    expect(f.pending.get('A')).toBe(300);
    expect(f.pending.get('B')).toBe(200);
    expect(f.accruals.get('don-1')?.reversed).toBe(false);
  });

  it('never over-reverses across successive partial refunds', async () => {
    const svc = new SplitAccrualService(true, f.splitRepo, f.balanceRepo, f.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(1000)); // A 600, B 400
    await svc.reverse(campaignId, 'don-1', 500); // A 300, B 200
    await svc.reverse(campaignId, 'don-1', 500); // remaining exactly → A 0, B 0
    await svc.reverse(campaignId, 'don-1', 500); // accrual already fully reversed → no-op
    expect(f.pending.get('A')).toBe(0);
    expect(f.pending.get('B')).toBe(0);
    expect(f.accruals.get('don-1')?.reversed).toBe(true);
    expect(f.accruals.get('don-1')?.reversedMinor).toBe(100000);
  });

  it('is a no-op when the flag is off', async () => {
    const svc = new SplitAccrualService(false, f.splitRepo, f.balanceRepo, f.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(965));
    expect(f.pending.size).toBe(0);
    expect(f.isLocked()).toBe(false);
  });

  it('is a no-op when the campaign has no active split', async () => {
    const g = makeFakes(campaignId, false);
    const svc = new SplitAccrualService(true, g.splitRepo, g.balanceRepo, g.accrualRepo);
    await svc.accrue(campaignId, 'don-1', breakdown(965));
    expect(g.pending.size).toBe(0);
  });
});
