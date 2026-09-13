import { seedBlogIfEmpty } from './infrastructure/database/seedBlog.js';
import { createApp } from './app.js';
import { config } from './infrastructure/config/index.js';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/connection.js';
import { logger } from './infrastructure/logging/logger.js';
import { MongoSiteContentRepository } from './infrastructure/adapters/outbound/persistence/MongoSiteContentRepository.js';
import { seedSiteContentIfEmpty } from './infrastructure/database/seedSiteContent.js';

async function bootstrap(): Promise<void> {
  await connectDatabase(config.mongodbUri);
  await seedBlogIfEmpty();

  // Safe prod first-run: populate CMS defaults only when the collection is
  // empty. Never fatal — a seed failure logs and boot continues.
  try {
    await seedSiteContentIfEmpty(new MongoSiteContentRepository());
  } catch (error) {
    logger.error({ err: error }, 'site content seed failed');
  }

  const app = createApp();

  // Catch-up sweep: re-dispatch any donation side-effects (realtime/receipts)
  // left pending in the transactional outbox by a prior crash/restart. Never
  // fatal — a sweep failure logs and boot continues.
  try {
    const outboxDispatcher = app.locals.outboxDispatcher as
      | { sweepPending: () => Promise<number> }
      | undefined;
    await outboxDispatcher?.sweepPending();
  } catch (error) {
    logger.error({ err: error }, 'outbox boot sweep failed');
  }

  try { await app.locals.clearTerminalTipCheckouts?.() }
  catch (error) { logger.error({ err: error }, 'Tip checkout credential boot cleanup failed') }

  try {
    await app.locals.accountErasure?.sweepPending();
  } catch (error) {
    logger.error({ err: error }, 'Account erasure boot sweep failed');
  }

  try { await app.locals.reconcileLiveSafety?.() }
  catch (error) { logger.error({ err: error }, 'Live safety boot sweep failed') }

  const server = app.listen(config.port, () => {
    logger.info(`Ujimora API running on port ${config.port} [${config.nodeEnv}]`);
  });
  // Do not delay readiness on provider calls; pending work is persisted and the
  // periodic sweep also retries it. No payment or acknowledgement is invented.
  void app.locals.reconcileActivityAlerts?.().catch(() => logger.error('Activity notification boot sweep failed; work remains queued'));
  void app.locals.reconcileStoreBilling?.().catch(() => logger.error('Store billing boot sweep failed; work remains queued'));

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
