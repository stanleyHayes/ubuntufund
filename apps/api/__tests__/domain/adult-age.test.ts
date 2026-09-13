import { expect, it } from 'vitest'
import { adultBirthDateError, latestAdultBirthDate } from '@ubuntu-fund/types'

it('checks the calendar birthday at the 18-year boundary in UTC', () => {
  const now = new Date('2026-09-12T00:00:00Z')
  expect(latestAdultBirthDate(now)).toBe('2008-09-12')
  expect(adultBirthDateError('2008-09-12', now)).toBeNull()
  expect(adultBirthDateError('2008-09-13', now)).toMatch(/at least 18/)
  expect(adultBirthDateError('2027-01-01', now)).toMatch(/at least 18/)
  for (const value of [undefined, '', 'invalid', '2001-02-29', '2000-02-30', '2000-13-01', new Date(NaN)]) {
    expect(adultBirthDateError(value, now)).toMatch(/valid date/)
  }
})

it('does not roll a leap-day cutoff into March or age a leap-day birthday early', () => {
  expect(latestAdultBirthDate(new Date('2024-02-29T12:00:00Z'))).toBe('2006-02-28')
  expect(adultBirthDateError('2008-02-29', new Date('2026-02-28T12:00:00Z'))).not.toBeNull()
  expect(adultBirthDateError('2008-02-29', new Date('2026-03-01T00:00:00Z'))).toBeNull()
})
