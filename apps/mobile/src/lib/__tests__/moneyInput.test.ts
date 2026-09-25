import { describe, expect, it } from 'vitest'
import { parseMoneyInput, sanitizeMoneyInput } from '../moneyInput'

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
