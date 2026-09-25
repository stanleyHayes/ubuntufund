import { expect, it } from 'vitest'
import { permissionNeedsSettings } from '../OpenSettingsButton'

it('asks for Settings only after a permanent denial', () => {
  expect(permissionNeedsSettings({ granted: false, canAskAgain: false })).toBe(true)
  expect(permissionNeedsSettings({ granted: false, canAskAgain: true })).toBe(false)
  expect(permissionNeedsSettings({ granted: true, canAskAgain: false })).toBe(false)
  expect(permissionNeedsSettings({ granted: false })).toBe(false)
})
