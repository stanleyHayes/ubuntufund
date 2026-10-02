/**
 * Dates on publication review cards. Every helper returns null for a missing or
 * unparseable value, so a card never shows "Invalid Date" or a raw timestamp.
 * Nothing here reads the clock: callers pass `now`.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function parse(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (value: number) => String(value).padStart(2, '0')

// Formatters are built once: a queue page formats many dates on every render.
let utcDayFormat: Intl.DateTimeFormat | undefined
let localFormat: Intl.DateTimeFormat | undefined
let relativeFormat: Intl.RelativeTimeFormat | undefined

function utcDay(date: Date): string {
  utcDayFormat ??= new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return utcDayFormat.format(date)
}

/** "28 Sept 2026, 14:05" in the reviewer's time zone. A date-only value shows just its date. */
export function formatDateTime(value: unknown): string | null {
  const date = parse(value)
  if (!date) return null
  if (DATE_ONLY.test(value as string)) return utcDay(date)
  localFormat ??= new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return localFormat.format(date)
}

/**
 * A stored calendar date, read in UTC where it was set: "31 Oct 2026". The time
 * is added (", 18:30 UTC") only when it is not midnight.
 */
export function formatUtcDate(value: unknown): string | null {
  const date = parse(value)
  if (!date) return null
  const midnight = date.getTime() % DAY_MS === 0
  return midnight ? utcDay(date) : `${utcDay(date)}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

/** A timestamp with its time always shown, in UTC: "31 Oct 2026, 00:00 UTC". */
export function formatUtcDateTime(value: unknown): string | null {
  const date = parse(value)
  if (!date) return null
  return `${utcDay(date)}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

/** "just now", "5 minutes ago", "in 3 days", "2 months ago": past and future. */
export function formatRelative(value: unknown, now: number): string | null {
  const date = parse(value)
  if (!date || !Number.isFinite(now)) return null
  const seconds = (date.getTime() - now) / 1000
  if (Math.abs(seconds) < 45) return 'just now'
  relativeFormat ??= new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const format = relativeFormat
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(seconds / 3600)
  if (Math.abs(hours) < 24) return format.format(hours, 'hour')
  const days = Math.round(seconds / 86400)
  if (Math.abs(days) < 30) return format.format(days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return format.format(months, 'month')
  return format.format(Math.round(days / 365), 'year')
}

/** Whole UTC calendar days from today to the value's date: 31 for "in 31 days", 0 for today, negative once passed. */
export function utcDayDiff(value: unknown, now: number): number | null {
  const date = parse(value)
  if (!date || !Number.isFinite(now)) return null
  return Math.floor(date.getTime() / DAY_MS) - Math.floor(now / DAY_MS)
}
