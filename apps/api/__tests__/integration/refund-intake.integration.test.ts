import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { RefundModel } from '../../src/infrastructure/database/models/RefundModel.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await RefundModel.init(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function user() {
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'Refund test', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: res.body.data.user.id, token: `Bearer ${res.body.data.tokens.accessToken}` };
}

it('records the full requested amount without a fee, preserves the donation and rejects unauthorized/duplicate intake', async () => {
  const owner = await user(), other = await user();
  for (const [currency, amount] of [['GHS', 101.23], ['XOF', 1234], ['KWD', 10.123]] as const) {
    const donation = await DonationModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', donorId: owner.id, amount, currency, paymentMethod: 'card' });
    const body = { donationId: donation.id, reason: 'Duplicate donation' };
    await request(app).post('/api/v1/refunds').send(body).expect(401);
    await request(app).post('/api/v1/refunds').set('Authorization', other.token).send(body).expect(404);
    const res = await request(app).post('/api/v1/refunds').set('Authorization', owner.token).send(body).expect(201);
    expect(res.body.data.status).toBe('pending');
    const stored = await RefundModel.findById(res.body.data.id).lean();
    expect(stored).toMatchObject({ amount, fee: 0, netAmount: amount, currency, status: 'pending', requesterId: owner.id });
    expect((await DonationModel.findById(donation.id))?.amount).toBe(amount);
    await request(app).post('/api/v1/refunds').set('Authorization', owner.token).send(body).expect(409);
  }
  const list = await request(app).get('/api/v1/refunds/mine').set('Authorization', owner.token).expect(200);
  expect(list.body.data).toHaveLength(3);
  expect(list.body.data.find((r: { currency: string }) => r.currency === 'KWD')).toMatchObject({ amount: 10.123, status: 'pending' });
});

it('answers concurrent duplicate refund requests with 409, not 500, and stores one refund', async () => {
  const owner = await user();
  // A card gift: wallet-funded gifts are refused at intake (I045, below), so
  // they cannot exercise the duplicate-request race.
  const donation = await DonationModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', donorId: owner.id, amount: 50, currency: 'GHS', paymentMethod: 'card' });
  const body = { donationId: donation.id, reason: 'Duplicate donation' };
  const responses = await Promise.all(Array.from({ length: 5 }, () =>
    request(app).post('/api/v1/refunds').set('Authorization', owner.token).send(body)));
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
  for (const r of responses.filter((r) => r.status === 409)) expect(r.body.message).toBe('Refund already requested for this donation');
  expect(await RefundModel.countDocuments({ donationId: donation.id })).toBe(1);
});

it('preserves historical fee snapshots when a later request uses the free intake policy', async () => {
  const owner = await user();
  const old = await RefundModel.create({ donationId: 'bbbbbbbbbbbbbbbbbbbbbbbb', campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', requesterId: owner.id, reason: 'Other', amount: 100, fee: 2, netAmount: 98, currency: 'GHS', status: 'pending' });
  const donation = await DonationModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', donorId: owner.id, amount: 100, currency: 'GHS', paymentMethod: 'card' });
  await request(app).post('/api/v1/refunds').set('Authorization', owner.token).send({ donationId: donation.id, reason: 'Other' }).expect(201);
  expect(await RefundModel.findById(old.id).lean()).toMatchObject({ fee: 2, netAmount: 98, status: 'pending' });
});

// I045: wallet donations have no refund path yet, so intake must not promise one.
it('refuses refund intake for a wallet-funded donation with a support route', async () => {
  const owner = await user();
  const donation = await DonationModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', donorId: owner.id, amount: 50, currency: 'GHS', paymentMethod: 'wallet' });
  const res = await request(app).post('/api/v1/refunds').set('Authorization', owner.token).send({ donationId: donation.id, reason: 'Other' }).expect(422);
  expect(res.body.message).toContain('support@ujimora.com');
  expect(await RefundModel.countDocuments({ donationId: donation.id })).toBe(0);
});
