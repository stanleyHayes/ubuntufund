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

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err }, err.message);

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

  res.status(500).json({
    message: 'Internal server error',
    status: 500,
  });
}
