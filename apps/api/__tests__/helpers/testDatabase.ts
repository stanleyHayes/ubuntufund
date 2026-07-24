import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

/**
 * A local mongod is expected to already be running at this address (started
 * outside of the test process — tests never spawn or manage mongod
 * themselves). Only a `-test` database is ever touched.
 */
const BASE_MONGODB_URI =
  process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:28017/ubuntu-fund-test';

/**
 * Every test file runs in its own worker process (Vitest `forks` pool with
 * `fileParallelism` disabled), yet they all target the same physical mongod.
 * Sharing a single database name means one file's `afterAll` dropDatabase()
 * can wipe a neighbouring file's data whenever their lifecycles overlap at the
 * process boundary — which surfaced as flaky 404s. Give each worker its own
 * database so files can never see or drop each other's data. The name still
 * contains `-test`, so the drop below only ever touches a dedicated test
 * database, and each file drops its own in `afterAll`.
 */
const TEST_MONGODB_URI = perWorkerDatabaseUri(BASE_MONGODB_URI);

function perWorkerDatabaseUri(uri: string): string {
  const marker = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const [base, query] = uri.split('?');
  const withSuffix = `${base}-${marker}`;
  return query ? `${withSuffix}?${query}` : withSuffix;
}

export function testDatabaseUri(): string {
  return TEST_MONGODB_URI;
}

/** Connect mongoose to the test database. Safe to call once per test file. */
export async function connectTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGODB_URI);
  }
}

/**
 * Drop every collection in the test database, leaving the connection open.
 * Intended for use in `afterAll` (or between files) — never call this
 * against anything but the dedicated test database.
 */
export async function dropTestDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return;
  }
  await mongoose.connection.db.dropDatabase();
}

/** Disconnect mongoose. Intended for use at the very end of a test file. */
export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect();
}
