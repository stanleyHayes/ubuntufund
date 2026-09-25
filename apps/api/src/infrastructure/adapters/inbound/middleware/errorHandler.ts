import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../../logging/logger.js';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * True when MongoDB rejected a write because a unique index already holds the
 * value — the losing side of a check-then-insert race. With `field`, only
 * when that index covers the given field.
 */
export function isDuplicateKeyError(error: unknown, field?: string): boolean {
  if (!error || typeof error !== 'object' || (error as { code?: unknown }).code !== 11000) return false;
  if (!field) return true;
  const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;
  return !!keyPattern && Object.prototype.hasOwnProperty.call(keyPattern, field);
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err }, 'request failed');

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.message,
      status: err.statusCode,
      errors: err.errors,
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      message: 'Validation error',
      status: 400,
    });
    return;
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      message: 'Invalid ID format',
      status: 400,
    });
    return;
  }

  // A unique index rejected a concurrent duplicate. Nothing was written twice;
  // the record already exists. Money flows that need a specific answer catch
  // 11000 themselves — this is the fallback instead of a misleading 500.
  if (isDuplicateKeyError(err)) {
    res.status(409).json({
      message: 'This conflicts with an existing record. Refresh and try again.',
      status: 409,
    });
    return;
  }

  res.status(500).json({
    message: 'Internal server error',
    status: 500,
  });
}
