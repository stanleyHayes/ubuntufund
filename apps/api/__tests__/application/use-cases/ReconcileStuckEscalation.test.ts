import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReconcilePayoutsUseCase, type PayoutWebhookHandler } from '../../../src/application/use-cases/ReconcilePayoutsUseCase.js';
import { ResolveStuckPayoutUseCase } from '../../../src/application/use-cases/ResolveStuckPayoutUseCase.js';
import { TransferNotFoundError } from '../../../src/domain/errors/TransferNotFoundError.js';
import { PaystackGateway } from '../../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js';

const hours = (h: number) => new Date(Date.now() - h * 3_600_000);
const handler = (): PayoutWebhookHandler & { handleFailed: ReturnType<typeof vi.fn>; handleSuccess: ReturnType<typeof vi.fn>; handleReversed: ReturnType<typeof vi.fn> } =>
  ({ handleSuccess: vi.fn(async () => {}), handleFailed: vi.fn(async () => {}), handleReversed: vi.fn(async () => {}) });

function rails(stuck: { campaign?: unknown[]; creator?: unknown[]; affiliate?: unknown[]; beneficiary?: unknown[] }) {
  const repo = (rows: unknown[] = []) => ({
    findStuckProcessing: vi.fn(async () => rows),
    findStuckBatchedProcessing: vi.fn(async () => []),
    findTerminalUnsettled: vi.fn(async () => []),
    escalateProcessing: vi.fn(async () => true),
  });
  return { campaign: repo(stuck.campaign), beneficiary: repo(stuck.beneficiary), affiliate: repo(stuck.affiliate), creator: repo(stuck.creator) };
}

describe('escalating single transfers the provider cannot confirm', () => {
  it('escalates every rail once a payout has been unverifiable for the full dwell window, and never settles it', async () => {
    const r = rails({
      campaign: [{ id: 'c-old', providerRef: 'pout-old', updatedAt: hours(25) }, { id: 'c-new', providerRef: 'pout-new', updatedAt: hours(2) }],
      beneficiary: [{ id: 'b-old', providerRef: 'bpay-old', updatedAt: hours(30) }],
      affiliate: [{ id: 'a-old', providerRef: 'aff-old', updatedAt: hours(48) }],
      creator: [{ id: 'k-old', providerRef: 'cpay-old', updatedAt: hours(24.5) }],
    });
    const handlers = [handler(), handler(), handler(), handler()];
    const gateway = { isConfigured: () => true, verifyTransfer: vi.fn(async (ref: string) => { throw new TransferNotFoundError(ref); }) };
    const audit = { record: vi.fn(async () => {}) };
    const uc = new ReconcilePayoutsUseCase(r.campaign as never, r.beneficiary as never, r.affiliate as never, handlers[0], handlers[1], handlers[2], gateway as never, handlers[3], r.creator as never, audit);
    const summary = await uc.reconcileStale({ olderThanMinutes: 1 });
    expect(summary.escalated).toBe(4);
    // Staff learn of each escalation from the audit trail, not only a log line.
    expect(audit.record.mock.calls.map(([entry]) => [entry.action, entry.resource, entry.severity])).toEqual([
      ['payout.escalated', 'campaign:c-old', 'critical'],
      ['payout.escalated', 'beneficiary:b-old', 'critical'],
      ['payout.escalated', 'affiliate:a-old', 'critical'],
      ['payout.escalated', 'creator:k-old', 'critical'],
    ]);
    expect(r.campaign.escalateProcessing.mock.calls).toEqual([['c-old']]);
    expect(r.beneficiary.escalateProcessing).toHaveBeenCalledWith('b-old');
    expect(r.affiliate.escalateProcessing).toHaveBeenCalledWith('a-old');
    expect(r.creator.escalateProcessing).toHaveBeenCalledWith('k-old');
    for (const h of handlers) {
      expect(h.handleFailed).not.toHaveBeenCalled();
      expect(h.handleSuccess).not.toHaveBeenCalled();
    }
  });

  it('leaves a verifiable pending transfer in PROCESSING however long it has waited', async () => {
    const r = rails({ campaign: [{ id: 'c-old', providerRef: 'pout-old', updatedAt: hours(72) }] });
    const gateway = { isConfigured: () => true, verifyTransfer: vi.fn(async () => ({ status: 'otp', reference: 'pout-old', transferCode: 't', raw: {} })) };
    const uc = new ReconcilePayoutsUseCase(r.campaign as never, r.beneficiary as never, r.affiliate as never, handler(), handler(), handler(), gateway as never);
    const summary = await uc.reconcileStale({ olderThanMinutes: 1 });
    expect(summary).toMatchObject({ escalated: 0, pending: 1 });
    expect(r.campaign.escalateProcessing).not.toHaveBeenCalled();
  });
});

describe('listing escalated transfers for staff', () => {
  it('merges every rail, oldest first, and is admin-only', async () => {
    const row = (id: string, h: number) => ({ id, amount: 10, currency: 'GHS', providerRef: `ref-${id}`, subject: 's', subjectLabel: 'S', createdAt: hours(h + 1), updatedAt: hours(h) });
    const access = (rows: ReturnType<typeof row>[]) => ({ findById: vi.fn(), reopenForSettlement: vi.fn(), handler: handler(), listEscalated: vi.fn(async () => rows) });
    const uc = new ResolveStuckPayoutUseCase({ isConfigured: () => true } as never, {
      campaign: access([row('c1', 30)]),
      beneficiary: access([]),
      affiliate: access([row('a1', 50)]),
      creator: access([row('k1', 26)]),
    });
    const listed = await uc.listEscalated({ userId: 'admin', role: 'admin' });
    expect(listed.map((r) => [r.rail, r.id])).toEqual([['affiliate', 'a1'], ['campaign', 'c1'], ['creator', 'k1']]);
    await expect(uc.listEscalated({ userId: 'member', role: 'user' })).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('resolving an escalated transfer from the provider outcome', () => {
  const note = 'Checked the Paystack dashboard for this reference.';
  function build(status: string, verify: () => Promise<{ status: string }>) {
    const h = handler();
    const access = {
      findById: vi.fn(async () => ({ id: 'p1', status, providerRef: 'pout-p1' })),
      reopenForSettlement: vi.fn(async () => true),
      handler: h,
    };
    const audit = { record: vi.fn(async () => {}) };
    const uc = new ResolveStuckPayoutUseCase({ isConfigured: () => true, verifyTransfer: vi.fn(verify) } as never, { campaign: access }, audit);
    return { uc, access, h, audit };
  }

  it.each([
    ['not found', async () => { throw new TransferNotFoundError('pout-p1'); }, 'handleFailed'],
    ['failed', async () => ({ status: 'failed' }), 'handleFailed'],
    ['success', async () => ({ status: 'success' }), 'handleSuccess'],
    ['reversed', async () => ({ status: 'reversed' }), 'handleReversed'],
  ] as const)('drives a provider "%s" outcome through the rail settlement handler', async (_label, verify, method) => {
    const { uc, access, h, audit } = build('NEEDS_REVIEW', verify);
    await uc.execute('campaign', 'p1', { userId: 'admin', role: 'admin' }, note);
    expect(access.reopenForSettlement).toHaveBeenCalledWith('p1');
    expect(h[method]).toHaveBeenCalledWith('pout-p1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'payout.stuck_resolved', reason: note }));
  });

  it.each([
    ['still pending at the provider', 'NEEDS_REVIEW', async () => ({ status: 'pending' }), 409],
    ['not awaiting review', 'PROCESSING', async () => ({ status: 'failed' }), 409],
    ['unverifiable for another reason', 'NEEDS_REVIEW', async () => { throw new Error('timeout'); }, 502],
  ] as const)('changes nothing when the payout is %s', async (_label, status, verify, code) => {
    const { uc, access, h } = build(status, verify);
    await expect(uc.execute('campaign', 'p1', { userId: 'admin', role: 'admin' }, note)).rejects.toMatchObject({ statusCode: code });
    expect(access.reopenForSettlement).not.toHaveBeenCalled();
    expect(h.handleFailed).not.toHaveBeenCalled();
  });

  it('requires an admin and a recorded note', async () => {
    const { uc } = build('NEEDS_REVIEW', async () => ({ status: 'failed' }));
    await expect(uc.execute('campaign', 'p1', { userId: 'owner', role: 'user' }, note)).rejects.toMatchObject({ statusCode: 403 });
    await expect(uc.execute('campaign', 'p1', { userId: 'admin', role: 'admin' }, 'short')).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('Paystack transfer verification', () => {
  afterEach(() => vi.unstubAllGlobals());
  const gateway = new PaystackGateway({ secretKey: 'sk_test_fixture', publicKey: '', publicWebUrl: 'http://localhost' });
  it('reports a reference Paystack never received as not found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: false, message: 'Transfer not found' }), { status: 404 })));
    await expect(gateway.verifyTransfer('cpay-missing')).rejects.toBeInstanceOf(TransferNotFoundError);
  });
  it('keeps other refusals generic', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: false, message: 'Invalid key' }), { status: 401 })));
    await expect(gateway.verifyTransfer('cpay-x')).rejects.not.toBeInstanceOf(TransferNotFoundError);
  });
});
