import mongoose from 'mongoose';
import { logger } from '../logging/logger.js';

/** Do not accept financial writes before unique/idempotency indexes exist. */
export async function initializeDatabaseModels(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map(async model => {
    try { await model.init(); }
    catch (error) {
      logger.error({ err: error, modelName: model.modelName }, 'Database model initialization failed');
      throw error;
    }
  }));
}

export async function connectDatabase(uri: string): Promise<void> {
  let stage = 'connection';
  try {
    await mongoose.connect(uri);
    stage = 'model_initialization';
    await initializeDatabaseModels();
    logger.info('Connected to MongoDB');

    mongoose.connection.on('error', (error) => {
      logger.error({ err: error }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error({ err: error, stage }, 'Database startup failed');
    process.exit(1);
  }
}

let pendingPing: Promise<boolean> | null = null;

/**
 * Readiness: mongoose holds an open connection AND the server answers a ping
 * within `timeoutMs`. Never throws and never surfaces the driver error.
 * Concurrent callers share one in-flight ping, so a burst of health checks
 * costs the database a single round trip.
 */
export function isDatabaseReady(timeoutMs = 2_000): Promise<boolean> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !db) return Promise.resolve(false);
  if (pendingPing) return pendingPing;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref();
  });
  const ping = db.admin().command({ ping: 1 }).then(() => true, () => false);
  pendingPing = Promise.race([ping, timeout]).finally(() => {
    clearTimeout(timer);
    pendingPing = null;
  });
  return pendingPing;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
