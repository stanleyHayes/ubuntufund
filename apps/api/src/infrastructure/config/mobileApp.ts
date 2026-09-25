/**
 * Native app release policy served publicly at GET /api/v1/app/config.
 *
 * MIN_APP_VERSION_IOS / MIN_APP_VERSION_ANDROID (e.g. `1.2.0`) make store
 * builds older than that version show a blocking "Update required" screen.
 * Both are unset by default, so no build is ever blocked until the owner
 * opts in. Raise them only once the required build is live in that store,
 * for example after bumping LEGAL_ACCEPTANCE_VERSION (older builds send the
 * old version and can no longer register or re-accept).
 */
export interface MobileAppConfig {
  minSupportedVersion: { ios: string | null; android: string | null };
  storeUrls: { ios: string | null; android: string | null };
}

const VERSION = /^\d{1,6}(\.\d{1,6}){0,3}$/;
export const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ujimora.app';

function minimumVersion(env: NodeJS.ProcessEnv, name: string): string | null {
  const raw = (env[name] ?? '').trim();
  if (!raw) return null;
  if (!VERSION.test(raw)) throw new Error(`${name} must be a numeric app version such as 1.2.0`);
  return raw;
}

function storeUrl(env: NodeJS.ProcessEnv, name: string, fallback: string | null): string | null {
  const raw = (env[name] ?? '').trim();
  if (!raw) return fallback;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error(`${name} must be an https:// store URL`); }
  if (url.protocol !== 'https:') throw new Error(`${name} must be an https:// store URL`);
  return url.toString();
}

export function loadMobileAppConfig(env: NodeJS.ProcessEnv = process.env): MobileAppConfig {
  return {
    minSupportedVersion: {
      ios: minimumVersion(env, 'MIN_APP_VERSION_IOS'),
      android: minimumVersion(env, 'MIN_APP_VERSION_ANDROID'),
    },
    storeUrls: {
      ios: storeUrl(env, 'APP_STORE_URL_IOS', null),
      android: storeUrl(env, 'APP_STORE_URL_ANDROID', DEFAULT_PLAY_STORE_URL),
    },
  };
}
