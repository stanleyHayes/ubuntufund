import mongoose from 'mongoose';

/**
 * Each integration test file connects to its own per-worker database (see
 * ./testDatabase.ts) so concurrent worker lifecycles can never drop each
 * other's data. Those databases are dropped by every file's `afterAll`, but a
 * reused worker can leave an empty shell behind, so this run-level hook sweeps
 * every `<base>-<pid>-<hex>` worker database clean at the start and end of the
 * whole run. Only the dedicated `-test` worker databases are ever touched.
 */
const BASE_MONGODB_URI =
  process.env.MONGODB_TEST_URI ?? 'mongodb://127.0.0.1:28017/ubuntu-fund-test';

function baseDatabaseName(uri: string): string {
  const path = uri.split('?')[0];
  return path.slice(path.lastIndexOf('/') + 1);
}

async function dropWorkerDatabases(): Promise<void> {
  const baseName = baseDatabaseName(BASE_MONGODB_URI);
  const workerDb = new RegExp(`^${baseName}-\\d+-[0-9a-f]+$`);
  const connection = await mongoose.createConnection(BASE_MONGODB_URI).asPromise();
  try {
    const { databases } = await connection.db!.admin().listDatabases();
    await Promise.all(
      databases
        .filter((d) => workerDb.test(d.name))
        .map((d) => connection.useDb(d.name).dropDatabase())
    );
  } finally {
    await connection.close();
  }
}

export async function setup(): Promise<void> {
  await dropWorkerDatabases();
}

export async function teardown(): Promise<void> {
  await dropWorkerDatabases();
}
