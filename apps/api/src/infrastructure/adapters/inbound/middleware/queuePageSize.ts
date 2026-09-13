import { z } from 'zod';
import { AppError } from './errorHandler.js';

/** Bound admin queue reads; omission preserves existing clients and exports. */
export function queuePageSize(value: unknown): number {
  const parsed = z.coerce.number().int().min(1).max(100).default(25).safeParse(value);
  if (!parsed.success) throw new AppError('Page size must be a whole number between 1 and 100.', 400);
  return parsed.data;
}
