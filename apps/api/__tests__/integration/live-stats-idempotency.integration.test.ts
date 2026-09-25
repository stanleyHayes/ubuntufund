import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DonationSucceededPayload, OutboxRecord } from '@ubuntu-fund/types';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { LiveSessionModel } from '../../src/infrastructure/database/models/LiveSessionModel.js';
import { OutboxModel } from '../../src/infrastructure/database/models/OutboxModel.js';
import { EventBus, campaignChannel, liveChannel } from '../../src/infrastructure/realtime/EventBus.js';
import { RealtimeDonationProjector } from '../../src/application/services/RealtimeDonationProjector.js';
import { OutboxDispatcher } from '../../src/application/services/OutboxDispatcher.js';
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoLiveSessionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLiveSessionRepository.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { MongoDonationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { MongoOutboxRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoOutboxRepository.js';
import type { OutboxRepositoryPort } from '../../src/domain/ports/outbound/OutboxRepositoryPort.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

/** A public campaign with an active live session and one settled donation of 100. */
async function liveDonation() {
  const r = await request(app).post('/api/v1/auth/register').send({ name: 'Host', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const owner = { id: r.body.data.user.id as string, token: `Bearer ${r.body.data.tokens.accessToken}` };
  await UserModel.findByIdAndUpdate(owner.id, { verificationLevel: 2 });
  const created = await request(app).post('/api/v1/campaigns').set('Authorization', owner.token).send({ title: 'Community fundraiser', description: 'A community fundraiser with a live broadcast.', goalAmount: 400, currency: 'GHS', category: 'community', priority: 'normal', beneficiaries: ['Community'], endDate: new Date(Date.now() + 7 * 86400000).toISOString() }).expect(201);
  const campaignId = created.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active', raisedAmount: 100 });
  const session = await LiveSessionModel.create({ campaignId, title: 'Live fundraiser', status: 'active', overlayToken: randomUUID(), startedAt: new Date() });
  const donation = await DonationModel.create({ campaignId, donorId: owner.id, amount: 100, currency: 'GHS', paymentMethod: 'wallet', isAnonymous: true });
  const payload: DonationSucceededPayload = { donationId: donation.id, donationIntentId: randomUUID(), campaignId, liveSessionId: session.id, donorId: owner.id, amount: 100, currency: 'GHS', isAnonymous: true, createdAt: new Date().toISOString() };
  return { campaignId, sessionId: session.id as string, donationId: donation.id as string, payload };
}

function projectorWith(bus: EventBus) {
  return new RealtimeDonationProjector(bus, new MongoCampaignRepository(), new MongoLiveSessionRepository(), new MongoUserRepository());
}

async function stats(sessionId: string) {
  return (await LiveSessionModel.findById(sessionId).lean())!.stats;
}

const input = (payload: DonationSucceededPayload) => ({ donationId: payload.donationId, donorId: payload.donorId, amount: payload.amount, currency: payload.currency, isAnonymous: true, createdAt: new Date(payload.createdAt) });

describe('live-session stats under at-least-once delivery', () => {
  it('credits a donation to the session once however often and however concurrently it is delivered', async () => {
    const { campaignId, sessionId, payload } = await liveDonation();
    const bus = new EventBus();
    const projector = projectorWith(bus);
    await projector.recordDonationRealtime(campaignId, sessionId, input(payload));
    await projector.recordDonationRealtime(campaignId, sessionId, input(payload));
    await Promise.all([1, 2, 3, 4].map(() => projector.recordDonationRealtime(campaignId, sessionId, input(payload))));

    expect(await stats(sessionId)).toMatchObject({ successfulDonations: 1, amountRaised: 100 });
    expect((await DonationModel.findById(payload.donationId))?.liveStatsAppliedAt).toBeInstanceOf(Date);
    // Replays refresh totals but never re-announce the gift or re-fire milestones.
    const live = bus.getBufferedEvents(liveChannel(sessionId));
    expect(live.filter(e => e.type === 'donation')).toHaveLength(1);
    expect(live.filter(e => e.type === 'milestone').map(e => (e.data as { percent: number }).percent)).toEqual([25]);
    expect(live.filter(e => e.type === 'total').length).toBeGreaterThan(1);
    const campaign = bus.getBufferedEvents(campaignChannel(campaignId));
    expect(campaign.filter(e => e.type === 'donation')).toHaveLength(1);
  });

  it('never publishes the session total on the public campaign channel', async () => {
    const { campaignId, sessionId, payload } = await liveDonation();
    await LiveSessionModel.updateOne({ _id: sessionId }, { $set: { showAmounts: false } });
    const bus = new EventBus();
    await projectorWith(bus).recordDonationRealtime(campaignId, sessionId, input(payload));
    const total = bus.getBufferedEvents(campaignChannel(campaignId)).find(e => e.type === 'total')!.data as Record<string, unknown>;
    expect(total).toMatchObject({ campaignId, raisedAmount: 100, goalAmount: 400 });
    expect(total).not.toHaveProperty('sessionAmountRaised');
    expect(total).not.toHaveProperty('liveSessionId');
    // The token-gated session channel still carries it, masked for the host's choice.
    const liveTotal = bus.getBufferedEvents(liveChannel(sessionId)).find(e => e.type === 'total')!.data as Record<string, unknown>;
    expect(liveTotal.sessionAmountRaised).toBeNull();
  });

  it('ignores a malformed or unknown session id without failing the projection', async () => {
    const { campaignId, payload } = await liveDonation();
    const bus = new EventBus();
    await projectorWith(bus).recordDonationRealtime(campaignId, 'not-a-session', input(payload));
    await projectorWith(bus).recordDonationRealtime(campaignId, '000000000000000000000000', input({ ...payload, donationId: (await DonationModel.create({ campaignId, donorId: 'guest', amount: 5, currency: 'GHS', paymentMethod: 'card', isAnonymous: true })).id }));
    expect(bus.getBufferedEvents(campaignChannel(campaignId)).filter(e => e.type === 'donation')).toHaveLength(2);
  });

  it('does not double-count when marking the outbox row dispatched fails and the sweep re-runs it', async () => {
    const { sessionId, payload } = await liveDonation();
    const repo = new MongoOutboxRepository();
    const flaky: OutboxRepositoryPort = {
      enqueue: i => repo.enqueue(i),
      claim: (id, ms) => repo.claim(id, ms),
      claimNextPending: (before, ms) => repo.claimNextPending(before, ms),
      recordAttempt: id => repo.recordAttempt(id),
      markDispatched: vi.fn().mockRejectedValueOnce(new Error('write failed')).mockImplementation((id: string, lease: string) => repo.markDispatched(id, lease)),
    };
    // leaseMs 0: the failed dispatch's lease is immediately reclaimable.
    const dispatcher = new OutboxDispatcher(flaky, projectorWith(new EventBus()), new MongoDonationRepository(), { leaseMs: 0, sweepMinAgeMs: 0 });
    const record = await repo.enqueue({ type: 'donation.succeeded', payload });
    await dispatcher.dispatch(record);
    expect(await OutboxModel.findById(record.id).lean()).toMatchObject({ status: 'pending', attempts: 1 });
    expect(await stats(sessionId)).toMatchObject({ successfulDonations: 1, amountRaised: 100 });

    expect(await dispatcher.sweepPending()).toBe(1);
    expect((await OutboxModel.findById(record.id).lean())?.status).toBe('dispatched');
    expect(await stats(sessionId)).toMatchObject({ successfulDonations: 1, amountRaised: 100 });
    expect(await dispatcher.sweepPending()).toBe(0);
  });

  it('runs a row once when sweeps race the in-process dispatch, and leaves fresh rows to it', async () => {
    const { payload } = await liveDonation();
    const repo = new MongoOutboxRepository();
    const recordDonationRealtime = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    const projector = { recordDonationRealtime } as unknown as RealtimeDonationProjector;
    const record: OutboxRecord = await repo.enqueue({ type: 'donation.succeeded', payload });

    // Default sweep age: a just-committed row belongs to the in-process dispatch.
    expect(await new OutboxDispatcher(repo, projector, new MongoDonationRepository()).sweepPending()).toBe(0);

    const eager = new OutboxDispatcher(repo, projector, new MongoDonationRepository(), { sweepMinAgeMs: 0 });
    const other = new OutboxDispatcher(repo, projector, new MongoDonationRepository(), { sweepMinAgeMs: 0 });
    await Promise.all([eager.dispatch(record), eager.sweepPending(), other.sweepPending(), other.dispatch(record)]);
    expect(recordDonationRealtime).toHaveBeenCalledTimes(1);
    const row = await OutboxModel.findById(record.id).lean();
    expect(row).toMatchObject({ status: 'dispatched' });
    expect(row?.leaseToken).toBeUndefined();
    await eager.dispatch({ ...record, status: 'pending' });
    expect(recordDonationRealtime).toHaveBeenCalledTimes(1);
  });
});
