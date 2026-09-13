/** Calendar-date boundary for the platform's 18+ account policy, in Ghana/UTC. */
export function latestAdultBirthDate(now = new Date()): string {
  const year = now.getUTCFullYear() - 18
  const month = now.getUTCMonth()
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
  return `${year.toString().padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function adultBirthDateError(value: string | Date | undefined, now = new Date()): string | null {
  const raw = value instanceof Date ? (Number.isFinite(value.getTime()) ? value.toISOString() : '') : value ?? ''
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(raw) || !Number.isFinite(Date.parse(raw))) return 'Enter a valid date of birth.'
  const date = raw.slice(0, 10)
  if (new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date || date.startsWith('0000')) return 'Enter a valid date of birth.'
  if (date > latestAdultBirthDate(now)) return 'You must be at least 18 to verify an Ujimora account.'
  return null
}
