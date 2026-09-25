import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { disabledCapabilities } from '../../src/infrastructure/config/capabilities.js';

const repoRoot = resolve(__dirname, '../../../..');
const apiSource = resolve(__dirname, '../../src');

/** `- key: NAME` entries of render.yaml, with how each gets its value. */
function blueprintEntries(): Map<string, 'sync:false' | 'value' | 'generateValue'> {
  const lines = readFileSync(join(repoRoot, 'render.yaml'), 'utf8').split('\n');
  const entries = new Map<string, 'sync:false' | 'value' | 'generateValue'>();
  let current: string | null = null;
  for (const line of lines) {
    const key = /^\s*- key: ([A-Z0-9_]+)\s*$/.exec(line);
    if (key) {
      current = key[1];
      continue;
    }
    if (!current || /^\s*#/.test(line)) continue;
    if (/^\s*sync: false\b/.test(line)) entries.set(current, 'sync:false');
    else if (/^\s*generateValue: true\b/.test(line)) entries.set(current, 'generateValue');
    else if (/^\s*value:/.test(line)) entries.set(current, 'value');
  }
  return entries;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

/** Every environment variable the API reads. */
function variablesReadByApi(): Set<string> {
  const names = new Set<string>();
  const patterns = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /\benv\.([A-Z][A-Z0-9_]*)/g, // configureStoreBilling(env = process.env)
    /\b(?:requireEnv|aiLimit)\('([A-Z][A-Z0-9_]*)'/g,
  ];
  for (const file of sourceFiles(apiSource)) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) names.add(match[1]);
  }
  return names;
}

/** Variables the blueprint must NOT declare, and why. */
const NOT_DECLARED: Record<string, string> = {
  PORT: 'set by Render itself',
  CRYPTO_MOCK_WEBHOOK_SECRET: 'mock crypto rail is test-only and must never exist in production',
  X: 'placeholder inside a doc comment in config/index.ts',
};

describe('render.yaml blueprint', () => {
  const declared = blueprintEntries();

  it('declares every environment variable the API reads', () => {
    const missing = [...variablesReadByApi()].filter((name) => !(name in NOT_DECLARED) && !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('keeps secrets and stable keys dashboard-only (sync:false), never committed literals', () => {
    const secrets = [
      'MONGODB_URI',
      'RESEND_API_KEY',
      'AUTH_EMAIL_ENCRYPTION_KEY_BASE64',
      'MFA_ENCRYPTION_KEY',
      'STORE_BILLING_ENABLED',
      'STORE_BILLING_PRODUCTS',
      'STORE_RECEIPT_ENCRYPTION_KEY_BASE64',
      'APPLE_IAP_ENVIRONMENT',
      'APPLE_IAP_PRIVATE_KEY_BASE64',
      'APPLE_IAP_KEY_ID',
      'APPLE_IAP_ISSUER_ID',
      'APPLE_IAP_BUNDLE_ID',
      'APPLE_IAP_APP_ID',
      'APPLE_IAP_ROOT_CERTIFICATES_BASE64',
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
      'GOOGLE_PLAY_PACKAGE_NAME',
      'GOOGLE_PLAY_ALLOW_TEST_PURCHASES',
      'GOOGLE_PLAY_RTDN_AUDIENCE',
      'GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT',
      'PAYSTACK_SECRET_KEY',
      'CLOUDINARY_API_SECRET',
      'LIVEKIT_API_SECRET',
      'OPENAI_API_KEY',
    ];
    for (const name of secrets) expect({ name, source: declared.get(name) }).toEqual({ name, source: 'sync:false' });
  });

  it('health-checks readiness (MongoDB reachable), not bare liveness', () => {
    expect(readFileSync(join(repoRoot, 'render.yaml'), 'utf8')).toMatch(/^\s*healthCheckPath: \/health\/ready\s*$/m);
  });

  it('does not declare the test-only mock crypto secret', () => {
    expect(declared.has('CRYPTO_MOCK_WEBHOOK_SECRET')).toBe(false);
  });
});

describe('disabledCapabilities', () => {
  it('reports nothing when every capability is configured', () => {
    expect(disabledCapabilities({ accountEmail: true, mfa: true, storeBilling: true })).toEqual({ faults: [], optional: [] });
  });

  it('names the missing variables, never their values', () => {
    const { faults, optional } = disabledCapabilities({ accountEmail: false, mfa: false, storeBilling: false });
    expect(faults).toHaveLength(2);
    expect(faults[0]).toContain('AUTH_EMAIL_ENCRYPTION_KEY_BASE64');
    expect(faults[1]).toContain('MFA_ENCRYPTION_KEY');
    expect(optional).toEqual([expect.stringContaining('STORE_BILLING_ENABLED')]);
  });
});
