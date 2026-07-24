import mongoose from 'mongoose';

/**
 * A local mongod is expected to already be running at this address (started
 * outside of the test process — tests never spawn or manage mongod
 * themselves). Only the `-test` database is ever touched.
 */
const TEST_MONGODB_URI =
  process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:28017/ubuntu-fund-test';

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
