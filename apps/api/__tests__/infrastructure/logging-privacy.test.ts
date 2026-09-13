import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const output = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock('../../src/infrastructure/logging/logger.js', async () => {
  const { pino } = await import('pino');
  const { diagnosticPrivacyOptions } = await import('../../src/infrastructure/logging/privacy.js');
  return { logger: pino({ ...diagnosticPrivacyOptions, base: undefined, timestamp: false }, {
    write(line: string) { output.lines.push(line); },
  }) };
});
import { logger } from '../../src/infrastructure/logging/logger.js';
import { requestLogger } from '../../src/infrastructure/adapters/inbound/middleware/requestLogger.js';
import { errorHandler } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';

beforeEach(() => { output.lines = []; });

describe('diagnostic log privacy', () => {
  it('drops error payloads and sensitive fields while retaining useful status and references', () => {
    const error = Object.assign(new Error('private-sentinel in provider response'), {
      code: 'ETIMEDOUT', statusCode: 502,
      cause: new Error('private-sentinel connection URI'),
      response: { body: 'private-sentinel' },
    });
    logger.error({
      err: error, error, password: 'private-sentinel', token: 'private-sentinel',
      headers: { authorization: 'private-sentinel' }, body: { name: 'private-sentinel' },
      message: 'private-sentinel provider message',
      metadata: { email: 'private-sentinel', details: { accountNumber: 'private-sentinel' } },
      path: '/bank/resolve?account_number=private-sentinel&bank_code=MTN',
      url: 'https://private-sentinel:private-sentinel@example.test/upload?token=private-sentinel#private-sentinel',
      reference: 'refund-operation-123',
    }, 'payment gateway failed');
    expect(output.lines.join('')).not.toContain('private-sentinel');
    expect(JSON.parse(output.lines[0])).toMatchObject({
      msg: 'payment gateway failed', reference: 'refund-operation-123', path: '/bank/resolve', url: '/upload',
      err: { type: 'Error', code: 'ETIMEDOUT', statusCode: 502 },
      error: { type: 'Error', code: 'ETIMEDOUT', statusCode: 502 },
    });
  });

  it('logs route templates rather than submitted path values or query tokens, including unmatched requests', async () => {
    const app = express();
    app.use(requestLogger);
    app.get('/diagnostic/:submissionId', (_req, res) => { res.json({ ok: true }); });
    await request(app).get('/diagnostic/private-sentinel?token=private-sentinel').expect(200);
    await request(app).get('/private-sentinel?email=private-sentinel').expect(404);
    expect(output.lines.join('')).not.toContain('private-sentinel');
    expect(output.lines.map(line => JSON.parse(line))).toEqual([
      expect.objectContaining({ method: 'GET', path: '/diagnostic/:submissionId', status: 200 }),
      expect.objectContaining({ method: 'GET', path: '/[unmatched]', status: 404 }),
    ]);
  });

  it('does not copy an exception message into the log message or generic error response', async () => {
    const app = express();
    app.get('/failure', () => { throw new Error('private-sentinel submitted data'); });
    app.use(errorHandler);
    const response = await request(app).get('/failure').expect(500);
    expect(response.body.message).toBe('Internal server error');
    expect(output.lines.join('')).not.toContain('private-sentinel');
    expect(JSON.parse(output.lines[0])).toMatchObject({ msg: 'request failed', err: { type: 'Error' } });
  });
});
