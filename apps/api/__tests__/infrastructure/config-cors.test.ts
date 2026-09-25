import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * config/index.ts is evaluated at import time, so each case sets the
 * environment and imports a fresh copy. Values are set (never deleted) so
 * dotenv cannot fill them from a developer's apps/api/.env.
 */
const saved = { ...process.env };

async function loadConfig(env: Record<string, string>) {
  Object.assign(process.env, {
    JWT_SECRET: 'p'.repeat(40),
    JWT_REFRESH_SECRET: 'q'.repeat(40),
    MONGODB_URI: 'mongodb://127.0.0.1:28017/config-test',
    ...env,
  });
  vi.resetModules();
  return import('../../src/infrastructure/config/index.js');
}

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
  vi.resetModules();
});

describe('CORS configuration', () => {
  it('refuses to boot in production without CORS_ORIGINS', async () => {
    await expect(loadConfig({ NODE_ENV: 'production', CORS_ORIGINS: '' })).rejects.toThrow('CORS_ORIGINS is required in production');
    await expect(loadConfig({ NODE_ENV: 'production', CORS_ORIGINS: ' , ' })).rejects.toThrow('CORS_ORIGINS is required in production');
  });

  it('boots in production with an explicit origin list', async () => {
    const { config } = await loadConfig({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.ujimora.com, https://admin.ujimora.com' });
    expect(config.corsOrigins).toEqual(['https://app.ujimora.com', 'https://admin.ujimora.com']);
  });

  it('still allows an empty list outside production (tests, ad-hoc runs)', async () => {
    const { config } = await loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: '' });
    expect(config.corsOrigins).toEqual([]);
  });
});
