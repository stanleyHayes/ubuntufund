import { describe, it, expect } from 'vitest';
import { UpdatePlanUseCase } from '../../../src/application/use-cases/UpdatePlanUseCase.js';
import { SetComplianceLimitUseCase } from '../../../src/application/use-cases/SetComplianceLimitUseCase.js';
import type { SubscriptionPlanRepositoryPort } from '../../../src/domain/ports/outbound/SubscriptionPlanRepositoryPort.js';
import type { UserRepositoryPort } from '../../../src/domain/ports/outbound/UserRepositoryPort.js';
import type {
  AuditLogEntry,
  AuditLogRepositoryPort,
} from '../../../src/domain/ports/outbound/AuditLogRepositoryPort.js';
import type { SubscriptionPlan } from '@ubuntu-fund/types';

function makeAuditSpy() {
  const entries: AuditLogEntry[] = [];
  const repo: AuditLogRepositoryPort = {
    async record(e) {
      entries.push(e);
    },
  };
  return { repo, entries };
}

const basePlan = (over: Partial<SubscriptionPlan> = {}): SubscriptionPlan =>
  ({
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 149,
    priceYearly: 1490,
    platformFeePercent: 2.5,
    maxActiveCampaigns: 10,
    maxCampaignGoal: 250000,
    ...over,
  }) as unknown as SubscriptionPlan;

describe('Sensitive money-config change auditing (ADR-5)', () => {
  it('records the old→new diff of a plan pricing/fee change', async () => {
    const { repo, entries } = makeAuditSpy();
    const before = basePlan();
    const after = basePlan({ platformFeePercent: 0, priceMonthly: 99 });
    const planRepo = {
      async findByTier() {
        return before;
      },
      async seedDefaults() {},
      async update() {
        return after;
      },
    } as unknown as SubscriptionPlanRepositoryPort;

    const useCase = new UpdatePlanUseCase(planRepo, repo);
    await useCase.execute(
      'pro',
      { platformFeePercent: 0, priceMonthly: 99 },
      { userId: 'admin-1', role: 'admin' }
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.action).toBe('subscription-plan.update');
    expect(entries[0]!.resource).toBe('plan:pro');
    expect(entries[0]!.actorId).toBe('admin-1');
    const changed = Object.fromEntries(
      (entries[0]!.changes ?? []).map((c) => [c.field, [c.before, c.after]])
    );
    expect(changed.platformFeePercent).toEqual([2.5, 0]);
    expect(changed.priceMonthly).toEqual([149, 99]);
  });

  it('does not audit when nothing actually changed', async () => {
    const { repo, entries } = makeAuditSpy();
    const plan = basePlan();
    const planRepo = {
      async findByTier() {
        return plan;
      },
      async seedDefaults() {},
      async update() {
        return plan; // unchanged
      },
    } as unknown as SubscriptionPlanRepositoryPort;

    await new UpdatePlanUseCase(planRepo, repo).execute(
      'pro',
      { platformFeePercent: 2.5 },
      { userId: 'admin-1', role: 'admin' }
    );
    expect(entries).toHaveLength(0);
  });

  it('records a compliance-limit change with the before/after and reason', async () => {
    const { repo, entries } = makeAuditSpy();
    const user = {
      id: 'user-9',
      complianceApprovedCampaignLimit: undefined as number | undefined,
      setComplianceApprovedCampaignLimit(v: number | undefined) {
        this.complianceApprovedCampaignLimit = v;
      },
    };
    const userRepo = {
      async findById() {
        return user;
      },
      async update() {
        return user;
      },
    } as unknown as UserRepositoryPort;

    await new SetComplianceLimitUseCase(userRepo, repo).execute({
      userId: 'user-9',
      limit: 500000,
      actorId: 'admin-2',
      actorRole: 'admin',
      reason: 'KYB approved for large campaign',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.action).toBe('compliance-limit.set');
    expect(entries[0]!.reason).toBe('KYB approved for large campaign');
    expect(entries[0]!.changes).toEqual([
      { field: 'complianceApprovedCampaignLimit', before: undefined, after: 500000 },
    ]);
  });
});
