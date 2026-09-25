import { expect, it } from 'vitest'
import { forgotPasswordErrorMessage } from '../authMessages'

class FakeApiError extends Error { constructor(public status: number) { super('failed') } }

it('maps rate limits, validation and connectivity failures to actionable copy', () => {
  expect(forgotPasswordErrorMessage(new FakeApiError(429))).toMatch(/Too many attempts/)
  expect(forgotPasswordErrorMessage(new FakeApiError(400))).toBe('Enter a valid email address.')
  expect(forgotPasswordErrorMessage(new TypeError('Network request failed'))).toMatch(/reach Ujimora/)
  expect(forgotPasswordErrorMessage(new FakeApiError(0))).toMatch(/reach Ujimora/)
})

it('keeps the generic message for server failures and unknown errors', () => {
  expect(forgotPasswordErrorMessage(new FakeApiError(503))).toMatch(/temporarily unavailable/)
  expect(forgotPasswordErrorMessage(null)).toMatch(/temporarily unavailable/)
  expect(forgotPasswordErrorMessage('boom')).toMatch(/temporarily unavailable/)
})
