import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REMOTE_OVERRIDE, seedTargetProblem } from '../../scripts/seedGuard.mjs';

const scriptsDir = resolve(__dirname, '../../scripts');

describe('seedTargetProblem', () => {
  it.each([
    'mongodb://127.0.0.1:28017/ubuntu-fund',
    'mongodb://localhost/ubuntu-fund',
    'mongodb://[::1]:27017/ubuntu-fund',
    'mongodb://user:pass@127.0.0.1:27017,localhost:27018/db?replicaSet=rs',
  ])('allows local database %s', (uri) => {
    expect(seedTargetProblem(uri, {})).toBeNull();
  });

  it('refuses mongodb+srv even with the override', () => {
    const uri = 'mongodb+srv://user:secret@cluster0.example.mongodb.net/ujimora';
    expect(seedTargetProblem(uri, {})).toMatch(/mongodb\+srv/);
    expect(seedTargetProblem(uri, { SEED_ALLOW_REMOTE: REMOTE_OVERRIDE })).toMatch(/mongodb\+srv/);
  });

  it('refuses a replica set with any non-local member unless explicitly overridden', () => {
    const uri = 'mongodb://127.0.0.1:27017,db1.example.net:27017/ujimora?replicaSet=rs';
    expect(seedTargetProblem(uri, {})).toMatch(/db1\.example\.net/);
    expect(seedTargetProblem(uri, { SEED_ALLOW_REMOTE: 'yes' })).not.toBeNull();
    expect(seedTargetProblem(uri, { SEED_ALLOW_REMOTE: REMOTE_OVERRIDE })).toBeNull();
  });

  it('refuses NODE_ENV=production outright', () => {
    expect(seedTargetProblem('mongodb://127.0.0.1/db', { NODE_ENV: 'production', SEED_ALLOW_REMOTE: REMOTE_OVERRIDE })).toMatch(/production/);
  });

  it('never echoes credentials from the URI', () => {
    expect(seedTargetProblem('mongodb://admin:hunter2@db.example.net/x', {})).not.toContain('hunter2');
  });

  it('refuses a missing or malformed URI', () => {
    expect(seedTargetProblem('', {})).not.toBeNull();
    expect(seedTargetProblem('postgres://127.0.0.1/db', {})).not.toBeNull();
  });
});

describe.each(['seed-dev.mjs', 'seed-e2e.mjs'])('%s', (script) => {
  function run(env: Record<string, string>) {
    const { NODE_ENV: _nodeEnv, SEED_ALLOW_REMOTE: _override, ...base } = process.env;
    return spawnSync(process.execPath, [resolve(scriptsDir, script)], {
      cwd: resolve(scriptsDir, '..'),
      env: { ...base, ...env },
      encoding: 'utf8',
      timeout: 20_000,
    });
  }

  it('exits non-zero before connecting to a hosted cluster', () => {
    const result = run({ MONGODB_URI: 'mongodb+srv://user:secret@x.example.net/db' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing to seed');
    expect(result.stderr).not.toContain('secret');
  });

  it('exits non-zero under NODE_ENV=production', () => {
    const result = run({ MONGODB_URI: 'mongodb://127.0.0.1:1/db', NODE_ENV: 'production' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NODE_ENV is production');
  });
});
