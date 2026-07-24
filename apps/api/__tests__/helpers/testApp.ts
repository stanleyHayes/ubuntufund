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
process.env.JWT_SECRET ??= 'test-jwt-secret-do-not-use-in-production-0001';
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret-do-not-use-in-production-0002';
// createApp() never connects to Mongo itself, but config/index.ts still
// requires MONGODB_URI to be present. Point it at the same test database the
// helper's own mongoose connection uses, for consistency.
process.env.MONGODB_URI ??= testDatabaseUri();

/** Build a fresh, fully-wired Express app (no listening, no DB connection). */
export async function createTestApp(): Promise<Express> {
  const { createApp } = await import('../../src/app.js');
  return createApp();
}
