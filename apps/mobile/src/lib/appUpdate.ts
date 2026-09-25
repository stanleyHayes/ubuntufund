import { api } from './api'

/** Policy from the public GET /app/config endpoint. */
export interface AppReleasePolicy {
  minSupportedVersion?: { ios?: string | null; android?: string | null } | null
  storeUrls?: { ios?: string | null; android?: string | null } | null
}

export interface UpdateRequirement { minimum: string; storeUrl: string }

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ujimora.app'
// Opens the App Store app when no listing link is configured yet.
const APP_STORE_FALLBACK = 'itms-apps://apps.apple.com/'

function parseVersion(value: string): number[] | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)*$/.test(trimmed)) return null
  return trimmed.split('.').map(Number)
}

/**
 * Numeric dotted-version comparison ('1.10.0' > '1.9.2', '1.2' == '1.2.0').
 * Returns null when either side is not a plain numeric version.
 */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a), right = parseVersion(b)
  if (!left || !right) return null
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/**
 * Whether this build must be updated before it can be used. Anything
 * missing or unparseable (no minimum configured, unknown platform, a dev
 * build without a version) fails open, so a policy problem never locks
 * people out of the app.
 */
export function updateRequirement(policy: AppReleasePolicy | null | undefined, platform: string, currentVersion: string | null | undefined): UpdateRequirement | null {
  if (platform !== 'ios' && platform !== 'android') return null
  const minimum = policy?.minSupportedVersion?.[platform]
  if (!minimum || !currentVersion) return null
  if (compareVersions(currentVersion, minimum) !== -1) return null
  const configured = policy?.storeUrls?.[platform]
  const storeUrl = configured && /^https:\/\//.test(configured) ? configured : platform === 'android' ? PLAY_STORE_URL : APP_STORE_FALLBACK
  return { minimum, storeUrl }
}

export function fetchReleasePolicy(): Promise<AppReleasePolicy> {
  return api.get<AppReleasePolicy>('/app/config')
}
