import type { PublicationAdmissionPort } from '../../src/domain/ports/outbound/PublicationAdmissionPort.js';
import type { PublicationApplyHandlers } from '../../src/domain/ports/outbound/PublicationApplyPort.js';
import type { Express } from 'express';
import type { ActivityEmailSender } from '../../src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.js';
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
// Public media must be this cloud's uploads (routes/urlSchemas.ts). Pin a name
// so CI (no .env) and developer machines validate the same URLs; files that
// exercise real uploads set their own before importing this helper.
process.env.CLOUDINARY_CLOUD_NAME ||= 'test_cloud';

process.env.JWT_SECRET ??= 'test-jwt-secret-do-not-use-in-production-0001';
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret-do-not-use-in-production-0002';
// createApp() never connects to Mongo itself, but config/index.ts still
// requires MONGODB_URI to be present. Point it at the same test database the
// helper's own mongoose connection uses, for consistency.
process.env.MONGODB_URI ??= testDatabaseUri();

export interface TestAppOptions {
  publicationAdmission?: PublicationAdmissionPort;
  emailSender?: ActivityEmailSender;
  accountEmailKey?: Buffer;
  /**
   * Publishing on approval. On in the test app: staff decisions enqueue and
   * the sweep claims. Versions only publish on approval when the admission a
   * suite injects was built with it too
   * (`new MongoPublicationAdmission(screener, { publishOnApproval })`); the
   * default stub admission holds nothing.
   */
  publishOnApproval?: () => boolean;
  /** Replaces the per-action publication handlers (e.g. a fake registry). */
  publicationApplyHandlers?: PublicationApplyHandlers;
  /** How long a staff decision waits for its publication (default 8 s). */
  publicationDecisionWaitMs?: number;
}

/** Build a fresh, fully-wired Express app (no listening, no DB connection). */
export async function createTestApp(options: TestAppOptions = {}): Promise<Express> {
  const { createApp } = await import('../../src/app.js');
  // Existing integration suites isolate their feature; publication tests inject the real admission service.
  const app = createApp({ publicationAdmission: {
    assertAllowed: async () => {}, assertCurrent: async () => {},
    admitCampaign: async () => ({ outcome: 'approved', basis: 'screening', evidence: { fingerprint: 'test-admission' } }), commitCampaign: async () => {},
  }, publishOnApproval: () => true, ...options });
  const { initializeDatabaseModels } = await import('../../src/infrastructure/database/connection.js');
  await initializeDatabaseModels();
  return app;
}
