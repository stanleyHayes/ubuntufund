import { describe, expect, it } from 'vitest'
import { formatAmountValue, formatMoney, formatPlanPrice } from '../money'
import { yearlyPricePerMonth } from '@ubuntu-fund/types'

describe('money formatting', () => {
  it('always shows two decimals in cedis', () => {
    expect(formatMoney(100.5)).toBe('GH₵100.50')
    expect(formatMoney(30.299999999999997)).toBe('GH₵30.30')
    expect(formatMoney(1234567.891, 'GHS')).toBe('GH₵1,234,567.89')
    expect(formatMoney(0)).toBe('GH₵0.00')
  })
  it('uses the record currency when one is given', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('US$1,234.50')
    expect(formatMoney(10, 'ghs')).toBe('GH₵10.00')
    expect(formatMoney(10, null)).toBe('GH₵10.00')
  })
  it('falls back for codes Intl does not know and never prints NaN', () => {
    expect(formatMoney(12.5, 'USDT')).toBe('USDT 12.50')
    expect(formatMoney(Number.NaN)).toBe('GH₵0.00')
    expect(formatAmountValue(1500)).toBe('1,500.00')
  })
})

describe('plan prices', () => {
  it('match the web and marketing pricing pages: whole cedis bare, anything else two decimals', () => {
    expect(formatPlanPrice(3990)).toBe('GH₵3,990')
    expect(formatPlanPrice(9.99)).toBe('GH₵9.99')
    expect(formatPlanPrice(332.5)).toBe('GH₵332.50')
    expect(formatPlanPrice(0)).toBe('GH₵0')
    expect(formatPlanPrice(Number.NaN)).toBe('GH₵0')
  })
  it('shows a yearly price per month from the shared pesewa helper', () => {
    expect(formatPlanPrice(yearlyPricePerMonth(99))).toBe('GH₵8.25')
    expect(formatPlanPrice(yearlyPricePerMonth(3990))).toBe('GH₵332.50')
  })
})
