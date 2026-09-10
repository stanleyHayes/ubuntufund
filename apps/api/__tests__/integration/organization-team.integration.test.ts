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
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(org = false) {
 const email = `${randomUUID()}@example.test`;
 const response = await request(app).post('/api/v1/auth/register').send({ email, name: 'Contact Person', password: 'SecurePass123', ...(org ? { role: 'organization', organizationName: 'Community Foundation', organizationType: 'ngo' } : {}) }).expect(201);
 return { email, id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
it('keeps organization identity separate and enforces scoped invitations, roles and revocation', async () => {
 const owner = await account(true), member = await account(), outsider = await account();
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
 const posted = await request(app).post(publish).set('Authorization', member.auth).send({ title: 'Progress report', content: 'We have made progress.' }).expect(200);
 expect((await CampaignUpdateModel.findById(posted.body.data.id))?.authorId).toBe(member.id);
 await request(app).post(`/api/v1/organization-team/${member.id}/campaigns/${campaign.id}/updates`).set('Authorization', member.auth).send({ title: 'Wrong org', content: 'Not permitted' }).expect(404);

 await request(app).put(`${base}/profile`).set('Authorization', member.auth).send({ organizationName: 'Bad edit', website: '' }).expect(403);
 await request(app).post(`${base}/invitations`).set('Authorization', member.auth).send({ email: outsider.email, role: 'admin' }).expect(403);
 await request(app).put(`${base}/members/${invitation.body.data.id}`).set('Authorization', owner.auth).send({ role: 'admin' }).expect(200);
 await request(app).put(`${base}/profile`).set('Authorization', member.auth).send({ organizationName: 'Updated Foundation', website: '' }).expect(200);
 await request(app).post(`${base}/invitations`).set('Authorization', member.auth).send({ email: outsider.email, role: 'admin' }).expect(403);
 await request(app).delete(`${base}/members/${invitation.body.data.id}`).set('Authorization', owner.auth).expect(200);
 await request(app).get(base).set('Authorization', member.auth).expect(403);
});
it('rejects expired invitations and cross-organization membership edits', async () => {
 const owner = await account(true), otherOwner = await account(true), member = await account();
 await UserModel.findByIdAndUpdate(member.id, { emailVerified: true });
 const invitation = await request(app).post(`/api/v1/organization-team/${owner.id}/invitations`).set('Authorization', owner.auth).send({ email: member.email, role: 'editor' }).expect(200);
 await OrganizationMemberModel.findByIdAndUpdate(invitation.body.data.id, { expiresAt: new Date(0) });
 await request(app).post(`/api/v1/organization-team/invitations/${invitation.body.data.id}/accept`).set('Authorization', member.auth).expect(404);
 await request(app).put(`/api/v1/organization-team/${otherOwner.id}/members/${invitation.body.data.id}`).set('Authorization', otherOwner.auth).send({ role: 'admin' }).expect(404);
});
