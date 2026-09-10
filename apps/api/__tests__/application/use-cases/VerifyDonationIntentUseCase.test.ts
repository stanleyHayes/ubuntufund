import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DonationIntentEntity } from '../../../src/domain/entities/DonationIntent.js';
import { VerifyDonationIntentUseCase } from '../../../src/application/use-cases/VerifyDonationIntentUseCase.js';
import { ReconcilePaymentsUseCase } from '../../../src/application/use-cases/ReconcilePaymentsUseCase.js';
import { SettleDonationUseCase } from '../../../src/application/use-cases/SettleDonationUseCase.js';
import { FeePolicy } from '../../../src/application/services/FeePolicy.js';
import type { DonationIntentStatus } from '@ubuntu-fund/types';
import express from 'express';
import request from 'supertest';
import { DonationIntentController } from '../../../src/infrastructure/adapters/inbound/http/controllers/DonationIntentController.js';
import { createDonationIntentRoutes } from '../../../src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.js';
import { errorHandler } from '../../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';

// Exercise the real verification -> reconciliation -> settlement chain without
// network calls or a shared database. Repositories model the atomic status gate.
describe('Hosted donation callback verification', () => {
  const id = '6aa272f4e7e8bad11bb22be2';
  const reference = `uf-${id}-fe8b8617`;
  let state: DonationIntentStatus;
  let gateway: { isConfigured: ReturnType<typeof vi.fn>; verifyTransaction: ReturnType<typeof vi.fn> };
  let save: ReturnType<typeof vi.fn>;
  let journal: ReturnType<typeof vi.fn>;
  let project: ReturnType<typeof vi.fn>;
  let verify: VerifyDonationIntentUseCase;
  let findById: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = 'PENDING';
    const entity = () => new DonationIntentEntity({
      id, campaignId: 'campaign', amount: 200, tip: 50, currency: 'GHS',
      status: state, provider: 'paystack', providerRef: reference,
      donorUserId: null, donorEmail: 'private@example.test', isAnonymous: false,
      idempotencyKey: 'private-key', createdAt: new Date(), updatedAt: new Date(),
    });
    findById = vi.fn(async () => entity());
    const repo = {
      findById,
      transitionToSucceeded: vi.fn(async () => {
        if (state !== 'PENDING' && state !== 'CREATED') return null;
        state = 'SUCCEEDED';
        return entity();
      }),
      markFailedIfPending: vi.fn(async () => {
        if (state !== 'PENDING') return null;
        state = 'FAILED';
        return entity();
      }),
      recordSettlementFinancials: vi.fn(),
    };
    gateway = {
      isConfigured: vi.fn(() => true),
      verifyTransaction: vi.fn(async () => ({status:'success',reference,amount:250,fees:4.88,currency:'GHS',raw:{}})),
    };
    save = vi.fn(async (donation) => donation);
    journal = vi.fn();
    project = vi.fn();
    const settle = new SettleDonationUseCase(
      repo as never, {save} as never, {execute:journal} as never,
      {projectDonation:project} as never,
      {enqueue:vi.fn(async () => ({id:'outbox'}))} as never,
      {dispatch:vi.fn()} as never
    );
    const reconcile = new ReconcilePaymentsUseCase(
      new Map([['paystack',gateway]]) as never, repo as never,
      {record:vi.fn()} as never, new FeePolicy({platformFeePercent:0,paystackFeePercent:1.95,paystackFlatFee:0}), settle,
      {platformFeePercentForCampaign:vi.fn(async () => 0)} as never
    );
    verify = new VerifyDonationIntentUseCase(repo as never, reconcile);
  });

  it('settles a provider-confirmed test payment even when no webhook arrives', async () => {
    const result = await verify.execute(id, reference);
    expect(result.status).toBe('SUCCEEDED');
    expect(gateway.verifyTransaction).toHaveBeenCalledWith(reference);
    expect(save).toHaveBeenCalledTimes(1);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(project).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('donorEmail');
    expect(result).not.toHaveProperty('idempotencyKey');
    expect(result).not.toHaveProperty('providerRef');
  });

  it('exposes verification to guest callbacks through a validated, no-store HTTP endpoint', async () => {
    const app = express();
    app.use(express.json());
    const controller = new DonationIntentController({} as never,{} as never,{} as never,{} as never,verify);
    app.use('/donation-intents',createDonationIntentRoutes(controller,((_req,_res,next) => next()) as never));
    app.use(errorHandler);
    await request(app).post(`/donation-intents/${id}/verify`).send({}).expect(400);
    const res = await request(app).post(`/donation-intents/${id}/verify`).send({reference}).expect(200);
    expect(res.body.data.status).toBe('SUCCEEDED');
    expect(res.headers['cache-control']).toBe('no-store');
    await request(app).post(`/donation-intents/${id}/verify`).send({reference:'wrong'}).expect(404);
    expect(journal).toHaveBeenCalledTimes(1);
  });

  it('does not double-credit simultaneous callbacks or later repeats', async () => {
    await Promise.all([verify.execute(id, reference), verify.execute(id, reference)]);
    await verify.execute(id, reference);
    expect(state).toBe('SUCCEEDED');
    expect(save).toHaveBeenCalledTimes(1);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(project).toHaveBeenCalledTimes(1);
  });

  it('rejects a reference belonging to another payment before contacting Paystack', async () => {
    await expect(verify.execute(id, 'another-reference')).rejects.toMatchObject({statusCode:404});
    expect(gateway.verifyTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown intent', async () => {
    findById.mockResolvedValue(null);
    await expect(verify.execute(id, reference)).rejects.toMatchObject({statusCode:404});
  });

  it.each([
    {amount:249}, {currency:'USD'}, {reference:'different-reference'},
    {amount:NaN}, {fees:NaN}, {fees:-1}, {fees:251},
  ])('never credits mismatched provider data: %j', async patch => {
    gateway.verifyTransaction.mockResolvedValue({status:'success',reference,amount:250,fees:4.88,currency:'GHS',raw:{},...patch});
    expect((await verify.execute(id,reference)).status).toBe('PENDING');
    expect(journal).not.toHaveBeenCalled();
  });

  it('leaves a transient provider error retryable', async () => {
    gateway.verifyTransaction.mockRejectedValueOnce(new Error('timeout'));
    expect((await verify.execute(id,reference)).status).toBe('PENDING');
    expect((await verify.execute(id,reference)).status).toBe('SUCCEEDED');
  });

  it('records provider failure without granting value', async () => {
    gateway.verifyTransaction.mockResolvedValue({status:'failed'});
    expect((await verify.execute(id,reference)).status).toBe('FAILED');
    expect(journal).not.toHaveBeenCalled();
  });

  it.each(['SUCCEEDED','FAILED','EXPIRED','REFUNDED'] as DonationIntentStatus[])('does not reverify terminal status %s', async status => {
    state = status;
    expect((await verify.execute(id,reference)).status).toBe(status);
    expect(gateway.verifyTransaction).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
