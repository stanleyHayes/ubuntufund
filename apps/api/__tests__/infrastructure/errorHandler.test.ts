import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AppError, errorHandler, isDuplicateKeyError } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';

function respond(err: unknown) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  errorHandler(err as Error, {} as Request, res as unknown as Response, vi.fn());
  return { status: res.status.mock.calls[0][0] as number, body: res.json.mock.calls[0][0] as Record<string, unknown> };
}

describe('errorHandler', () => {
  it('maps a duplicate-key error to 409 without leaking the key', () => {
    const err = Object.assign(new Error('E11000 duplicate key error collection: users index: email_1 dup key: { email: "a@b.c" }'), { code: 11000, keyPattern: { email: 1 }, keyValue: { email: 'a@b.c' } });
    const { status, body } = respond(err);
    expect(status).toBe(409);
    expect(JSON.stringify(body)).not.toContain('a@b.c');
  });

  it('keeps AppError status codes and unknown errors as 500', () => {
    expect(respond(new AppError('Nope', 404)).status).toBe(404);
    expect(respond(Object.assign(new Error('x'), { code: 112 })).status).toBe(500);
  });
});

describe('isDuplicateKeyError', () => {
  it('matches code 11000, optionally for a specific indexed field', () => {
    const err = { code: 11000, keyPattern: { donationId: 1 } };
    expect(isDuplicateKeyError(err)).toBe(true);
    expect(isDuplicateKeyError(err, 'donationId')).toBe(true);
    expect(isDuplicateKeyError(err, 'email')).toBe(false);
    expect(isDuplicateKeyError({ code: 11001 })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});
