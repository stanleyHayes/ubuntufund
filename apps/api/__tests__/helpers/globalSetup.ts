import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

/**
 * Each integration test file connects to its own per-worker database (see
 * ./testDatabase.ts) so concurrent worker lifecycles can never drop each
 * other's data. Those databases are dropped by every file's `afterAll`, but a
 * reused worker can leave an empty shell behind. Cleanup is scoped to this
 * invocation's random namespace; it must never sweep another running suite.
 */
const BASE_MONGODB_URI =
  process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:28017/ubuntu-fund-test';
const runId = randomUUID().replace(/-/g, '').slice(0, 16);

function baseDatabaseName(uri: string): string {
  const path = uri.split('?')[0];
  return path.slice(path.lastIndexOf('/') + 1);
}

async function dropWorkerDatabases(): Promise<void> {
  const baseName = baseDatabaseName(BASE_MONGODB_URI);
  if (!baseName.endsWith('-test')) throw new Error('Test database name must end with -test');
  const prefix = `${baseName}-${runId}-`;
  const connection = await mongoose.createConnection(BASE_MONGODB_URI).asPromise();
  try {
    const { databases } = await connection.db!.admin().listDatabases();
    await Promise.all(
      databases
        .filter((d) => d.name.startsWith(prefix))
        .map((d) => connection.useDb(d.name).dropDatabase())
    );
  } finally {
    await connection.close();
  }
}

export async function setup(): Promise<void> {
  if (!baseDatabaseName(BASE_MONGODB_URI).endsWith('-test')) throw new Error('Test database name must end with -test');
  process.env.UJIMORA_TEST_RUN_ID = runId;
}

export async function teardown(): Promise<void> {
  await dropWorkerDatabases();
}
