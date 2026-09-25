import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { LiveSessionModel } from '../../src/infrastructure/database/models/LiveSessionModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { UserBlockModel } from '../../src/infrastructure/database/models/UserBlockModel.js';
import { MongoLiveSafety } from '../../src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { MongoUserBlockRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserBlockRepository.js';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function user(name: string) {
  const r = await request(app).post('/api/v1/auth/register').send({ name, email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: r.body.data.user.id, token: `Bearer ${r.body.data.tokens.accessToken}` };
}
async function live(owner: { id: string; token: string }) {
  await UserModel.findByIdAndUpdate(owner.id, { verificationLevel: 2 });
  const r = await request(app).post('/api/v1/campaigns').set('Authorization', owner.token).send({ title: 'Community fundraiser', description: 'A community fundraiser with a live broadcast.', goalAmount: 5000, currency: 'GHS', category: 'community', priority: 'normal', beneficiaries: ['Community'], endDate: new Date(Date.now() + 7 * 86400000).toISOString() }).expect(201);
  return LiveSessionModel.create({ campaignId: r.body.data.id, title: 'Live fundraiser', status: 'active', overlayToken: 'private-overlay', startedAt: new Date() });
}
it('denies blocked live reads/tokens and moderates a report without leaving the public overlay accessible', async () => {
  const owner = await user('Host'), viewer = await user('Viewer'), admin = await user('Moderator');
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  const session = await live(owner);
  const path = `/api/v1/live-sessions/${session.id}`;
  const visible = await request(app).get(`${path}/public`).set('Authorization', viewer.token).expect(200);
  expect(visible.body.data.creatorId).toBe(owner.id);
  await request(app).put(`/api/v1/safety/blocks/${owner.id}`).set('Authorization', viewer.token).expect(200);
  await request(app).get(`${path}/public`).set('Authorization', viewer.token).expect(404);
  await request(app).post(`${path}/video/viewer-token`).set('Authorization', viewer.token).expect(404);
  await request(app).get(`/api/v1/campaigns/${session.campaignId}/active-live`).set('Authorization', viewer.token).expect(404);
  const report = await request(app).post('/api/v1/safety/reports').set('Authorization', viewer.token).send({ targetType: 'live', targetId: session.id, reason: 'violence', description: 'Please review violence in this broadcast.' }).expect(201);
  await request(app).put(`/api/v1/admin/safety-reports/${report.body.data.id}/review`).set('Authorization', admin.token).send({ action: 'stop_live', notes: 'Broadcast reviewed and ended for violating the safety policy.' }).expect(200);
  expect((await SafetyReportModel.findById(report.body.data.id))?.status).toBe('resolved');
  const stopped = await LiveSessionModel.findById(session.id);
  expect(stopped).toMatchObject({ status: 'ended', overlayToken: '', providerStopPending: false });
  await request(app).get(`${path}/public`).expect(404);
  await request(app).get(`${path}/overlay?token=private-overlay`).expect(404);
});
it('persists provider failures and retries both stopping and participant eviction after restart', async () => {
  const owner = await user('Retry host'), viewer = await user('Retry viewer');
  const session = await live(owner), blocks = new MongoUserBlockRepository();
  const safety = new MongoLiveSafety(blocks);
  const provider = { removeIdentity: vi.fn().mockResolvedValue(undefined), closeRoom: vi.fn().mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValue(undefined) };
  await expect(safety.stop(session.id, provider)).rejects.toThrow('Provider unavailable');
  expect((await LiveSessionModel.findById(session.id))?.providerStopPending).toBe(true);
  await expect(safety.assertSessionVisible(session.id)).rejects.toMatchObject({ statusCode: 404 });
  await new MongoLiveSafety(blocks).reconcile(provider);
  expect((await LiveSessionModel.findById(session.id))?.providerStopPending).toBe(false);
  expect(provider.removeIdentity).toHaveBeenCalledWith(session.id, `host-${owner.id}`);
  const other = await LiveSessionModel.create({ campaignId: session.campaignId, title: 'Another broadcast', status: 'active', overlayToken: 'new-overlay', startedAt: new Date() });
  await blocks.block(owner.id, viewer.id);
  provider.removeIdentity.mockRejectedValueOnce(new Error('Provider unavailable'));
  await expect(safety.enforceBlock(owner.id, viewer.id, provider)).rejects.toThrow('Provider unavailable');
  expect((await UserBlockModel.findOne({ userId: owner.id, blockedUserId: viewer.id }))?.providerCleanupPending).toBe(true);
  await new MongoLiveSafety(blocks).reconcile(provider);
  expect((await UserBlockModel.findOne({ userId: owner.id, blockedUserId: viewer.id }))?.providerCleanupPending).toBe(false);
  expect(provider.removeIdentity).toHaveBeenCalledWith(other.id, `viewer-${viewer.id}`);
});
it('does not mark a previously issued provider room clean when credentials are missing', async () => {
  const owner = await user('Credential recovery host');
  const session = await live(owner);
  await LiveSessionModel.updateOne({ _id: session.id }, { $set: { providerRoomIssuedAt: new Date() } });
  const safety = new MongoLiveSafety(new MongoUserBlockRepository());
  const provider = { enabled: false, removeIdentity: vi.fn().mockResolvedValue(undefined), closeRoom: vi.fn().mockResolvedValue(undefined) };
  await expect(safety.stop(session.id, provider)).rejects.toMatchObject({ statusCode: 503 });
  expect(provider.closeRoom).not.toHaveBeenCalled();
  expect((await LiveSessionModel.findById(session.id))?.providerStopPending).toBe(true);
  await safety.reconcile({ ...provider, enabled: true });
  expect((await LiveSessionModel.findById(session.id))?.providerStopPending).toBe(false);
});
async function openCampaign(owner: { id: string; token: string }, patch: Record<string, unknown> = {}) {
  const session = await live(owner);
  await CampaignModel.updateOne({ _id: session.campaignId }, { $set: { status: 'active', ...patch } });
  return session;
}
it('ends a broadcast before touching the provider, revokes the host and retries provider failures', async () => {
  const owner = await user('Ending host');
  const session = await openCampaign(owner);
  const safety = new MongoLiveSafety(new MongoUserBlockRepository());
  const statusAtCall: string[] = [];
  const provider = {
    enabled: true,
    removeIdentity: vi.fn(async () => { statusAtCall.push(String((await LiveSessionModel.findById(session.id))?.status)); }),
    closeRoom: vi.fn(async () => { statusAtCall.push(String((await LiveSessionModel.findById(session.id))?.status)); throw new Error('Provider unavailable'); }),
  };
  expect(await safety.end(session.id, provider)).toBe(true);
  // Persisted first: join() refuses new tokens before any provider call runs.
  expect(statusAtCall).toEqual(['ended', 'ended']);
  expect(provider.removeIdentity).toHaveBeenCalledWith(session.id, `host-${owner.id}`);
  const ended = await LiveSessionModel.findById(session.id);
  // A normal end is not a moderation stop: the overlay link keeps working to show "ended".
  expect(ended).toMatchObject({ status: 'ended', providerStopPending: true, overlayToken: 'private-overlay' });
  expect(ended?.endedAt).toBeInstanceOf(Date);
  expect(ended?.moderationStoppedAt).toBeUndefined();
  expect(await safety.end(session.id, provider)).toBe(false);
  expect(provider.removeIdentity).toHaveBeenCalledTimes(1);
  provider.closeRoom.mockResolvedValue(undefined);
  await safety.reconcile(provider);
  expect((await LiveSessionModel.findById(session.id))?.providerStopPending).toBe(false);
  await request(app).get(`/api/v1/live-sessions/${session.id}/public`).expect(200).expect(res => expect(res.body.data.status).toBe('ended'));
});
it('ends a session through PATCH even when the provider is down', async () => {
  const owner = await user('Patch host');
  const session = await openCampaign(owner);
  await LiveSessionModel.updateOne({ _id: session.id }, { $set: { providerRoomIssuedAt: new Date() } });
  // Test env has no LiveKit credentials: the provider cleanup cannot run yet.
  const res = await request(app).patch(`/api/v1/live-sessions/${session.id}`).set('Authorization', owner.token).send({ status: 'ended' }).expect(200);
  expect(res.body.data.status).toBe('ended');
  expect(await LiveSessionModel.findById(session.id)).toMatchObject({ status: 'ended', providerStopPending: true });
});
