const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { GetKYCStatsUseCase } = require('../../src/application/use-cases/GetKYCStatsUseCase.ts');
const { MongoKYCRepository } = require('../../src/infrastructure/adapters/outbound/persistence/MongoKYCRepository.ts');
const { KYCVerificationModel } = require('../../src/infrastructure/database/models/KYCVerificationModel.ts');
const { createKYCRoutes } = require('../../src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts');
const { requireAdmin } = require('../../src/infrastructure/adapters/inbound/middleware/requireRole.ts');

test('statistics use Ghana day boundaries and pass through persisted totals', async () => {
  const totals = { pending: 4, approvedToday: 2, rejectedToday: 1 };
  const service = new GetKYCStatsUseCase({ getStats: async (start: Date, end: Date) => {
    assert.equal(start.toISOString(), '2026-09-05T00:00:00.000Z');
    assert.equal(end.toISOString(), '2026-09-06T00:00:00.000Z');
    return totals;
  } });
  assert.deepEqual(await service.execute(new Date('2026-09-05T23:59:59Z')), totals);
});

test('repository counts pending records and decisions by reviewedAt', async (t: any) => {
  const start = new Date('2026-09-05T00:00:00Z');
  const end = new Date('2026-09-06T00:00:00Z');
  const queries: unknown[] = [];
  t.mock.method(KYCVerificationModel, 'countDocuments', async (query: any) => {
    queries.push(query);
    return query.status === 'pending' ? 4 : query.status === 'approved' ? 2 : 1;
  });
  assert.deepEqual(await new MongoKYCRepository().getStats(start, end), { pending: 4, approvedToday: 2, rejectedToday: 1 });
  assert.deepEqual(queries, [
    { status: 'pending' },
    { status: 'approved', reviewedAt: { $gte: start, $lt: end } },
    { status: 'rejected', reviewedAt: { $gte: start, $lt: end } },
  ]);
});

test('stats route exists and requires authenticated admin access', async () => {
  const app = express();
  const stub = (_req: any, res: any) => res.json({ data: { pending: 0, approvedToday: 0, rejectedToday: 0 } });
  const auth = (req: any, res: any, next: any) => {
    if (!req.headers['x-test-role']) return res.sendStatus(401);
    req.userRole = req.headers['x-test-role']; next();
  };
  app.use('/kyc', createKYCRoutes({ getStats: stub, submitIdentity: stub, getStatus: stub, listPending: stub, approve: stub, reject: stub }, auth, requireAdmin));
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.statusCode ?? 500).json({ message: error.message }));
  await request(app).get('/kyc/stats').expect(401);
  await request(app).get('/kyc/stats').set('x-test-role', 'user').expect(403);
  const response = await request(app).get('/kyc/stats').set('x-test-role', 'admin').expect(200);
  assert.deepEqual(response.body.data, { pending: 0, approvedToday: 0, rejectedToday: 0 });
});
