import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { TipModel } from '../../src/infrastructure/database/models/TipModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it('rejects unacknowledged public messages before creating any fiat, crypto or creator payment record', async () => {
  await request(app).post('/api/v1/donation-intents').send({ campaignId: 'missing', provider: 'paystack', amount: 10, donorEmail: 'guest@example.com', message: 'A public message' }).expect(428);
  await request(app).post('/api/v1/campaigns/missing/donations/crypto').send({ quoteId: 'missing', donorEmail: 'guest@example.com', message: 'A public message' }).expect(428);
  await request(app).post('/api/v1/creators/missing/tips').send({ amount: 10, supporterEmail: 'guest@example.com', message: 'A public message' }).expect(428);
  expect(await DonationIntentModel.countDocuments()).toBe(0);
  expect(await TipModel.countDocuments()).toBe(0);
});
it('enforces the current publishing restriction on initial fiat, crypto and creator messages while preserving account access', async () => {
  const legalAcceptance = { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true };
  const registration = await request(app).post('/api/v1/auth/register').send({ email: `message-${randomUUID()}@example.com`, name: 'Message test', password: 'SecurePass123', legalAcceptance }).expect(201);
  const auth = `Bearer ${registration.body.data.tokens.accessToken}`, userId = registration.body.data.user.id;
  await ContentRestrictionModel.create({ userId, reason: 'Test publishing restriction', restrictedBy: 'test-reviewer' });
  const inputs = [
    ['/api/v1/campaigns/missing/donate', { amount: 10, currency: 'GHS', paymentMethod: 'wallet' }],
    ['/api/v1/donation-intents', { campaignId: 'missing', provider: 'paystack', amount: 10, donorEmail: 'guest@example.com' }],
    ['/api/v1/campaigns/missing/donations/crypto', { quoteId: 'missing', donorEmail: 'guest@example.com' }],
    ['/api/v1/creators/missing/tips', { amount: 10, supporterEmail: 'guest@example.com' }],
  ] as const;
  for (const [path, input] of inputs) {
    const blocked = await request(app).post(path).set('Authorization', auth).send({ ...input, message: 'A public message', legalAcceptance }).expect(403);
    expect(blocked.body.message).toContain('Publishing is restricted');
    const noMessage = await request(app).post(path).set('Authorization', auth).send(input);
    expect(noMessage.status).not.toBe(403);
    expect(noMessage.body.message).not.toContain('Publishing is restricted');
  }
  await request(app).get('/api/v1/profile').set('Authorization', auth).expect(200);
  expect(await DonationIntentModel.countDocuments()).toBe(0);
  expect(await TipModel.countDocuments()).toBe(0);
  vi.spyOn(ContentRestrictionModel, 'exists').mockRejectedValueOnce(new Error('Restriction store unavailable'));
  try {
    await request(app).post('/api/v1/donation-intents').set('Authorization', auth).send({ ...inputs[1][1], message: 'A public message', legalAcceptance }).expect(500);
  } finally { vi.restoreAllMocks(); }
});
