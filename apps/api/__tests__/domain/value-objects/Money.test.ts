import { describe, it, expect } from 'vitest'
import { Money } from '../../../src/domain/value-objects/Money.js'

describe('Money', () => {
  describe('constructor', () => {
    it('creates a money value with amount and currency', () => {
      const money = new Money(100, 'KES')
      expect(money.amount).toBe(100)
      expect(money.currency).toBe('KES')
    })

    it('uppercases the currency code', () => {
      const money = new Money(50, 'kes')
      expect(money.currency).toBe('KES')
    })

    it('rounds to two decimal places', () => {
      const money = new Money(10.555, 'USD')
      expect(money.amount).toBe(10.56)
    })

    it('throws for negative amounts', () => {
      expect(() => new Money(-1, 'USD')).toThrow('Money amount cannot be negative')
    })

    it('throws for invalid currency codes', () => {
      expect(() => new Money(100, '')).toThrow('Invalid currency code')
      expect(() => new Money(100, 'A')).toThrow('Invalid currency code')
    })
  })

  describe('add', () => {
    it('returns a new Money with the sum', () => {
      const a = new Money(100, 'KES')
      const b = new Money(200, 'KES')
      const result = a.add(b)
      expect(result.amount).toBe(300)
      expect(result.currency).toBe('KES')
    })

    it('throws on currency mismatch', () => {
      const a = new Money(100, 'KES')
      const b = new Money(200, 'USD')
      expect(() => a.add(b)).toThrow('Currency mismatch')
    })
  })

  describe('subtract', () => {
    it('returns a new Money with the difference', () => {
      const a = new Money(300, 'KES')
      const b = new Money(100, 'KES')
      const result = a.subtract(b)
      expect(result.amount).toBe(200)
      expect(result.currency).toBe('KES')
    })

    it('throws on insufficient funds', () => {
      const a = new Money(50, 'KES')
      const b = new Money(100, 'KES')
      expect(() => a.subtract(b)).toThrow('Insufficient funds')
    })

    it('throws on currency mismatch', () => {
      const a = new Money(300, 'KES')
      const b = new Money(100, 'USD')
      expect(() => a.subtract(b)).toThrow('Currency mismatch')
    })
  })

  describe('equals', () => {
    it('returns true for same amount and currency', () => {
      const a = new Money(100, 'KES')
      const b = new Money(100, 'KES')
      expect(a.equals(b)).toBe(true)
    })

    it('returns false for different amounts', () => {
      const a = new Money(100, 'KES')
      const b = new Money(200, 'KES')
      expect(a.equals(b)).toBe(false)
    })

    it('returns false for different currencies', () => {
      const a = new Money(100, 'KES')
      const b = new Money(100, 'USD')
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('isGreaterThan', () => {
    it('returns true when amount is greater', () => {
      const a = new Money(200, 'KES')
      const b = new Money(100, 'KES')
      expect(a.isGreaterThan(b)).toBe(true)
    })

    it('returns false when amount is less or equal', () => {
      const a = new Money(100, 'KES')
      const b = new Money(200, 'KES')
      expect(a.isGreaterThan(b)).toBe(false)
    })
  })

  describe('isZero', () => {
    it('returns true for zero amount', () => {
      expect(new Money(0, 'KES').isZero()).toBe(true)
    })

    it('returns false for non-zero amount', () => {
      expect(new Money(1, 'KES').isZero()).toBe(false)
    })
  })
})
