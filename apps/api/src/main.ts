import { createApp } from './app.js';
import { config } from './infrastructure/config/index.js';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/connection.js';
import { logger } from './infrastructure/logging/logger.js';
import { MongoSiteContentRepository } from './infrastructure/adapters/outbound/persistence/MongoSiteContentRepository.js';
import { seedSiteContentIfEmpty } from './infrastructure/database/seedSiteContent.js';

async function bootstrap(): Promise<void> {
  await connectDatabase(config.mongodbUri);

  // Safe prod first-run: populate CMS defaults only when the collection is
  // empty. Never fatal — a seed failure logs and boot continues.
  try {
    await seedSiteContentIfEmpty(new MongoSiteContentRepository());
  } catch (error) {
    logger.error({ err: error }, 'site content seed failed');
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Ubuntu Fund API running on port ${config.port} [${config.nodeEnv}]`);
  });

  // Bound request lifetimes (slowloris / hung-connection protection).
  server.requestTimeout = 30_000;
  server.headersTimeout = 66_000;
  server.keepAliveTimeout = 65_000;

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Hard exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'failed to start server');
  process.exit(1);
});
