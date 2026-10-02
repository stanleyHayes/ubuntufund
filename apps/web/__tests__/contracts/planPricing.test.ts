import { describe, expect, it } from 'vitest'
import { yearlyPricePerMonth } from '@ubuntu-fund/types'
import { formatCurrency } from '@ubuntu-fund/ui'

// Web, marketing and mobile all show a yearly plan as a per-month figure, so
// they share one helper that works in whole pesewas.
describe('yearly price per month', () => {
  it('divides the yearly price in pesewas and rounds to the pesewa', () => {
    expect(yearlyPricePerMonth(99)).toBe(8.25)
    expect(yearlyPricePerMonth(299)).toBe(24.92)
    expect(yearlyPricePerMonth(3990)).toBe(332.5)
    expect(yearlyPricePerMonth(9999.9)).toBe(833.33)
    expect(yearlyPricePerMonth(0)).toBe(0)
  })

  it('reads with two decimals once formatted, never one', () => {
    expect(formatCurrency(yearlyPricePerMonth(3990))).toBe('GH₵332.50')
    expect(formatCurrency(yearlyPricePerMonth(99))).toBe('GH₵8.25')
  })
})
