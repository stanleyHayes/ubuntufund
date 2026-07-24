import { describe, it, expect } from 'vitest'
import { Money } from '../../../src/domain/value-objects/Money.js'

describe('Money', () => {
  describe('constructor', () => {
    it('creates a money value with amount and currency', () => {
      const money = new Money(100, 'GHS')
      expect(money.amount).toBe(100)
      expect(money.currency).toBe('GHS')
    })

    it('uppercases the currency code', () => {
      const money = new Money(50, 'ghs')
      expect(money.currency).toBe('GHS')
    })

    it('rounds to two decimal places', () => {
      const money = new Money(10.555, 'GHS')
      expect(money.amount).toBe(10.56)
    })

    it('throws for negative amounts', () => {
      expect(() => new Money(-1, 'GHS')).toThrow('Money amount cannot be negative')
    })

    it('throws for invalid currency codes', () => {
      expect(() => new Money(100, '')).toThrow('Invalid currency code')
      expect(() => new Money(100, 'A')).toThrow('Invalid currency code')
    })
  })

  describe('add', () => {
    it('returns a new Money with the sum', () => {
      const a = new Money(100, 'GHS')
      const b = new Money(200, 'GHS')
      const result = a.add(b)
      expect(result.amount).toBe(300)
      expect(result.currency).toBe('GHS')
    })

    it('throws on currency mismatch', () => {
      const a = new Money(100, 'GHS')
      const b = new Money(200, 'USD')
      expect(() => a.add(b)).toThrow('Currency mismatch')
    })
  })

  describe('subtract', () => {
    it('returns a new Money with the difference', () => {
      const a = new Money(300, 'GHS')
      const b = new Money(100, 'GHS')
      const result = a.subtract(b)
      expect(result.amount).toBe(200)
      expect(result.currency).toBe('GHS')
    })

    it('throws on insufficient funds', () => {
      const a = new Money(50, 'GHS')
      const b = new Money(100, 'GHS')
      expect(() => a.subtract(b)).toThrow('Insufficient funds')
    })

    it('throws on currency mismatch', () => {
      const a = new Money(300, 'GHS')
      const b = new Money(100, 'USD')
      expect(() => a.subtract(b)).toThrow('Currency mismatch')
    })
  })

  describe('equals', () => {
    it('returns true for same amount and currency', () => {
      const a = new Money(100, 'GHS')
      const b = new Money(100, 'GHS')
      expect(a.equals(b)).toBe(true)
    })

    it('returns false for different amounts', () => {
      const a = new Money(100, 'GHS')
      const b = new Money(200, 'GHS')
      expect(a.equals(b)).toBe(false)
    })

    it('returns false for different currencies', () => {
      const a = new Money(100, 'GHS')
      const b = new Money(100, 'USD')
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('isGreaterThan', () => {
    it('returns true when amount is greater', () => {
      const a = new Money(200, 'GHS')
      const b = new Money(100, 'GHS')
      expect(a.isGreaterThan(b)).toBe(true)
    })

    it('returns false when amount is less or equal', () => {
      const a = new Money(100, 'GHS')
      const b = new Money(200, 'GHS')
      expect(a.isGreaterThan(b)).toBe(false)
    })
  })

  describe('isZero', () => {
    it('returns true for zero amount', () => {
      expect(new Money(0, 'GHS').isZero()).toBe(true)
    })

    it('returns false for non-zero amount', () => {
      expect(new Money(1, 'GHS').isZero()).toBe(false)
    })
  })
})
