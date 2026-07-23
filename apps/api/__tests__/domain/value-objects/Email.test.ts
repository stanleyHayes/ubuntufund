import { describe, it, expect } from 'vitest'
import { Email } from '../../../src/domain/value-objects/Email.js'

describe('Email', () => {
  describe('valid emails', () => {
    it('accepts a standard email address', () => {
      const email = new Email('user@example.com')
      expect(email.value).toBe('user@example.com')
    })

    it('trims whitespace', () => {
      const email = new Email('  user@example.com  ')
      expect(email.value).toBe('user@example.com')
    })

    it('lowercases the email', () => {
      const email = new Email('User@Example.COM')
      expect(email.value).toBe('user@example.com')
    })

    it('accepts emails with dots in local part', () => {
      const email = new Email('first.last@example.com')
      expect(email.value).toBe('first.last@example.com')
    })

    it('accepts emails with subdomains', () => {
      const email = new Email('user@mail.example.co.ke')
      expect(email.value).toBe('user@mail.example.co.ke')
    })
  })

  describe('invalid emails', () => {
    it('throws for empty string', () => {
      expect(() => new Email('')).toThrow('Invalid email address')
    })

    it('throws for missing @ symbol', () => {
      expect(() => new Email('userexample.com')).toThrow('Invalid email address')
    })

    it('throws for missing domain', () => {
      expect(() => new Email('user@')).toThrow('Invalid email address')
    })

    it('throws for missing local part', () => {
      expect(() => new Email('@example.com')).toThrow('Invalid email address')
    })

    it('throws for spaces in email', () => {
      expect(() => new Email('user name@example.com')).toThrow(
        'Invalid email address'
      )
    })
  })

  describe('equals', () => {
    it('returns true for identical emails', () => {
      const a = new Email('user@example.com')
      const b = new Email('user@example.com')
      expect(a.equals(b)).toBe(true)
    })

    it('returns true for case-insensitive match', () => {
      const a = new Email('User@Example.com')
      const b = new Email('user@example.com')
      expect(a.equals(b)).toBe(true)
    })

    it('returns false for different emails', () => {
      const a = new Email('user@example.com')
      const b = new Email('other@example.com')
      expect(a.equals(b)).toBe(false)
    })
  })

  describe('toString', () => {
    it('returns the email value', () => {
      const email = new Email('user@example.com')
      expect(email.toString()).toBe('user@example.com')
    })
  })
})
