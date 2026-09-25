import { describe, expect, it } from 'vitest'
import { compareVersions, formatAppVersion, installedVersion, updateRequirement } from '../appUpdate'

describe('minimum supported app version', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBe(1)
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.0', '1.2.1')).toBe(-1)
    expect(compareVersions('2', '10')).toBe(-1)
    expect(compareVersions('1.2.0-beta', '1.0.0')).toBeNull()
    expect(compareVersions('', '1.0.0')).toBeNull()
  })

  it('requires an update only when this build is below the platform minimum', () => {
    const policy = { minSupportedVersion: { ios: '1.3.0', android: null }, storeUrls: { ios: 'https://apps.apple.com/app/id1', android: 'https://play.google.com/store/apps/details?id=com.ujimora.app' } }
    expect(updateRequirement(policy, 'ios', '1.2.9')).toEqual({ minimum: '1.3.0', storeUrl: 'https://apps.apple.com/app/id1' })
    expect(updateRequirement(policy, 'ios', '1.3.0')).toBeNull()
    expect(updateRequirement(policy, 'ios', '1.4')).toBeNull()
    expect(updateRequirement(policy, 'android', '0.1.0')).toBeNull()
  })

  it('fails open when there is no minimum, no version, a web build or an unparseable value', () => {
    expect(updateRequirement({}, 'ios', '1.0.0')).toBeNull()
    expect(updateRequirement(null, 'android', '1.0.0')).toBeNull()
    expect(updateRequirement({ minSupportedVersion: { ios: '2.0.0' } }, 'ios', undefined)).toBeNull()
    expect(updateRequirement({ minSupportedVersion: { ios: '2.0.0' } }, 'web', '1.0.0')).toBeNull()
    expect(updateRequirement({ minSupportedVersion: { android: 'latest' } }, 'android', '1.0.0')).toBeNull()
  })

  it('falls back to the store itself when no https listing link is configured', () => {
    expect(updateRequirement({ minSupportedVersion: { android: '2.0.0' } }, 'android', '1.0.0')?.storeUrl).toBe('https://play.google.com/store/apps/details?id=com.ujimora.app')
    expect(updateRequirement({ minSupportedVersion: { ios: '2.0.0' }, storeUrls: { ios: 'javascript:alert(1)' } }, 'ios', '1.0.0')?.storeUrl).toBe('itms-apps://apps.apple.com/')
  })
})

describe('build-level minimums (EAS auto-increments only the build number)', () => {
  const android = (minimum: string) => ({ minSupportedVersion: { android: minimum } })

  it('appends the native build number to the marketing version', () => {
    expect(installedVersion('1.0.0', '7')).toBe('1.0.0.7')
    expect(installedVersion('1.2', '15')).toBe('1.2.0.15')
    expect(installedVersion('1.0.0', null)).toBe('1.0.0')
    expect(installedVersion('1.0.0', '1.0.3')).toBe('1.0.0')
    expect(installedVersion('1.0.0.1', '7')).toBe('1.0.0.1')
    expect(installedVersion(undefined, '7')).toBeNull()
  })

  it('retires older builds of the same 1.0.0 without locking out the fixed build', () => {
    expect(updateRequirement(android('1.0.0.7'), 'android', installedVersion('1.0.0', '6'))).toMatchObject({ minimum: '1.0.0.7' })
    expect(updateRequirement(android('1.0.0.7'), 'android', installedVersion('1.0.0', '7'))).toBeNull()
    expect(updateRequirement(android('1.0.0.7'), 'android', installedVersion('1.0.1', '3'))).toBeNull()
  })

  it('keeps three-part minimums working as before', () => {
    expect(updateRequirement(android('1.0.0'), 'android', installedVersion('1.0.0', '6'))).toBeNull()
    expect(updateRequirement(android('1.0.1'), 'android', installedVersion('1.0.0', '99'))).toMatchObject({ minimum: '1.0.1' })
  })

  it('checks only the version part of a build-level minimum when the build number is unknown', () => {
    expect(updateRequirement(android('1.0.0.7'), 'android', installedVersion('1.0.0', null))).toBeNull()
    expect(updateRequirement(android('1.1.0.2'), 'android', installedVersion('1.0.0', null))).toMatchObject({ minimum: '1.1.0.2' })
  })

  it('shows build-level versions readably', () => {
    expect(formatAppVersion('1.0.0.7')).toBe('1.0.0, build 7')
    expect(formatAppVersion('1.2.0')).toBe('1.2.0')
  })
})
