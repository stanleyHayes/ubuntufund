import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { OrganizationMemberModel as Members } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
let app: Express;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
beforeAll(async () => {
  await connectTestDatabase(); await Promise.all([PublicationReviewModel.init(), Members.init()]);
  app = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }) });
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(org = false, admin = false) {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Organization contact', email, password: 'SecurePass123', ...(org ? { role: 'organization', organizationName: 'Original foundation', organizationType: 'ngo', website: 'https://original.example.test' } : {}), legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id;
  if (admin) await UserModel.findByIdAndUpdate(id, { role: 'admin' });
  return { id, email, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
type Account = Awaited<ReturnType<typeof account>>;
async function team() {
  const owner = await account(true), member = await account();
  await Members.create({ organizationId: owner.id, userId: member.id, email: member.email, role: 'admin', status: 'active', invitedBy: owner.id });
  return { owner, member };
}
const body = { organizationName: 'Reviewed foundation', website: 'https://reviewed.example.test' };
const save = (owner: Account, actor: Account, input: object = body) => request(app).put(`/api/v1/organization-team/${owner.id}/profile`).set('Authorization', actor.auth).send(input);
async function approve(actor: Account) {
  const admin = await account(false, true);
  const review = await PublicationReviewModel.findOne({ actorId: actor.id, action: 'organization.profile', status: 'pending' }).sort({ createdAt: -1 });
  expect(review).toBeTruthy();
  await request(app).put(`/api/v1/admin/publication-reviews/${review!.id}/review`).set('Authorization', admin.auth).send({ decision: 'approved', notes: 'Reviewed both the proposed organization name and website.' }).expect(200);
  return review!;
}
it('holds identity edits privately and binds approval to actor, organization and exact fields', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const { owner, member } = await team(), other = await account(true);
  await save(owner, member).expect(409); await save(owner, member).expect(409);
  expect(screen).not.toHaveBeenCalled();
  expect(await PublicationReviewModel.countDocuments({ actorId: member.id })).toBe(1);
  expect((await UserModel.findById(owner.id))?.organizationName).toBe('Original foundation');
  const approved = await approve(member);
  expect(JSON.parse(approved.text)).toEqual(body);
  await save(owner, owner).expect(409);
  await Members.create({ organizationId: other.id, userId: member.id, email: member.email, role: 'admin', status: 'active', invitedBy: other.id });
  await save(other, member).expect(409);
  await save(owner, member, { ...body, website: 'https://changed.example.test' }).expect(409);
  await save(owner, member).expect(200);
  expect(await AuditLogModel.countDocuments({ resource: owner.id, action: 'organization.profile.updated', actorId: member.id })).toBe(1);
  const page = await request(app).get(`/api/v1/organization-team/${owner.id}`).set('Authorization', member.auth).expect(200);
  expect(page.headers['cache-control']).toBe('private, no-store');
  expect(page.body.data).toMatchObject({ name: body.organizationName, website: body.website });
});
it('blocks revoked membership, demotion and credential rotation after screening', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  for (const change of ['revoke', 'demote', 'credentials'] as const) {
    const { owner, member } = await team();
    screen.mockImplementationOnce(async () => {
      if (change === 'credentials') await UserModel.findByIdAndUpdate(member.id, { authVersion: 'new-fixture-version' });
      else await Members.updateOne({ organizationId: owner.id, userId: member.id }, change === 'revoke' ? { status: 'revoked' } : { role: 'viewer' });
      return 'allowed';
    });
    await save(owner, member, { ...body, automatedReviewConsent: true }).expect(change === 'credentials' ? 401 : 403);
    expect((await UserModel.findById(owner.id))?.organizationName).toBe('Original foundation');
    expect(await AuditLogModel.countDocuments({ resource: owner.id, action: 'organization.profile.updated' })).toBe(0);
  }
});
it('rejects stale organization versions and keeps unrelated account fields out of the edit', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const { owner, member } = await team();
  await save(owner, member).expect(409); await approve(member);
  await UserModel.findByIdAndUpdate(owner.id, { $set: { website: 'https://concurrent.example.test' }, $inc: { organizationProfileRevision: 1 } });
  await save(owner, member).expect(409);
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(owner.id, { $inc: { organizationProfileRevision: 1 } }); return 'allowed'; });
  await save(owner, member, { ...body, organizationName: 'New proposal', automatedReviewConsent: true }).expect(409);
  await save(owner, member, { ...body, role: 'admin' }).expect(400);
  expect((await UserModel.findById(owner.id))?.role).toBe('organization');
});
it('enforces current organization/actor restrictions and agreements after screening', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  for (const change of ['organization restriction', 'member restriction', 'organization agreement', 'member agreement', 'organization closed'] as const) {
    const { owner, member } = await team();
    screen.mockImplementationOnce(async () => {
      if (change.endsWith('restriction')) await ContentRestrictionModel.create({ userId: change.startsWith('member') ? member.id : owner.id, reason: 'Fixture restriction during screening', restrictedBy: 'fixture' });
      else if (change.endsWith('agreement')) await UserModel.findByIdAndUpdate(change.startsWith('member') ? member.id : owner.id, { $unset: { legalAcceptance: 1 } });
      else await UserModel.findByIdAndUpdate(owner.id, { deletedAt: new Date() });
      return 'allowed';
    });
    const result = await save(owner, member, { ...body, automatedReviewConsent: true });
    expect(change.endsWith('restriction') ? [403] : change.endsWith('agreement') ? [428] : [409]).toContain(result.status);
    expect((await UserModel.findById(owner.id))?.organizationName).toBe('Original foundation');
  }
});
it('rolls back identity, revision and membership writes when its audit cannot persist', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const { owner, member } = await team();
  const audit = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('Fixture audit failure'));
  try { await save(owner, member, { ...body, automatedReviewConsent: true }).expect(500); } finally { audit.mockRestore(); }
  expect((await UserModel.findById(owner.id))?.organizationName).toBe('Original foundation');
  expect((await UserModel.findById(owner.id))?.organizationProfileRevision).toBeUndefined();
  expect((await UserModel.findById(member.id))?.profileWriteVersion).toBeUndefined();
  expect((await Members.findOne({ organizationId: owner.id, userId: member.id }))?.profileWriteVersion).toBeUndefined();
  await save(owner, member, { ...body, automatedReviewConsent: true }).expect(200);
});
it('prevents stale generic user saves from restoring unreviewed organization identity', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(true), repo = new MongoUserRepository();
  const stale = await repo.findById(owner.id);
  await save(owner, owner, { ...body, automatedReviewConsent: true }).expect(200);
  await repo.update(stale!);
  const stored = await UserModel.findById(owner.id);
  expect(stored).toMatchObject(body);
  expect(stored?.organizationProfileRevision).toBe(1);
});
it('holds provider failure and flagged text, and rejects unsafe websites before admission', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(true);
  screen.mockRejectedValueOnce(new Error('Fixture provider unavailable'));
  await save(owner, owner, { ...body, automatedReviewConsent: true }).expect(409);
  screen.mockResolvedValueOnce('flagged');
  await save(owner, owner, { ...body, organizationName: 'Another proposal', automatedReviewConsent: true }).expect(409);
  await save(owner, owner, { ...body, website: 'javascript:alert(1)' }).expect(400);
  expect((await UserModel.findById(owner.id))?.website).toBe('https://original.example.test');
});

it('removes teammate drafts on organization closure and cannot enqueue them again after erasure', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const { owner, member } = await team();
  await save(owner, member).expect(409);
  expect(await PublicationReviewModel.countDocuments({ action: 'organization.profile', resourceId: owner.id })).toBe(1);
  await request(app).delete('/api/v1/profile').set('Authorization', owner.auth).send({ password: 'SecurePass123' }).expect(200);
  expect(await PublicationReviewModel.countDocuments({ action: 'organization.profile', resourceId: owner.id })).toBe(0);
  const admission = new MongoPublicationAdmission({ screen });
  await expect(admission.assertAllowed({ actorId: member.id, action: 'organization.profile', resourceId: owner.id, text: JSON.stringify(body), mediaUrls: [] })).rejects.toMatchObject({ statusCode: 401 });
  expect(await PublicationReviewModel.countDocuments({ action: 'organization.profile', resourceId: owner.id })).toBe(0);
});
it('refuses new queued content for a closed author even when an earlier request was authorized', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const author = await account();
  await request(app).delete('/api/v1/profile').set('Authorization', author.auth).send({ password: 'SecurePass123' }).expect(200);
  const admission = new MongoPublicationAdmission({ screen });
  await expect(admission.assertAllowed({ actorId: author.id, action: 'comment.create', resourceId: 'fixture-campaign', text: 'Late proposed public text', mediaUrls: [] })).rejects.toMatchObject({ statusCode: 401 });
  expect(await PublicationReviewModel.countDocuments({ actorId: author.id })).toBe(0);
});
