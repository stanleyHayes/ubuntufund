import { describe, it, expect, vi } from 'vitest';
import {
  ReconcilePayoutsUseCase,
  type PayoutWebhookHandler,
} from '../../../src/application/use-cases/ReconcilePayoutsUseCase.js';
import type { PayoutRepositoryPort } from '../../../src/domain/ports/outbound/PayoutRepositoryPort.js';
import type { BeneficiaryPayoutRepositoryPort } from '../../../src/domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js';
import type { AffiliatePayoutRepositoryPort } from '../../../src/domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import type { PaymentGatewayPort } from '../../../src/domain/ports/outbound/PaymentGatewayPort.js';

function handlerSpy(): PayoutWebhookHandler & {
  calls: { m: string; ref: string }[];
} {
  const calls: { m: string; ref: string }[] = [];
  return {
    calls,
    async handleSuccess(ref) {
      calls.push({ m: 'success', ref });
    },
    async handleFailed(ref) {
      calls.push({ m: 'failed', ref });
    },
    async handleReversed(ref) {
      calls.push({ m: 'reversed', ref });
    },
  };
}

const stuckPayout = (providerRef: string) => ({ providerRef }) as never;
const batchedPayout = (legs: { reference: string; status: string }[]) =>
  ({ legs }) as never;

function build(opts: {
  campaignRefs: string[];
  beneficiaryRefs?: string[];
  affiliateRefs?: string[];
  batched?: { reference: string; status: string }[][];
  verify: (ref: string) => { status: string };
  configured?: boolean;
}) {
  const campaignHandler = handlerSpy();
  const beneficiaryHandler = handlerSpy();
  const affiliateHandler = handlerSpy();
  const payoutRepo = {
    async findStuckProcessing() {
      return opts.campaignRefs.map(stuckPayout);
    },
    async findStuckBatchedProcessing() {
      return (opts.batched ?? []).map(batchedPayout);
    },
    async findTerminalUnsettled() {
      return [];
    },
  } as unknown as PayoutRepositoryPort;
  const beneficiaryRepo = {
    async findStuckProcessing() {
      return (opts.beneficiaryRefs ?? []).map(stuckPayout);
    },
    async findTerminalUnsettled() {
      return [];
    },
  } as unknown as BeneficiaryPayoutRepositoryPort;
  const affiliateRepo = {
    async findStuckProcessing() {
      return (opts.affiliateRefs ?? []).map(stuckPayout);
    },
    async findTerminalUnsettled() {
      return [];
    },
  } as unknown as AffiliatePayoutRepositoryPort;
  const gateway = {
    isConfigured: () => opts.configured ?? true,
    verifyTransfer: vi.fn(async (ref: string) => ({
      transferCode: 't',
      reference: ref,
      raw: {},
      ...opts.verify(ref),
    })),
  } as unknown as PaymentGatewayPort;

  const useCase = new ReconcilePayoutsUseCase(
    payoutRepo,
    beneficiaryRepo,
    affiliateRepo,
    campaignHandler,
    beneficiaryHandler,
    affiliateHandler,
    gateway
  );
  return { useCase, campaignHandler, beneficiaryHandler, affiliateHandler, gateway };
}

describe('ReconcilePayoutsUseCase', () => {
  it('settles a stuck payout the provider reports as success', async () => {
    const { useCase, campaignHandler } = build({
      campaignRefs: ['pout-1'],
      verify: () => ({ status: 'success' }),
    });
    const summary = await useCase.reconcileStale({ olderThanMinutes: 30 });
    expect(summary.scanned).toBe(1);
    expect(summary.settled).toBe(1);
    expect(campaignHandler.calls).toEqual([{ m: 'success', ref: 'pout-1' }]);
  });

  it('drives failed/reversed and leaves pending untouched', async () => {
    const { useCase, campaignHandler } = build({
      campaignRefs: ['a', 'b', 'c'],
      verify: (ref) =>
        ({ a: { status: 'failed' }, b: { status: 'reversed' }, c: { status: 'pending' } }[ref]!),
    });
    const summary = await useCase.reconcileStale({ olderThanMinutes: 30 });
    expect(summary).toMatchObject({ scanned: 3, failed: 1, reversed: 1, pending: 1, settled: 0 });
    expect(campaignHandler.calls).toEqual([
      { m: 'failed', ref: 'a' },
      { m: 'reversed', ref: 'b' },
    ]);
  });

  it('reconciles both the campaign and beneficiary rails', async () => {
    const { useCase, campaignHandler, beneficiaryHandler } = build({
      campaignRefs: ['pout-x'],
      beneficiaryRefs: ['bpay-y'],
      verify: () => ({ status: 'success' }),
    });
    const summary = await useCase.reconcileStale({ olderThanMinutes: 30 });
    expect(summary.settled).toBe(2);
    expect(campaignHandler.calls).toEqual([{ m: 'success', ref: 'pout-x' }]);
    expect(beneficiaryHandler.calls).toEqual([{ m: 'success', ref: 'bpay-y' }]);
  });

  it('counts a verify error without throwing', async () => {
    const { useCase } = build({
      campaignRefs: ['boom'],
      verify: () => {
        throw new Error('provider 502');
      },
    });
    const summary = await useCase.reconcileStale({ olderThanMinutes: 30 });
    expect(summary).toMatchObject({ scanned: 1, errored: 1, settled: 0 });
  });

  it('reconciles the affiliate rail', async () => {
    const { useCase, affiliateHandler } = build({
      campaignRefs: [],
      affiliateRefs: ['aff-1'],
      verify: () => ({ status: 'success' }),
    });
    const summary = await useCase.reconcileStale({ olderThanMinutes: 30 });
    expect(summary.settled).toBe(1);
    expect(affiliateHandler.calls).toEqual([{ m: 'success', ref: 'aff-1' }]);
  });

  it('reconciles each still-in-flight leg of a batched payout, skipping terminal legs', async () => {
    const { useCase, campaignHandler } = build({
      campaignRefs: [],
      batched: [
        [
          { reference: 'leg-a', status: 'submitted' },
          { reference: 'leg-b', status: 'success' }, // terminal → skipped
          { reference: 'leg-c', status: 'queued' },
        ],
      ],
      verify: (ref) => ({ a: { status: 'success' }, c: { status: 'failed' } }[ref[4]!]!),
    });
    const summary = await useCase.reconcileStale({ olderThanMinutes: 30 });
    expect(summary.scanned).toBe(2); // only leg-a + leg-c
    expect(campaignHandler.calls).toEqual([
      { m: 'success', ref: 'leg-a' },
      { m: 'failed', ref: 'leg-c' },
    ]);
  });

  it('no-ops when the gateway is not configured', async () => {
    const { useCase, gateway } = build({
      campaignRefs: ['x'],
      verify: () => ({ status: 'success' }),
      configured: false,
    });
    const summary = await useCase.reconcileStale({ olderThanMinutes: 30 });
    expect(summary.scanned).toBe(0);
    expect(gateway.verifyTransfer).not.toHaveBeenCalled();
  });
});
