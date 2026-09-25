import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
const m = vi.hoisted(() => ({ openURL: vi.fn(async () => true), change: (_state: string) => {} }))
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  StyleSheet: { absoluteFill: {} },
  Linking: { openURL: m.openURL },
  View: ({ children }: { children: React.ReactNode }) => createElement('div', { role: 'dialog' }, children),
  AppState: { addEventListener: (_event: string, callback: (state: string) => void) => { m.change = callback; return { remove: () => {} } } },
}))
vi.mock('react-native-paper', () => ({ Text: 'span' }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}) }))
vi.mock('../UjimoraLogo', () => ({ UjimoraLogo: () => null }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => createElement('button', { onClick: onPress }, children) }))
import { UpdateRequiredGate } from '../UpdateRequiredGate'
beforeEach(() => { vi.mocked(api.get).mockReset(); m.openURL.mockClear() })
afterEach(cleanup)

it('stays out of the way when no minimum version is configured (the default)', async () => {
  vi.mocked(api.get).mockResolvedValue({ minSupportedVersion: { ios: null, android: null }, storeUrls: { ios: null, android: null } })
  render(createElement(UpdateRequiredGate, { version: '1.0.0' }))
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/app/config'))
  expect(screen.queryByText('Update required')).toBeNull()
})

it('blocks an outdated build and links to the store listing', async () => {
  vi.mocked(api.get).mockResolvedValue({ minSupportedVersion: { android: '1.2.0' }, storeUrls: { android: 'https://play.google.com/store/apps/details?id=com.ujimora.app' } })
  render(createElement(UpdateRequiredGate, { version: '1.0.0' }))
  expect(await screen.findByText('Update required')).toBeTruthy()
  expect(screen.getByText(/version 1\.2\.0 or later from Google Play/)).toBeTruthy()
  fireEvent.click(screen.getByText('Update Ujimora'))
  expect(m.openURL).toHaveBeenCalledWith('https://play.google.com/store/apps/details?id=com.ujimora.app')
})

it('fails open when the policy cannot be fetched and re-checks when the app resumes', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'))
  render(createElement(UpdateRequiredGate, { version: '1.0.0' }))
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
  expect(screen.queryByText('Update required')).toBeNull()
  vi.mocked(api.get).mockResolvedValueOnce({ minSupportedVersion: { android: '2.0.0' } })
  act(() => m.change('active'))
  expect(await screen.findByText('Update required')).toBeTruthy()
})
