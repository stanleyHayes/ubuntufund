import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BiometricUnlockError } from '@/lib/unlockError'
const m = vi.hoisted(() => ({ unlock: vi.fn(), end: vi.fn() }))
vi.mock('react-native', () => ({ View: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children) }))
vi.mock('react-native-paper', () => ({ Text: 'span' }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}) }))
vi.mock('@/lib/session', () => ({ unlockBiometricSession: m.unlock, endSession: m.end }))
vi.mock('../UjimoraLogo', () => ({ UjimoraLogo: () => null }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
import { BiometricLock } from '../BiometricLock'
afterEach(cleanup)

it('tells the user when biometric unlock has expired instead of a generic retry', async () => {
  m.unlock.mockRejectedValueOnce(new BiometricUnlockError('Biometric unlock has expired. Sign in with your password.'))
  render(createElement(BiometricLock))
  fireEvent.click(screen.getByText('Unlock with biometrics'))
  expect(await screen.findByText('Biometric unlock has expired. Sign in with your password.')).toBeTruthy()
})

it('keeps raw native errors out of the lock screen', async () => {
  m.unlock.mockRejectedValueOnce(new Error('com.apple.LocalAuthentication error -128'))
  render(createElement(BiometricLock))
  fireEvent.click(screen.getByText('Unlock with biometrics'))
  expect(await screen.findByText(/Could not unlock\. Try again/)).toBeTruthy()
  expect(screen.queryByText(/LocalAuthentication/)).toBeNull()
})
