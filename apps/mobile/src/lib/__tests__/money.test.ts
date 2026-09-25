import { describe, expect, it } from 'vitest'
import { formatAmountValue, formatMoney } from '../money'

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
