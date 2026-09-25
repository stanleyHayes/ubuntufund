import { expect, it } from 'vitest'
import { homeCardWidths, splashRingSizes } from '../layout'

it('sizes Home cards from the current window, capped on wide iPad windows', () => {
  expect(homeCardWidths(390)).toEqual({ card: 390 * 0.78, small: 390 * 0.6 })
  // Split View narrows the window: cards shrink with it instead of keeping the launch width.
  expect(homeCardWidths(320)).toEqual({ card: 320 * 0.78, small: 320 * 0.6 })
  expect(homeCardWidths(1366)).toEqual({ card: 420, small: 320 })
})

it('sizes the splash rings from the current window', () => {
  expect(splashRingSizes(400)).toEqual({ inner: 280, outer: 360 })
})
