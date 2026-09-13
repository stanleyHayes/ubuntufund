import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { AiWritingAction } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AiUsageModel, AiQuotaModel } from '../../src/infrastructure/database/models/AiUsageModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { AiWritingService } from '../../src/application/services/AiWritingService.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await Promise.all([SafetyReportModel.init(), AiUsageModel.init(), AiQuotaModel.init()]); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function user() {
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'AI report test', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: res.body.data.user.id, token: `Bearer ${res.body.data.tokens.accessToken}` };
}
it('allows the requester to privately report an original AI output, rejects altered/foreign evidence and supports audited staff resolution', async () => {
  const author = await user(), other = await user(), admin = await user();
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  const service = new AiWritingService({ isConfigured: () => true, write: async () => ({ text: 'Generated text supplied only when reported.', model: 'test-model', inputTokens: 5, outputTokens: 6 }) }, 10, 100);
  const result = await service.write(author.id, { consentToExternalProcessing: true, text: 'A synthetic prompt.', action: AiWritingAction.IMPROVE_CLARITY });
  expect(result.requestId).toMatch(/^[a-f0-9]{24}$/);
  const usage = await AiUsageModel.findById(result.requestId).lean();
  expect(usage).not.toHaveProperty('outputDigest');
  expect(JSON.stringify(usage)).not.toContain(result.result);
  const input = { targetType: 'ai_output', targetId: result.requestId, generatedText: result.result, reason: 'other', description: 'Please review this generated suggestion for safety.' };
  await request(app).post('/api/v1/safety/reports').send(input).expect(401);
  await request(app).post('/api/v1/safety/reports').set('Authorization', other.token).send(input).expect(404);
  await request(app).post('/api/v1/safety/reports').set('Authorization', author.token).send({ ...input, generatedText: 'Replaced with a different text.' }).expect(404);
  const res = await request(app).post('/api/v1/safety/reports').set('Authorization', author.token).send(input).expect(201);
  const repeated = await request(app).post('/api/v1/safety/reports').set('Authorization', author.token).send(input).expect(201);
  expect(repeated.body.data.id).toBe(res.body.data.id);
  const report = await SafetyReportModel.findById(res.body.data.id).lean();
  expect(report?.evidence).toBe(result.result); expect(report?.targetUserId).toBeUndefined();
  expect(report).not.toHaveProperty('generatedText');
  expect(res.body.data).not.toHaveProperty('evidence');
  await request(app).get('/api/v1/admin/safety-reports').set('Authorization', other.token).expect(403);
  const path = `/api/v1/admin/safety-reports/${res.body.data.id}/review`;
  await request(app).put(path).set('Authorization', admin.token).send({ action: 'restrict_user', notes: 'The model output must not restrict the reporter.' }).expect(400);
  await request(app).put(path).set('Authorization', admin.token).send({ action: 'resolve', notes: 'Reviewed the model output and recorded follow-up filtering work.' }).expect(200);
  expect(await SafetyReportModel.findById(res.body.data.id).lean()).toMatchObject({ status: 'resolved', reviewedBy: admin.id, resolution: 'resolve' });
});
