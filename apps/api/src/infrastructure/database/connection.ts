import mongoose from 'mongoose';
import { logger } from '../logging/logger.js';

/** Do not accept financial writes before unique/idempotency indexes exist. */
export async function initializeDatabaseModels(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
}

export async function connectDatabase(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri);
    await initializeDatabaseModels();
    logger.info('Connected to MongoDB');

    mongoose.connection.on('error', (error) => {
      logger.error({ err: error }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to MongoDB');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
