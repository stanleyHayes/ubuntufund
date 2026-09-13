import type { PublicationAdmissionPort } from '../../src/domain/ports/outbound/PublicationAdmissionPort.js';
import type { Express } from 'express';
import { testDatabaseUri } from './testDatabase.js';

/**
 * src/infrastructure/config/index.ts throws at import time if these are
 * missing, and src/app.ts imports it transitively. These MUST be set before
 * anything ever does `import('../../src/app.js')` (statically or
 * dynamically) — hence they're assigned here, at module load time, in a
 * helper that itself has no static dependency on src/app.ts. Every
 * integration test file reaches the app exclusively through
 * `createTestApp()` below rather than importing src/app.ts directly.
 */
process.env.NODE_ENV ??= 'test';
// Integration fixtures must never deliver real email using a developer's .env.
process.env.RESEND_API_KEY = '';
// Live-room tests use explicit provider mocks, never a developer's live account.
process.env.LIVEKIT_URL = '';
process.env.LIVEKIT_API_KEY = '';
process.env.LIVEKIT_API_SECRET = '';
process.env.STORE_BILLING_ENABLED = 'false';

process.env.JWT_SECRET ??= 'test-jwt-secret-do-not-use-in-production-0001';
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret-do-not-use-in-production-0002';
// createApp() never connects to Mongo itself, but config/index.ts still
// requires MONGODB_URI to be present. Point it at the same test database the
// helper's own mongoose connection uses, for consistency.
process.env.MONGODB_URI ??= testDatabaseUri();

/** Build a fresh, fully-wired Express app (no listening, no DB connection). */
export async function createTestApp(options: { publicationAdmission?: PublicationAdmissionPort } = {}): Promise<Express> {
  const { createApp } = await import('../../src/app.js');
  // Existing integration suites isolate their feature; publication tests inject the real admission service.
  const app = createApp({ publicationAdmission: { assertAllowed: async () => {}, assertCurrent: async () => {} }, ...options });
  const { initializeDatabaseModels } = await import('../../src/infrastructure/database/connection.js');
  await initializeDatabaseModels();
  return app;
}
