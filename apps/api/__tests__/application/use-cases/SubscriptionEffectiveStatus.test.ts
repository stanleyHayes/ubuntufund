import { describe, expect, it, vi } from 'vitest';
import { BillingCycle, SubscriptionStatus, SubscriptionTier, type Subscription } from '@ubuntu-fund/types';
import { GetMySubscriptionUseCase } from '../../../src/application/use-cases/GetMySubscriptionUseCase.js';
import { ListSubscriptionsUseCase } from '../../../src/application/use-cases/ListSubscriptionsUseCase.js';
import { isPaidPlanInForce, withEffectiveStatus } from '../../../src/domain/services/subscriptionStatus.js';

const DAY = 86_400_000;
const row = (over: Partial<Subscription> = {}): Subscription => ({
  id: 'subscription', userId: 'owner', tier: SubscriptionTier.PRO, status: SubscriptionStatus.ACTIVE,
  billingCycle: BillingCycle.MONTHLY, currentPeriodStart: new Date(Date.now() - 40 * DAY),
  currentPeriodEnd: new Date(Date.now() - DAY), cancelAtPeriodEnd: false,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});
const repo = (subscription: Subscription | null) => ({
  findByUserId: vi.fn(async () => subscription), save: vi.fn(async (s: Subscription) => s),
  findAll: vi.fn(async () => ({ items: subscription ? [subscription] : [], total: subscription ? 1 : 0 })),
});

describe('effective subscription status (read-time expiry)', () => {
  it('reports a lapsed paid web plan as expired without writing it', async () => {
    const r = repo(row());
    const result = await new GetMySubscriptionUseCase(r as never).execute('owner');
    expect(result.status).toBe(SubscriptionStatus.EXPIRED);
    expect(result.tier).toBe(SubscriptionTier.PRO);
    expect(r.save).not.toHaveBeenCalled();
  });

  it('keeps a paid plan inside its period active', async () => {
    const result = await new GetMySubscriptionUseCase(repo(row({ currentPeriodEnd: new Date(Date.now() + DAY) })) as never).execute('owner');
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('never expires the Free plan, whose lazily provisioned period is never refreshed', async () => {
    const result = await new GetMySubscriptionUseCase(repo(row({ tier: SubscriptionTier.FREE })) as never).execute('owner');
    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('expires an ended trial and leaves cancelled/past-due statuses untouched', () => {
    expect(withEffectiveStatus(row({ status: SubscriptionStatus.TRIALING, currentPeriodEnd: new Date(Date.now() + DAY), trialEnd: new Date(Date.now() - 1) })).status)
      .toBe(SubscriptionStatus.EXPIRED);
    expect(withEffectiveStatus(row({ status: SubscriptionStatus.PAST_DUE })).status).toBe(SubscriptionStatus.PAST_DUE);
    expect(isPaidPlanInForce(row({ currentPeriodEnd: new Date(Date.now() + DAY) }))).toBe(true);
    expect(isPaidPlanInForce(row({ tier: SubscriptionTier.FREE, currentPeriodEnd: new Date(Date.now() + DAY) }))).toBe(false);
  });

  it('shows staff the same derived status in the admin list', async () => {
    const users = { findById: vi.fn(async () => ({ name: 'Member', email: { value: 'member@example.test' } })) };
    const result = await new ListSubscriptionsUseCase(repo(row()) as never, users as never).execute({ page: 1, pageSize: 10 });
    expect(result.items[0]).toMatchObject({ status: SubscriptionStatus.EXPIRED, userName: 'Member' });
  });
});
