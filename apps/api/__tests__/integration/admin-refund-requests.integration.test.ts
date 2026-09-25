import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { RefundModel } from '../../src/infrastructure/database/models/RefundModel.js';
import { RefundOperationModel } from '../../src/infrastructure/database/models/RefundOperationModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';

const NOTE = 'Donor paid twice by mistake; refunding the duplicate charge.';
let app: Express, adminAuth: string, adminId: string;

async function register(label: string) {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: `${label} account`, email: `${label}-${randomUUID()}@example.test`, password: 'SecurePass123',
    legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
  }).expect(201);
  return { id: res.body.data.user.id as string, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}

/** A settled donation linked to its payment through the settlement journal entry, plus the donor's request. */
async function seedRequest(donor: { id: string; auth: string }) {
  const donation = await DonationModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', donorId: donor.id, amount: 200, currency: 'GHS', paymentMethod: 'card' });
  const intent = await DonationIntentModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', amount: 200, currency: 'GHS', donorUserId: donor.id, status: 'SUCCEEDED', provider: 'paystack', providerRef: `ref-${randomUUID()}`, idempotencyKey: randomUUID() });
  await JournalEntryModel.create({ donationId: donation.id, donationIntentId: intent.id, memo: 'settlement', currency: 'GHS' });
  const created = await request(app).post('/api/v1/refunds').set('Authorization', donor.auth).send({ donationId: donation.id, reason: 'Duplicate donation' }).expect(201);
  return { requestId: created.body.data.id as string, intentId: intent.id as string, providerRef: intent.providerRef };
}
const patch = (id: string, body: Record<string, unknown>, auth = adminAuth) =>
  request(app).patch(`/api/v1/admin/refund-requests/${id}`).set('Authorization', auth).send(body);

beforeAll(async () => {
  await connectTestDatabase(); app = await createTestApp(); await RefundModel.init();
  const admin = await register('refund-admin');
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  adminAuth = admin.auth; adminId = admin.id;
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

describe('donor refund request staff queue', () => {
  it('is admin-only', async () => {
    const donor = await register('refund-donor');
    const { requestId } = await seedRequest(donor);
    await request(app).get('/api/v1/admin/refund-requests').expect(401);
    await request(app).get('/api/v1/admin/refund-requests').set('Authorization', donor.auth).expect(403);
    await patch(requestId, { status: 'failed', staffNote: NOTE }, donor.auth).expect(403);
    expect((await RefundModel.findById(requestId))?.status).toBe('pending');
  });

  it('lists requests with the donor, bounded paging and the linked payment', async () => {
    await RefundModel.deleteMany({});
    const donor = await register('refund-listed');
    const { requestId, intentId, providerRef } = await seedRequest(donor);
    const res = await request(app).get('/api/v1/admin/refund-requests?status=pending&pageSize=12').set('Authorization', adminAuth).expect(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      id: requestId, status: 'pending', requesterName: 'refund-listed account', reason: 'Duplicate donation',
      contribution: { id: intentId, status: 'SUCCEEDED', provider: 'paystack', providerRef },
    });
    await request(app).get('/api/v1/admin/refund-requests?pageSize=500').set('Authorization', adminAuth).expect(400);
    await request(app).get('/api/v1/admin/refund-requests?status=approved').set('Authorization', adminAuth).expect(400);
  });

  it('counts open requests in the action centre', async () => {
    await RefundModel.deleteMany({});
    const { requestId } = await seedRequest(await register('refund-count'));
    const count = async () => (await request(app).get('/api/v1/admin/action-center').set('Authorization', adminAuth).expect(200))
      .body.data.items.find((item: { id: string }) => item.id === 'refund-requests');
    expect(await count()).toMatchObject({ count: 1, href: '/refund-requests', resource: 'donations' });
    await patch(requestId, { status: 'failed', staffNote: NOTE }).expect(200);
    expect((await count()).count).toBe(0);
  });

  it('requires a note, moves forward only and writes an audit row per change', async () => {
    const donor = await register('refund-transitions');
    const { requestId } = await seedRequest(donor);
    await patch(requestId, { status: 'processing' }).expect(400);
    await patch(requestId, { status: 'processing', staffNote: 'short' }).expect(400);
    await patch(requestId, { status: 'pending', staffNote: NOTE }).expect(400);

    const processing = await patch(requestId, { status: 'processing', staffNote: NOTE }).expect(200);
    expect(processing.body.data).toMatchObject({ status: 'processing', staffNote: NOTE, reviewedBy: adminId });
    await patch(requestId, { status: 'failed', staffNote: `${NOTE} Provider declined.` }).expect(200);
    await patch(requestId, { status: 'processing', staffNote: NOTE }).expect(409);

    const audit = await AuditLogModel.find({ resource: `refund-request:${requestId}` }).sort({ createdAt: 1 }).lean();
    expect(audit.map((row) => row.action)).toEqual(['refund_request.processing', 'refund_request.failed']);
    expect(audit[0]).toMatchObject({ actorId: adminId, reason: NOTE, changes: [{ field: 'status', before: 'pending', after: 'processing' }] });

    const mine = await request(app).get('/api/v1/refunds/mine').set('Authorization', donor.auth).expect(200);
    expect(mine.body.data.find((row: { id: string }) => row.id === requestId).status).toBe('failed');
  });

  it('completes a request only after its payment shows a refund from the same contribution', async () => {
    const donor = await register('refund-complete');
    const { requestId, intentId } = await seedRequest(donor);
    await patch(requestId, { status: 'completed', staffNote: NOTE }).expect(409);
    expect((await RefundModel.findById(requestId))?.status).toBe('pending');

    await DonationIntentModel.updateOne({ _id: intentId }, { $set: { status: 'REFUNDED', refundedAmountMinor: 20000 } });
    const foreign = await RefundOperationModel.create({ _id: randomUUID(), intentId: 'another-intent', campaignId: 'c', provider: 'paystack', transactionReference: 'x', requestKey: randomUUID(), adminId, amount: 1, amountMinor: 100, cumulativeMinor: 100, maxMinor: 100, currency: 'GHS', beneficiaryNet: 1, platformFee: 0, processorFee: 0, state: 'completed', active: false });
    await patch(requestId, { status: 'completed', staffNote: NOTE, refundOperationId: foreign._id }).expect(400);

    const operation = await RefundOperationModel.create({ _id: randomUUID(), intentId, campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', provider: 'paystack', transactionReference: 'x', requestKey: randomUUID(), adminId, amount: 200, amountMinor: 20000, cumulativeMinor: 20000, maxMinor: 20000, currency: 'GHS', beneficiaryNet: 200, platformFee: 0, processorFee: 0, state: 'completed', active: false });
    const done = await patch(requestId, { status: 'completed', staffNote: NOTE, refundOperationId: operation._id }).expect(200);
    expect(done.body.data).toMatchObject({ status: 'completed', refundOperationId: operation._id, contribution: { status: 'REFUNDED' } });
    await patch(requestId, { status: 'failed', staffNote: NOTE }).expect(409);
  });

  it('lets only one of two concurrent reviewers change a request', async () => {
    const { requestId } = await seedRequest(await register('refund-race'));
    const results = await Promise.all([
      patch(requestId, { status: 'failed', staffNote: NOTE }),
      patch(requestId, { status: 'failed', staffNote: `${NOTE} Second reviewer.` }),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await AuditLogModel.countDocuments({ resource: `refund-request:${requestId}` })).toBe(1);
  });

  it('returns 404 for unknown and malformed ids', async () => {
    await patch('not-an-id', { status: 'failed', staffNote: NOTE }).expect(404);
    await patch('c'.repeat(24), { status: 'failed', staffNote: NOTE }).expect(404);
  });
});
