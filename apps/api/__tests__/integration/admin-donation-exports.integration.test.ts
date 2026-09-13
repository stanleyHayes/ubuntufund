import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { WalletTransactionModel } from '../../src/infrastructure/database/models/WalletTransactionModel.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { Types } from 'mongoose';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Export reader', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
it('returns every donation across pages only to current administrators without expanding public reads', async () => {
  const owner = await account(), staff = await account();
  await UserModel.findByIdAndUpdate(staff.id, { role: 'admin' });
  const campaign = await CampaignModel.create({ title: 'Private export campaign', description: 'This campaign remains unpublished', goalAmount: 1000, raisedAmount: 0, currency: 'GHS', category: 'education', creatorId: owner.id, status: 'draft', startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  await DonationModel.insertMany(Array.from({ length: 105 }, (_, index) => ({ campaignId: campaign.id, donorId: owner.id, amount: index + 0.25, currency: index % 2 ? 'USD' : 'GHS', paymentMethod: 'wallet', isAnonymous: index === 0, message: 'Private donor message' })));
  const route = '/api/v1/admin/donations';
  await request(app).get(route).expect(401);
  await request(app).get(route).set('Authorization', owner.auth).expect(403);
  const first = await request(app).get(route).query({ page: 1, pageSize: 100 }).set('Authorization', staff.auth).expect(200);
  const second = await request(app).get(route).query({ page: 2, pageSize: 100 }).set('Authorization', staff.auth).expect(200);
  expect(first.headers['cache-control']).toBe('private, no-store');
  expect(first.body.data.total).toBe(105);
  const rows = [...first.body.data.items, ...second.body.data.items];
  expect(rows).toHaveLength(105);
  expect(new Set(rows.map(row => row.id)).size).toBe(105);
  expect(rows.find(row => row.isAnonymous)).toMatchObject({ donorName: 'Anonymous', donorId: '' });
  expect(rows[0].campaignTitle).toBe('Private export campaign');
  expect(JSON.stringify(rows)).not.toMatch(/Private donor message|password|authVersion/);
  expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(5486.25);
  const publicFeed = await request(app).get('/api/v1/donations?limit=100').expect(200);
  expect(publicFeed.body.data).toEqual([]);
  await UserModel.findByIdAndUpdate(staff.id, { role: 'user' });
  await request(app).get(route).set('Authorization', staff.auth).expect(403);
  expect(await DonationModel.countDocuments()).toBe(105);
});

it('paginates subscriptions beyond the former 500-record cap without exporting store purchase credentials', async () => {
  const staff = await account();
  await UserModel.findByIdAndUpdate(staff.id, { role: 'admin' });
  const at = new Date();
  await SubscriptionModel.deleteMany({});
  await SubscriptionModel.insertMany(Array.from({ length: 505 }, () => ({ userId: new Types.ObjectId().toString(), tier: 'free', status: 'active', billingCycle: 'monthly', currentPeriodStart: at, currentPeriodEnd: at, storePurchaseKey: 'private-store-key' })));
  const ids: string[] = [];
  for (let page = 1; page <= 6; page++) {
    const response = await request(app).get('/api/v1/subscriptions').query({ page, pageSize: 100 }).set('Authorization', staff.auth).expect(200);
    expect(response.body.data.total).toBe(505);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(response.body)).not.toContain('private-store-key');
    ids.push(...response.body.data.items.map((item: { id: string }) => item.id));
  }
  expect(ids).toHaveLength(505);
  expect(new Set(ids).size).toBe(505);
  await request(app).get('/api/v1/subscriptions').expect(401);
  await UserModel.findByIdAndUpdate(staff.id, { role: 'user' });
  await request(app).get('/api/v1/subscriptions').set('Authorization', staff.auth).expect(403);
});

it('scopes wallet balances, transactions and donation history to a member and rejects non-staff reads', async () => {
  const member = await account(), other = await account(), staff = await account();
  await UserModel.findByIdAndUpdate(staff.id, { role: 'admin' });
  await WalletModel.deleteMany({ userId: { $in: [member.id, other.id] } });
  const wallets = await WalletModel.create([
    { userId: member.id, type: 'local', currency: 'GHS', balance: 123.45 },
    { userId: other.id, type: 'local', currency: 'GHS', balance: 999 },
  ]);
  await WalletTransactionModel.create(wallets.map(w => ({ walletId: w.id, userId: w.userId, type: 'deposit', status: 'completed', amount: w.balance, currency: 'GHS', reference: randomUUID(), metadata: { secret: 'private-provider-data' } })));
  for (const path of ['/admin/wallets', '/admin/wallets/transactions']) {
    await request(app).get(`/api/v1${path}`).expect(401);
    await request(app).get(`/api/v1${path}`).set('Authorization', member.auth).expect(403);
    const response = await request(app).get(`/api/v1${path}`).query({ userId: member.id, pageSize: 1 }).set('Authorization', staff.auth).expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].userId).toBe(member.id);
    expect(JSON.stringify(response.body)).not.toContain('private-provider-data');
    const second = await request(app).get(`/api/v1${path}`).query({ userId: member.id, page: 2, pageSize: 1 }).set('Authorization', staff.auth).expect(200);
    expect(second.body.data.items).toEqual([]);
    await request(app).get(`/api/v1${path}?userId=invalid`).set('Authorization', staff.auth).expect(400);
  }
  const campaignId = new Types.ObjectId().toString();
  await DonationModel.create({ campaignId, donorId: member.id, amount: 30, currency: 'GHS', paymentMethod: 'wallet', isAnonymous: true });
  await DonationModel.create({ campaignId, donorId: other.id, amount: 70, currency: 'GHS', paymentMethod: 'wallet' });
  const donations = await request(app).get('/api/v1/admin/donations').query({ donorId: member.id }).set('Authorization', staff.auth).expect(200);
  expect(donations.body.data.total).toBe(1);
  expect(donations.body.data.items[0]).toMatchObject({ amount: 30, isAnonymous: true, donorId: '' });
  await UserModel.findByIdAndUpdate(staff.id, { role: 'user' });
  await request(app).get('/api/v1/admin/wallets').set('Authorization', staff.auth).expect(403);
});
