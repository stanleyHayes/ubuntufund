import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../src/infrastructure/adapters/inbound/middleware/validate.js';
import { AppError } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';

const schema = z.object({ email: z.string().trim().toLowerCase().email(), note: z.string().default('none') });

function run(options?: { apply?: boolean }, body: unknown = { email: '  Person@Example.COM ', extra: 'kept?' }) {
  const req = { body } as Request;
  const next = vi.fn();
  validate(schema, options)(req, {} as Response, next);
  return { req, next };
}

describe('validate middleware', () => {
  it('leaves req.body untouched by default', () => {
    const { req, next } = run();
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ email: '  Person@Example.COM ', extra: 'kept?' });
  });

  it('replaces req.body with the parsed output when apply is set', () => {
    const { req, next } = run({ apply: true });
    expect(next).toHaveBeenCalledWith();
    // Trimmed + lower-cased, defaults filled, undeclared keys stripped.
    expect(req.body).toEqual({ email: 'person@example.com', note: 'none' });
  });

  it('still rejects invalid input with field errors', () => {
    expect(() => run({ apply: true }, { email: 'not an email' })).toThrow(AppError);
    try {
      run({ apply: true }, { email: 'not an email' });
    } catch (error) {
      expect((error as AppError).statusCode).toBe(400);
      expect((error as AppError).errors).toHaveProperty('email');
    }
  });
});
