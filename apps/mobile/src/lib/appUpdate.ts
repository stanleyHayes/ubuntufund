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
 * This install as a comparable version: the marketing version plus the
 * native build number as a fourth part ('1.0.0' build 7 -> '1.0.0.7').
 *
 * EAS (appVersionSource "remote", autoIncrement) bumps only the build number
 * (iOS CFBundleVersion, Android versionCode), and Google Play accepts
 * successive builds that all report 1.0.0. A minimum of '1.0.0.7' can then
 * retire builds 1-6 without blocking build 7. Three-part minimums behave as
 * before ('1.0.0.7' is not below '1.0.0'). A missing, dotted or non-numeric
 * build number, or a version that already has four parts, leaves the
 * marketing version as is.
 */
export function installedVersion(version: string | null | undefined, build: string | null | undefined): string | null {
  if (!version) return null
  const parts = parseVersion(version)
  const buildNumber = build?.trim() ?? ''
  if (!parts || parts.length > 3 || !/^\d{1,9}$/.test(buildNumber)) return version
  return [...parts, 0, 0].slice(0, 3).concat(Number(buildNumber)).join('.')
}

/** '1.0.0.7' -> '1.0.0, build 7' for people; other versions unchanged. */
export function formatAppVersion(value: string): string {
  const parts = parseVersion(value)
  return parts && parts.length === 4 ? `${parts.slice(0, 3).join('.')}, build ${parts[3]}` : value
}

/**
 * Whether this build must be updated before it can be used. Anything
 * missing or unparseable (no minimum configured, unknown platform, a dev
 * build without a version) fails open, so a policy problem never locks
 * people out of the app. `currentVersion` should come from
 * {@link installedVersion}; without a build number, a build-level minimum
 * ('1.0.0.7') is checked on its version part only.
 */
export function updateRequirement(policy: AppReleasePolicy | null | undefined, platform: string, currentVersion: string | null | undefined): UpdateRequirement | null {
  if (platform !== 'ios' && platform !== 'android') return null
  const minimum = policy?.minSupportedVersion?.[platform]
  if (!minimum || !currentVersion) return null
  const minimumParts = parseVersion(minimum), currentParts = parseVersion(currentVersion)
  const comparable = minimumParts && currentParts && minimumParts.length > 3 && currentParts.length <= 3 ? minimumParts.slice(0, 3).join('.') : minimum
  if (compareVersions(currentVersion, comparable) !== -1) return null
  const configured = policy?.storeUrls?.[platform]
  const storeUrl = configured && /^https:\/\//.test(configured) ? configured : platform === 'android' ? PLAY_STORE_URL : APP_STORE_FALLBACK
  return { minimum, storeUrl }
}

export function fetchReleasePolicy(): Promise<AppReleasePolicy> {
  return api.get<AppReleasePolicy>('/app/config')
}
