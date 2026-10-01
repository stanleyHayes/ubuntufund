import { afterEach, describe, expect, it } from 'vitest'
import { formatDateTime, formatRelative, formatUtcDate, formatUtcDateTime, utcDayDiff } from '@/lib/reviewDates'

const originalTimeZone = process.env.TZ
afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

describe('review dates', () => {
  it('reads a stored calendar date in UTC, whatever the reviewer’s time zone', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(formatUtcDate('2026-10-31T00:00:00.000Z')).toBe('31 Oct 2026')
    expect(formatUtcDate('2026-10-31T18:30:00.000Z')).toBe('31 Oct 2026, 18:30 UTC')
    expect(formatUtcDateTime('2026-10-31T00:00:00.000Z')).toBe('31 Oct 2026, 00:00 UTC')
  })

  it('describes times relative to now, in the past and the future', () => {
    const now = Date.parse('2026-09-30T12:00:00.000Z')
    expect(formatRelative('2026-09-30T11:59:40.000Z', now)).toBe('just now')
    expect(formatRelative('2026-09-30T11:55:00.000Z', now)).toBe('5 minutes ago')
    expect(formatRelative('2026-09-30T15:00:00.000Z', now)).toBe('in 3 hours')
    expect(formatRelative('2026-09-28T12:00:00.000Z', now)).toBe('2 days ago')
    expect(formatRelative('2026-10-03T12:00:00.000Z', now)).toBe('in 3 days')
    expect(formatRelative('2026-09-12', now)).toBe('18 days ago')
    expect(formatRelative('2026-06-30T12:00:00.000Z', now)).toBe('3 months ago')
    expect(formatRelative('2024-09-30T12:00:00.000Z', now)).toBe('2 years ago')
  })

  it('returns null for missing or invalid input, never "Invalid Date"', () => {
    for (const value of [undefined, null, '', 'soon', 42]) {
      expect(formatDateTime(value)).toBeNull()
      expect(formatUtcDate(value)).toBeNull()
      expect(formatUtcDateTime(value)).toBeNull()
      expect(formatRelative(value, Date.now())).toBeNull()
      expect(utcDayDiff(value, Date.now())).toBeNull()
    }
    expect(formatRelative('2026-09-12', Number.NaN)).toBeNull()
  })

  it('shows a date-only value as its date', () => {
    expect(formatDateTime('2026-09-12')).toBe('12 Sept 2026')
    expect(formatDateTime('2026-09-28T14:05:00.000Z')).toMatch(/^2[78] Sept 2026, \d{2}:\d{2}$/)
  })

  it('counts whole UTC days to a date', () => {
    const now = Date.parse('2026-09-30T23:30:00.000Z')
    expect(utcDayDiff('2026-10-31T00:00:00.000Z', now)).toBe(31)
    expect(utcDayDiff('2026-09-30T00:00:00.000Z', now)).toBe(0)
    expect(utcDayDiff('2026-09-27T00:00:00.000Z', now)).toBe(-3)
  })
})
