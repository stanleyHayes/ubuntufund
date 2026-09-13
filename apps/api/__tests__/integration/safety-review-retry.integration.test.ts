import express from 'express';
import request from 'supertest';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { createAdminSafetyReportRoutes } from '../../src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.js';
import { errorHandler } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../src/infrastructure/adapters/inbound/middleware/authMiddleware.js';
beforeAll(connectTestDatabase);
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
const originalNotes = 'Broadcast reviewed. Stop the live provider room for safety.';
function app(stop: (id: string) => Promise<void>) {
  const server = express(); server.use(express.json());
  server.use(createAdminSafetyReportRoutes((req: AuthenticatedRequest, _res, next) => { req.userId = 'moderator'; req.userRole = 'admin'; next(); }, (_req, _res, next) => next(), stop, async () => {}));
  server.use(errorHandler); return server;
}
it('reserves a single review action while provider work is in flight', async () => {
  const report = await SafetyReportModel.create({ reporterId: 'reporter', targetType: 'live', targetId: 'aaaaaaaaaaaaaaaaaaaaaaaa', targetUserId: 'host', reason: 'violence' });
  let finish!: () => void;
  const stop = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const server = app(stop), path = `/${report.id}/review`;
  const first = request(server).put(path).send({ action: 'stop_live', notes: originalNotes }).then(response => response);
  await vi.waitFor(() => expect(stop).toHaveBeenCalledOnce());
  await request(server).put(path).send({ action: 'dismiss', notes: 'Another moderator attempts a conflicting outcome.' }).expect(409);
  finish(); expect((await first).status).toBe(200);
  expect(await SafetyReportModel.findById(report.id)).toMatchObject({ status: 'resolved', reviewAction: 'stop_live', reviewNotes: originalNotes });
});
it('retains the action and notes after failure and lets another process finish the same action', async () => {
  const report = await SafetyReportModel.create({ reporterId: 'reporter', targetType: 'live', targetId: 'bbbbbbbbbbbbbbbbbbbbbbbb', targetUserId: 'host', reason: 'violence' });
  const path = `/${report.id}/review`;
  await request(app(async () => { throw new Error('Provider failure'); })).put(path).send({ action: 'stop_live', notes: originalNotes }).expect(500);
  expect(await SafetyReportModel.findById(report.id)).toMatchObject({ status: 'pending', reviewAction: 'stop_live' });
  await request(app(async () => {})).put(path).send({ action: 'stop_live', notes: 'Different retry notes must not overwrite the original decision.' }).expect(200);
  expect(await SafetyReportModel.findById(report.id)).toMatchObject({ status: 'resolved', reviewNotes: originalNotes, reviewedBy: 'moderator' });
});
