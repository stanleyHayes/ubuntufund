import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { ContactController } from '../../src/infrastructure/adapters/inbound/http/controllers/ContactController.js';
import { createContactRoutes } from '../../src/infrastructure/adapters/inbound/http/routes/contactRoutes.js';
import { errorHandler } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import { ContactSubmissionModel } from '../../src/infrastructure/database/models/ContactSubmissionModel.js';

/**
 * A contact message was only stored; staff saw nothing but an action-centre
 * count while the site promised a reply. Submission now alerts staff, and an
 * alert failure never costs the sender their confirmation.
 */
beforeAll(connectTestDatabase);
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

function app(contactReceived: () => Promise<void>) {
  const server = express(); server.use(express.json());
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  server.use('/contact', createContactRoutes(new ContactController({ contactReceived }), pass as never, pass as never));
  server.use(errorHandler); return server;
}
const body = { name: 'Kojo Owusu', email: 'kojo@example.com', subject: 'Campaign verification', inquiryType: 'campaign', message: 'Please help me understand which documents are required.' };

it('alerts staff once with the stored submission', async () => {
  const contactReceived = vi.fn(async () => {});
  const res = await request(app(contactReceived)).post('/contact').send(body).expect(201);
  expect(contactReceived).toHaveBeenCalledOnce();
  expect(contactReceived).toHaveBeenCalledWith(expect.objectContaining({ id: res.body.data.id, email: 'kojo@example.com', subject: 'Campaign verification', inquiryType: 'campaign' }));
});

it('still confirms and stores the message when the alert fails', async () => {
  const contactReceived = vi.fn(async () => { throw new Error('email provider down'); });
  const res = await request(app(contactReceived)).post('/contact').send(body).expect(201);
  expect(await ContactSubmissionModel.exists({ _id: res.body.data.id })).toBeTruthy();
});
