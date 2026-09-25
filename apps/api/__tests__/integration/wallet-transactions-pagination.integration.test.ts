import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { WalletTransactionModel } from '../../src/infrastructure/database/models/WalletTransactionModel.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

// I127: the web wallet showed only the newest 50 rows with no way to page back.
describe('wallet transaction history pages', () => {
  it('pages back with a keyset cursor, without overlap or gaps, even on equal timestamps', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: `${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Wallet' }).expect(201);
    const userId = reg.body.data.user.id as string;
    const token = `Bearer ${reg.body.data.tokens.accessToken}`;
    const walletId = new mongoose.Types.ObjectId().toString();
    const same = new Date('2026-09-01T10:00:00Z');
    await WalletTransactionModel.insertMany(Array.from({ length: 5 }, (_, i) => ({
      walletId, userId, type: 'deposit', status: 'completed', amount: i + 1, currency: 'GHS', reference: `ref-${i}`,
      createdAt: i < 3 ? same : new Date(same.getTime() + i * 1000),
    })));
    const seen: string[] = [];
    let before: string | undefined;
    for (let page = 0; page < 4; page++) {
      const res = await request(app).get('/api/v1/wallets/transactions').query({ limit: 2, ...(before ? { before } : {}) }).set('Authorization', token).expect(200);
      const rows = res.body.data as { id: string; createdAt: string }[];
      if (!rows.length) break;
      seen.push(...rows.map((row) => row.id));
      const last = rows[rows.length - 1];
      before = `${new Date(last.createdAt).toISOString()}_${last.id}`;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    await request(app).get('/api/v1/wallets/transactions').query({ before: 'garbage' }).set('Authorization', token).expect(400);
  });
});
