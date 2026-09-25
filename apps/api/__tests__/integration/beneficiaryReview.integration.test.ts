import mongoose from 'mongoose';
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
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { BeneficiaryRecipientModel } from '../../src/infrastructure/database/models/BeneficiaryRecipientModel.js';
import { BeneficiaryPayoutModel } from '../../src/infrastructure/database/models/BeneficiaryPayoutModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { CampaignBeneficiaryBalanceModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryBalanceModel.js';
import { MongoBeneficiaryPayoutAuthorization } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutAuthorization.js';
import { MongoBeneficiaryPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutRepository.js';
import { DisputeModel } from '../../src/infrastructure/database/models/DisputeModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { beneficiaryDestinationFingerprint } from '../../src/application/use-cases/BeneficiaryPayoutUseCase.js';
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
/** The destination fingerprint a request made against this recipient document records. */
function bindingOf(doc: { _id: unknown; campaignId: string; beneficiaryId: string; type: 'ghipss' | 'mobile_money'; accountNumber: string; bankCode: string; accountName: string; recipientCode: string; currency: string; createdBy: string; kycVerified: boolean; createdAt: Date }) {
  return beneficiaryDestinationFingerprint({ id: String(doc._id), campaignId: doc.campaignId, beneficiaryId: doc.beneficiaryId, type: doc.type, accountNumber: doc.accountNumber, bankCode: doc.bankCode, accountName: doc.accountName, recipientCode: doc.recipientCode, currency: doc.currency, createdBy: doc.createdBy, kycVerified: doc.kycVerified, createdAt: doc.createdAt });
}
async function fixture(options: { checkerIsBeneficiary?: boolean; registeredBy?: 'beneficiary' | 'owner' | 'maker' } = {}) {
  const maker = await admin(), checker = await admin();
  // Approval checks the payout's campaign inside the transaction, so it must exist.
  const campaignObjectId = new mongoose.Types.ObjectId(), campaignId = String(campaignObjectId), beneficiaryId = options.checkerIsBeneficiary ? checker.id : randomUUID(), ownerId = randomUUID();
  await CampaignModel.collection.insertOne({ _id: campaignObjectId, creatorId: ownerId, title: 'Beneficiary review fixture', status: 'active', deletedAt: null });
  // Only the beneficiary or the campaign owner registers a destination; `maker`
  // models a legacy row an admin entered before registration was restricted.
  const createdBy = options.registeredBy === 'owner' ? ownerId : options.registeredBy === 'maker' ? maker.id : beneficiaryId;
  const recipient = await BeneficiaryRecipientModel.create({ campaignId, beneficiaryId, currency: 'GHS', type: 'mobile_money', accountNumber: '0551234567', accountName: 'Beneficiary', bankCode: 'MTN', recipientCode: 'RCP_original', kycVerified: true, kycVerifiedBy: maker.id, kycVerifiedAt: new Date(), createdBy });
  const payout = await BeneficiaryPayoutModel.create({ campaignId, beneficiaryId, recipientId: String(recipient._id), amount: 150, currency: 'GHS', status: 'PENDING', provider: 'paystack', requestedBy: options.checkerIsBeneficiary ? randomUUID() : beneficiaryId, destinationFingerprint: bindingOf(recipient), clearedAmount: 150 });
  await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 150, totalRaised: 150 });
  await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', availableBalance: 150 });
  const approve = (who = maker) => request(app).post(`/api/v1/beneficiary-payouts/${payout.id}/approve`).set('Authorization', `Bearer ${who.token}`).send({ reviewNote: 'Verified the beneficiary MoMo wallet owner and capacity.' });
  const noTransfer = async () => {
    expect((await BeneficiaryPayoutModel.findById(payout.id))?.status).toBe('PENDING');
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(150);
    expect((await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId }))?.availableBalance).toBe(150);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/transfer'))).toBe(false);
  };
  return { maker, checker, campaignId, campaignObjectId, beneficiaryId, ownerId, recipient, payout, approve, noTransfer };
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
// A destination changed after the request is no longer the one requested, so
// no review of it can pay this request (previously a fresh maker review could).
it('refuses a destination changed after the request, even after a first review', async () => {
  const f = await fixture();
  await f.approve().expect(200);
  await BeneficiaryRecipientModel.updateOne({ _id: f.recipient.id }, { accountNumber: '0557654321', recipientCode: 'RCP_replacement', kycVerifiedAt: new Date() });
  const refused = await f.approve(f.checker).expect(409);
  expect(refused.body.message).toMatch(/destination changed after this request/);
  expect((await BeneficiaryPayoutModel.findById(f.payout.id))?.firstApprovedBy).toBe(f.maker.id);
  await f.noTransfer();
});
it.each(['legacy_evidence'])('requires a fresh maker review for %s', async scenario => {
  const f = await fixture();
  await f.approve().expect(200);
  if (scenario === 'legacy_evidence') await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { $unset: { firstApprovalFingerprint: 1 } });
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
it('requires each approver to record a destination review note and keeps both notes', async () => {
  const f = await fixture();
  const send = (who: { token: string }, body: object) => request(app).post(`/api/v1/beneficiary-payouts/${f.payout.id}/approve`).set('Authorization', `Bearer ${who.token}`).send(body);
  await send(f.maker, {}).expect(400);
  await send(f.maker, { reviewNote: '   looks fine   ' }).expect(400);
  expect((await BeneficiaryPayoutModel.findById(f.payout.id))?.firstApprovedBy).toBeUndefined();
  await f.noTransfer();

  await send(f.maker, { reviewNote: 'Called the beneficiary; MoMo name and tier match the request.' }).expect(200);
  await send(f.checker, { reviewNote: 'Second check: KYC evidence and wallet owner confirmed again.' }).expect(200);
  const stored = await BeneficiaryPayoutModel.findById(f.payout.id).lean().orFail();
  expect(stored.status).toBe('PROCESSING');
  expect(stored.reviews?.map(review => [review.stage, review.by, review.note])).toEqual([
    ['first', f.maker.id, 'Called the beneficiary; MoMo name and tier match the request.'],
    ['final', f.checker.id, 'Second check: KYC evidence and wallet owner confirmed again.'],
  ]);
});
it('shows approvers the exact destination under review and refuses members or replaced destinations', async () => {
  const f = await fixture();
  const recipient = (token: string) => request(app).get(`/api/v1/beneficiary-payouts/${f.payout.id}/recipient`).set('Authorization', `Bearer ${token}`);
  const res = await recipient(f.maker.token).expect(200);
  expect(res.body.data).toMatchObject({ type: 'mobile_money', accountName: 'Beneficiary', accountNumber: '0551234567', bankCode: 'MTN', currency: 'GHS', kycVerified: true, kycVerifiedBy: f.maker.id });
  expect(res.body.data.recipientCode).toBeUndefined();
  const member = await request(app).post('/api/v1/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'SecurePass123', name: 'Member', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  await recipient(member.body.data.tokens.accessToken).expect(403);
  await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { recipientId: randomUUID() });
  await recipient(f.maker.token).expect(409);
});

it('never lets an admin approve a payout to themselves, and refuses a payout whose campaign is gone', async () => {
  const own = await fixture({ checkerIsBeneficiary: true });
  await own.approve().expect(200);
  const refused = await own.approve(own.checker).expect(403);
  expect(refused.body.message).toMatch(/Another administrator must approve a payout to you/);
  await own.noTransfer();

  const orphan = await fixture();
  await CampaignModel.collection.deleteOne({ _id: new mongoose.Types.ObjectId(orphan.campaignId) });
  await orphan.approve().expect(409);
  await orphan.noTransfer();
});

it('never pays a request made before destinations were bound to it', async () => {
  const f = await fixture();
  await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { $unset: { destinationFingerprint: 1 } });
  const refused = await f.approve().expect(409);
  expect(refused.body.message).toMatch(/not bound to a reviewed destination/);
  await request(app).get(`/api/v1/beneficiary-payouts/${f.payout.id}/recipient`).set('Authorization', `Bearer ${f.maker.token}`).expect(409);
  await f.noTransfer();
});

it('pays only a destination the beneficiary or the campaign owner entered', async () => {
  const owner = await fixture({ registeredBy: 'owner' });
  await owner.approve().expect(200);
  // A legacy destination an admin entered is never paid: not by that admin, nor by another.
  const staffEntered = await fixture({ registeredBy: 'maker' });
  const own = await staffEntered.approve().expect(403);
  expect(own.body.message).toMatch(/destination you entered/);
  const other = await staffEntered.approve(staffEntered.checker).expect(409);
  expect(other.body.message).toMatch(/not entered by the beneficiary or the campaign owner/);
  await staffEntered.noTransfer();
});

it.each(['blocked', 'deleted', 'disputed', 'under_review_dispute'])('refuses approval on a %s campaign with no reservation or transfer', async scenario => {
  const f = await fixture();
  if (scenario === 'blocked') await CampaignModel.collection.updateOne({ _id: f.campaignObjectId }, { $set: { status: 'blocked' } });
  else if (scenario === 'deleted') await CampaignModel.collection.updateOne({ _id: f.campaignObjectId }, { $set: { deletedAt: new Date() } });
  else await DisputeModel.collection.insertOne({ campaignId: f.campaignId, reporterId: randomUUID(), reason: 'fraud', description: 'Donor says the campaign is not genuine.', status: scenario === 'disputed' ? 'open' : 'under_review', createdAt: new Date(), updatedAt: new Date() });
  const refused = await f.approve().expect(409);
  expect(refused.body.message).toMatch(scenario === 'blocked' || scenario === 'deleted' ? /cannot pay out in its current state/ : /unresolved dispute/);
  expect((await BeneficiaryPayoutModel.findById(f.payout.id))?.firstApprovedBy).toBeUndefined();
  await f.noTransfer();
});

it('lets an admin reject a pending request, returning what it cleared to pending on both mirrors', async () => {
  const f = await fixture();
  // The request cleared 150 pending → available on both mirrors.
  const reject = (who: { token: string }, reason: string) => request(app).post(`/api/v1/beneficiary-payouts/${f.payout.id}/reject`).set('Authorization', `Bearer ${who.token}`).send({ reason });
  await reject(f.maker, 'too short').expect(400);
  const member = await request(app).post('/api/v1/auth/register').send({ email: `${randomUUID()}@example.test`, password: 'SecurePass123', name: 'Member', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  await reject({ token: member.body.data.tokens.accessToken }, 'Supporting documents do not match the beneficiary.').expect(403);
  const res = await reject(f.maker, 'Supporting documents do not match the beneficiary.').expect(200);
  expect(res.body.data).toMatchObject({ status: 'FAILED', closure: { kind: 'rejected', reason: 'Supporting documents do not match the beneficiary.', closedBy: f.maker.id } });
  const stored = await BeneficiaryPayoutModel.findById(f.payout.id).orFail();
  expect(stored.settlementApplied).toBe(true);
  const campaign = await CampaignBalanceModel.findOne({ campaignId: f.campaignId });
  const share = await CampaignBeneficiaryBalanceModel.findOne({ campaignId: f.campaignId, beneficiaryId: f.beneficiaryId });
  expect([campaign?.availableBalance, campaign?.pendingBalance]).toEqual([0, 150]);
  expect([share?.availableBalance, share?.pendingBalance]).toEqual([0, 150]);
  expect(await AuditLogModel.countDocuments({ action: 'beneficiary_payout.rejected', resource: f.payout.id })).toBe(1);
  // A replay changes nothing, and a closed request can never be approved.
  await reject(f.checker, 'Supporting documents do not match the beneficiary.').expect(409);
  await f.approve(f.checker).expect(409);
  expect((await CampaignBeneficiaryBalanceModel.findOne({ campaignId: f.campaignId, beneficiaryId: f.beneficiaryId }))?.pendingBalance).toBe(150);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/transfer'))).toBe(false);
});

it('returns only the unclaimed available share when closing a request that predates clearedAmount', async () => {
  const f = await fixture();
  // Legacy request: no clearedAmount. Another PENDING request of 100 still relies on available.
  await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { $unset: { clearedAmount: 1 } });
  await BeneficiaryPayoutModel.create({ campaignId: f.campaignId, beneficiaryId: f.beneficiaryId, recipientId: String(f.recipient._id), amount: 100, currency: 'GHS', status: 'PENDING', provider: 'paystack', requestedBy: f.beneficiaryId });
  await request(app).post(`/api/v1/beneficiary-payouts/${f.payout.id}/reject`).set('Authorization', `Bearer ${f.maker.token}`).send({ reason: 'Duplicate of a newer request for the same beneficiary.' }).expect(200);
  const share = await CampaignBeneficiaryBalanceModel.findOne({ campaignId: f.campaignId, beneficiaryId: f.beneficiaryId });
  const campaign = await CampaignBalanceModel.findOne({ campaignId: f.campaignId });
  expect([share?.availableBalance, share?.pendingBalance]).toEqual([100, 50]);
  expect([campaign?.availableBalance, campaign?.pendingBalance]).toEqual([100, 50]);
});
