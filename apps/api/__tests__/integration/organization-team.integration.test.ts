import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(org = false) {
 const email = `${randomUUID()}@example.test`;
 const response = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, name: 'Contact Person', password: 'SecurePass123', ...(org ? { role: 'organization', organizationName: 'Community Foundation', organizationType: 'ngo' } : {}) }).expect(201);
 return { email, id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
/** Team seats are a paid-plan benefit (maxTeamMembers); give the organization one. */
async function teamPlan(organizationId: string, tier = 'organization', periodEnd = new Date(Date.now() + 86400000)) {
 await SubscriptionModel.findOneAndUpdate({ userId: organizationId }, { $set: { tier, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false } }, { upsert: true });
}
it('keeps organization identity separate and enforces scoped invitations, roles and revocation', async () => {
 const owner = await account(true), member = await account(), outsider = await account();
 await teamPlan(owner.id);
 const base = `/api/v1/organization-team/${owner.id}`;
 const profile = await request(app).get('/api/v1/profile').set('Authorization', owner.auth).expect(200);
 expect(profile.body.data).toMatchObject({ name: 'Contact Person', organizationName: 'Community Foundation' });
 await request(app).get(base).expect(401);
 await request(app).get(base).set('Authorization', outsider.auth).expect(403);
 const invitation = await request(app).post(`${base}/invitations`).set('Authorization', owner.auth).send({ email: member.email, role: 'viewer' }).expect(200);
 const accept = `/api/v1/organization-team/invitations/${invitation.body.data.id}/accept`;
 await request(app).post(accept).set('Authorization', member.auth).expect(403);
 await UserModel.updateMany({ _id: { $in: [member.id, outsider.id] } }, { emailVerified: true });
 await request(app).post(accept).set('Authorization', outsider.auth).expect(404);
 await request(app).post(accept).set('Authorization', member.auth).expect(200);
 await request(app).post(accept).set('Authorization', member.auth).expect(404);
 await request(app).get(base).set('Authorization', member.auth).expect(200);
 const campaign = await CampaignModel.create({ title: 'Org campaign', description: 'Organization campaign', goalAmount: 100, currency: 'GHS', category: 'education', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
 const publish = `${base}/campaigns/${campaign.id}/updates`;
 await request(app).post(publish).set('Authorization', member.auth).send({ title: 'Progress report', content: 'We have made progress.' }).expect(403);
 await request(app).put(`${base}/members/${invitation.body.data.id}`).set('Authorization', owner.auth).send({ role: 'editor' }).expect(200);
 await UserModel.findByIdAndUpdate(member.id, { $unset: { legalAcceptance: 1 } });
 await request(app).post(publish).set('Authorization', member.auth).send({ title: 'Missing agreement', content: 'This must not be published.' }).expect(428);
 await UserModel.findByIdAndUpdate(member.id, { $set: { legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() } } });
 await ContentRestrictionModel.create({ userId: member.id, reason: 'Fixture moderation restriction', restrictedBy: owner.id });
 await request(app).post(publish).set('Authorization', member.auth).send({ title: 'Restricted editor', content: 'This must not be published.' }).expect(403);
 await request(app).post(`/API/V1/ORGANIZATION-TEAM/${owner.id}/CAMPAIGNS/${campaign.id}/UPDATES`).set('Authorization', member.auth).send({ title: 'Mixed case bypass', content: 'This must not be published.' }).expect(403);
 expect(await CampaignUpdateModel.countDocuments({ campaignId: campaign.id })).toBe(0);
 await request(app).get(base).set('Authorization', member.auth).expect(200);
 await ContentRestrictionModel.deleteOne({ userId: member.id });
 const posted = await request(app).post(publish).set('Authorization', member.auth).send({ title: 'Progress report', content: 'We have made progress.' }).expect(200);
 expect((await CampaignUpdateModel.findById(posted.body.data.id))?.authorId).toBe(member.id);
 await request(app).post(`/api/v1/organization-team/${member.id}/campaigns/${campaign.id}/updates`).set('Authorization', member.auth).send({ title: 'Wrong org', content: 'Not permitted' }).expect(404);

 await request(app).put(`${base}/profile`).set('Authorization', member.auth).send({ organizationName: 'Bad edit', website: '' }).expect(403);
 await request(app).post(`${base}/invitations`).set('Authorization', member.auth).send({ email: outsider.email, role: 'admin' }).expect(403);
 await request(app).put(`${base}/members/${invitation.body.data.id}`).set('Authorization', owner.auth).send({ role: 'admin' }).expect(200);
 await ContentRestrictionModel.create({ userId: member.id, reason: 'Fixture moderation restriction', restrictedBy: owner.id });
 await request(app).put(`${base}/profile`).set('Authorization', member.auth).send({ organizationName: 'Restricted public name', website: '' }).expect(403);
 expect((await UserModel.findById(owner.id))?.organizationName).toBe('Community Foundation');
 await ContentRestrictionModel.deleteOne({ userId: member.id });
 await request(app).put(`${base}/profile`).set('Authorization', member.auth).send({ organizationName: 'Updated Foundation', website: '' }).expect(200);
 await request(app).post(`${base}/invitations`).set('Authorization', member.auth).send({ email: outsider.email, role: 'admin' }).expect(403);
 await request(app).delete(`${base}/members/${invitation.body.data.id}`).set('Authorization', owner.auth).expect(200);
 await request(app).get(base).set('Authorization', member.auth).expect(403);
});
it('rejects expired invitations and cross-organization membership edits', async () => {
 const owner = await account(true), otherOwner = await account(true), member = await account();
 await teamPlan(owner.id);
 await UserModel.findByIdAndUpdate(member.id, { emailVerified: true });
 const invitation = await request(app).post(`/api/v1/organization-team/${owner.id}/invitations`).set('Authorization', owner.auth).send({ email: member.email, role: 'editor' }).expect(200);
 await OrganizationMemberModel.findByIdAndUpdate(invitation.body.data.id, { expiresAt: new Date(0) });
 await request(app).post(`/api/v1/organization-team/invitations/${invitation.body.data.id}/accept`).set('Authorization', member.auth).expect(404);
 await request(app).put(`/api/v1/organization-team/${otherOwner.id}/members/${invitation.body.data.id}`).set('Authorization', otherOwner.auth).send({ role: 'admin' }).expect(404);
});
it('limits invitations to the plan team seats, counting the owner, members and live invitations', async () => {
 const owner = await account(true);
 const base = `/api/v1/organization-team/${owner.id}/invitations`;
 const invite = (email: string) => request(app).post(base).set('Authorization', owner.auth).send({ email, role: 'viewer' });
 // Community has one seat: the owner.
 const refused = await invite(`${randomUUID()}@example.test`).expect(403);
 expect(refused.body.message).toMatch(/includes 1 team seat, including the owner/);
 expect(await OrganizationMemberModel.countDocuments({ organizationId: owner.id })).toBe(0);
 // Pro has three seats: the owner plus two.
 await teamPlan(owner.id, 'pro');
 const first = `${randomUUID()}@example.test`, second = `${randomUUID()}@example.test`;
 await invite(first).expect(200);
 await invite(second).expect(200);
 await invite(`${randomUUID()}@example.test`).expect(403);
 // Re-sending an existing invitation needs no new seat.
 await invite(second).expect(200);
 // An expired invitation frees its seat.
 await OrganizationMemberModel.updateOne({ organizationId: owner.id, email: first }, { expiresAt: new Date(0) });
 await invite(`${randomUUID()}@example.test`).expect(200);
 // A lapsed paid plan falls back to Community seats.
 await teamPlan(owner.id, 'pro', new Date(Date.now() - 1000));
 await invite(`${randomUUID()}@example.test`).expect(403);
});

it('does not oversell team seats when invitations are sent at the same moment', async () => {
 const owner = await account(true);
 await teamPlan(owner.id, 'pro');
 const base = `/api/v1/organization-team/${owner.id}/invitations`;
 // Pro has three seats: the owner plus two. Six different people invited at once.
 const results = await Promise.all(Array.from({ length: 6 }, () =>
   request(app).post(base).set('Authorization', owner.auth).send({ email: `${randomUUID()}@example.test`, role: 'viewer' })));
 expect(results.map((result) => result.status).sort()).toEqual([200, 200, 403, 403, 403, 403]);
 expect(await OrganizationMemberModel.countDocuments({ organizationId: owner.id, status: 'invited' })).toBe(2);
});

it('notifies an invitee who already has an account, with the same response for unknown emails', async () => {
 const { NotificationModel } = await import('../../src/infrastructure/database/models/NotificationModel.js');
 const owner = await account(true), member = await account();
 await teamPlan(owner.id, 'pro');
 const invite = (email: string) => request(app).post(`/api/v1/organization-team/${owner.id}/invitations`).set('Authorization', owner.auth).send({ email, role: 'editor' }).expect(200);
 const before = await NotificationModel.countDocuments({ type: 'organization_invitation' });
 const known = await invite(member.email);
 const unknown = await invite(`nobody-${randomUUID()}@example.test`);
 expect(Object.keys(known.body.data).sort()).toEqual(Object.keys(unknown.body.data).sort());
 expect(known.body.data.message).toBe(unknown.body.data.message);
 const notice = await NotificationModel.findOne({ userId: member.id, type: 'organization_invitation' }).lean();
 expect(notice).toMatchObject({ path: '/organization-team', read: false });
 expect(notice!.body).toContain('Community Foundation');
 // Only the existing account was notified.
 expect(await NotificationModel.countDocuments({ type: 'organization_invitation' })).toBe(before + 1);
});
