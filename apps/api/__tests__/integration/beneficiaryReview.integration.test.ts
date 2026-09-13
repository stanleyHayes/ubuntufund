import { randomUUID } from 'node:crypto';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_beneficiary_review';
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_beneficiary_review';
process.env.SPLIT_PROCEEDS_ENABLED = 'true';
process.env.PAYOUT_DUAL_APPROVAL_AMOUNT = '100';
import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { BeneficiaryRecipientModel } from '../../src/infrastructure/database/models/BeneficiaryRecipientModel.js';
import { BeneficiaryPayoutModel } from '../../src/infrastructure/database/models/BeneficiaryPayoutModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { CampaignBeneficiaryBalanceModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryBalanceModel.js';
import { MongoBeneficiaryPayoutAuthorization } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutAuthorization.js';
import { MongoBeneficiaryPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutRepository.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ status: true, data: url.endsWith('/balance') ? [{ currency: 'GHS', balance: 100000000 }] : { transfer_code: 'TRF_test', status: 'pending' } }) })));
});
async function admin() {
  const email = `${randomUUID()}@example.test`;
  const res = await request(app).post('/api/v1/auth/register').send({ email, password: 'SecurePass123', name: 'Reviewer', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = res.body.data.user.id;
  await UserModel.findByIdAndUpdate(id, { role: 'admin' });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(200);
  return { id, token: login.body.data.tokens.accessToken };
}
async function fixture() {
  const maker = await admin(), checker = await admin();
  const campaignId = randomUUID(), beneficiaryId = randomUUID();
  const recipient = await BeneficiaryRecipientModel.create({ campaignId, beneficiaryId, currency: 'GHS', type: 'mobile_money', accountNumber: '0551234567', accountName: 'Beneficiary', bankCode: 'MTN', recipientCode: 'RCP_original', kycVerified: true, kycVerifiedBy: maker.id, kycVerifiedAt: new Date(), createdBy: maker.id });
  const payout = await BeneficiaryPayoutModel.create({ campaignId, beneficiaryId, recipientId: String(recipient._id), amount: 150, currency: 'GHS', status: 'PENDING', provider: 'paystack', requestedBy: beneficiaryId });
  await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 150, totalRaised: 150 });
  await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', availableBalance: 150 });
  const approve = (who = maker) => request(app).post(`/api/v1/beneficiary-payouts/${payout.id}/approve`).set('Authorization', `Bearer ${who.token}`).send({});
  const noTransfer = async () => {
    expect((await BeneficiaryPayoutModel.findById(payout.id))?.status).toBe('PENDING');
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(150);
    expect((await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId }))?.availableBalance).toBe(150);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/transfer'))).toBe(false);
  };
  return { maker, checker, campaignId, beneficiaryId, recipient, payout, approve, noTransfer };
}
it('persists the first review, prevents self-checking and transfers only after a different second reviewer', async () => {
  const f = await fixture();
  const first = await f.approve().expect(200);
  expect(first.body.data.firstApprovedBy).toBe(f.maker.id);
  const stored = await BeneficiaryPayoutModel.findById(f.payout.id).orFail();
  expect(stored.firstApprovedAt).toBeInstanceOf(Date);
  expect(stored.firstApprovalFingerprint).toMatch(/^[a-f0-9]{64}$/);
  await f.noTransfer();
  await f.approve().expect(409);
  await f.approve(f.checker).expect(200);
  expect((await BeneficiaryPayoutModel.findById(f.payout.id))?.status).toBe('PROCESSING');
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer'))).toHaveLength(1);
});
it.each(['staff', 'destination', 'kyc', 'amount'])('refuses stale first-review authorization: %s', async scenario => {
  const f = await fixture();
  const original = MongoBeneficiaryPayoutAuthorization.prototype.assertCurrent;
  let changed = false;
  vi.spyOn(MongoBeneficiaryPayoutAuthorization.prototype, 'assertCurrent').mockImplementation(async function(...args) {
    if (!changed) {
      changed = true;
      if (scenario === 'staff') await UserModel.updateOne({ _id: f.maker.id }, { authVersion: 'revoked' }, { session: null });
      else if (scenario === 'amount') await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { amount: 151 }, { session: null });
      else await BeneficiaryRecipientModel.updateOne({ _id: f.recipient.id }, scenario === 'kyc' ? { kycVerified: false } : { accountNumber: '0557654321' }, { session: null });
    }
    return original.apply(this, args);
  });
  await f.approve().expect(scenario === 'staff' ? 403 : 409);
  expect((await BeneficiaryPayoutModel.findById(f.payout.id))?.firstApprovedBy).toBeUndefined();
  await f.noTransfer();
});
it('rolls the first review back if its transaction fails after the actual database write', async () => {
  const f = await fixture();
  const original = MongoBeneficiaryPayoutRepository.prototype.recordFirstApproval;
  vi.spyOn(MongoBeneficiaryPayoutRepository.prototype, 'recordFirstApproval').mockImplementation(async function(...args) { await original.apply(this, args); throw new Error('Injected review write failure'); });
  await f.approve().expect(500);
  const stored = await BeneficiaryPayoutModel.findById(f.payout.id).orFail();
  expect(stored.firstApprovedBy).toBeUndefined(); expect(stored.firstApprovalFingerprint).toBeUndefined();
  await f.noTransfer();
});
it.each(['changed_destination', 'legacy_evidence'])('requires a fresh maker review for %s', async scenario => {
  const f = await fixture();
  await f.approve().expect(200);
  if (scenario === 'changed_destination') await BeneficiaryRecipientModel.updateOne({ _id: f.recipient.id }, { accountNumber: '0557654321', recipientCode: 'RCP_replacement', kycVerifiedAt: new Date() });
  else await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { $unset: { firstApprovalFingerprint: 1 } });
  const fresh = await f.approve(f.checker).expect(200);
  expect(fresh.body.data.firstApprovedBy).toBe(f.checker.id);
  await f.noTransfer();
  await f.approve(f.checker).expect(409);
  await f.approve(f.maker).expect(200);
});
it('rejects a changed first review before final reservation without moving funds', async () => {
  const f = await fixture();
  await f.approve().expect(200);
  const provider = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/balance')) await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { firstApprovalFingerprint: 'replaced-review' });
    return provider(...args);
  });
  await f.approve(f.checker).expect(409);
  await f.noTransfer();
});
it('rejects a replaced recipient record rather than paying a different saved destination', async () => {
  const f = await fixture();
  await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { recipientId: randomUUID() });
  await f.approve().expect(409);
  await f.noTransfer();
});
it('serializes simultaneous first reviews without counting a losing stale review', async () => {
  const f = await fixture();
  const original = MongoBeneficiaryPayoutRepository.prototype.findById;
  let reads = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const hook = vi.spyOn(MongoBeneficiaryPayoutRepository.prototype, 'findById').mockImplementation(async function(id) {
    const result = await original.call(this, id);
    if (id === f.payout.id && ++reads <= 2) { if (reads === 2) release(); await gate; }
    return result;
  });
  const results = await Promise.all([f.approve(), f.approve(f.checker)]);
  hook.mockRestore();
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  const stored = await BeneficiaryPayoutModel.findById(f.payout.id).orFail();
  expect([f.maker.id, f.checker.id]).toContain(stored.firstApprovedBy);
  await f.noTransfer();
});
