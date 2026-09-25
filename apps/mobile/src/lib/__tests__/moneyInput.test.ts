import { describe, expect, it } from 'vitest'
import { parseMoneyInput, sanitizeMoneyInput, validTopUpAmount } from '../moneyInput'

// I121: "1.005" was shown as GH₵1.01 but charged GH₵1.00, and "100,50" became 10050.
describe('money input parsing', () => {
  it.each([
    ['10', 10], ['10.5', 10.5], ['100.50', 100.5], ['100,50', 100.5], [' 25 ', 25], ['0.01', 0.01],
  ])('accepts %j as %d', (raw, expected) => expect(parseMoneyInput(raw)).toBe(expected))
  it.each(['', '1.005', '1,000.50', '1,000', '1.2.3', 'abc', '-5', '.5', '1e3', '10,'])('rejects %j', (raw) => {
    expect(parseMoneyInput(raw)).toBeNaN()
  })
  it('keeps the comma while typing so it is never silently dropped', () => {
    expect(sanitizeMoneyInput('GH₵ 100,50')).toBe('100,50')
    expect(parseMoneyInput(sanitizeMoneyInput('100,50'))).toBe(100.5)
  })
})

// I127: 0.01–0.99 enabled the Android button although the API needs GHS 1+.
describe('wallet top-up amount bounds', () => {
  it.each([['1', true], ['10000', true], ['100,50', true], ['0.5', false], ['0.99', false], ['10000.01', false], ['0', false], ['', false]])('%j → %s', (raw, ok) => {
    expect(validTopUpAmount(raw)).toBe(ok)
  })
})
