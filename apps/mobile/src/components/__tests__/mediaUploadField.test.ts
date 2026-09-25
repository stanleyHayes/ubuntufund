import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
const m = vi.hoisted(() => ({ openSettings: vi.fn(async () => {}), permission: vi.fn(), camera: vi.fn(), discard: vi.fn() }))
vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => createElement('div', {}, children),
  Image: () => null,
  Linking: { openSettings: m.openSettings, openURL: vi.fn() },
}))
vi.mock('react-native-paper', () => ({ Text: 'span' }))
vi.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: m.permission, launchCameraAsync: m.camera, launchImageLibraryAsync: vi.fn() }))
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }))
vi.mock('expo-file-system', () => ({ File: class { size = 1024; async arrayBuffer() { return new ArrayBuffer(8) } } }))
vi.mock('@/lib/uploadCache', () => ({ discardUploadCache: m.discard }))
vi.mock('@/lib/session', () => ({ withExternalActivity: <T,>(work: () => Promise<T>) => work() }))
vi.mock('@/components/RoundedControls', () => ({ IconButton: () => null }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({}) }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) => createElement('button', { onClick: onPress, disabled }, children) }))
import { MediaUploadField } from '../MediaUploadField'
beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)
const props = { label: 'Selfie', value: '', onChange: vi.fn() }

it('offers Open Settings once camera access has been permanently declined', async () => {
  m.permission.mockResolvedValue({ granted: false, canAskAgain: false })
  render(createElement(MediaUploadField, props))
  fireEvent.click(screen.getByText('Camera'))
  expect(await screen.findByText(/Camera access is off for Ujimora/)).toBeTruthy()
  fireEvent.click(screen.getByText('Open Settings'))
  expect(m.openSettings).toHaveBeenCalledTimes(1)
  expect(m.camera).not.toHaveBeenCalled()
})

it('does not offer Settings while the system can still ask', async () => {
  m.permission.mockResolvedValue({ granted: false, canAskAgain: true })
  render(createElement(MediaUploadField, props))
  fireEvent.click(screen.getByText('Camera'))
  expect(await screen.findByText(/Camera permission is needed/)).toBeTruthy()
  expect(screen.queryByText('Open Settings')).toBeNull()
})

it('releases the busy state and removes the local copy when an upload times out', async () => {
  const busy = vi.fn()
  m.permission.mockResolvedValue({ granted: true, canAskAgain: true })
  m.camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/ImagePicker/selfie.jpg', mimeType: 'image/jpeg' }] })
  vi.mocked(api).upload = vi.fn().mockRejectedValue(new Error('Ujimora took too long to respond. Check your connection and try again.'))
  render(createElement(MediaUploadField, { ...props, onBusyChange: busy }))
  fireEvent.click(screen.getByText('Camera'))
  expect(await screen.findByText(/took too long/)).toBeTruthy()
  await waitFor(() => expect(busy).toHaveBeenLastCalledWith(false))
  expect(busy).toHaveBeenCalledWith(true)
  expect(m.discard).toHaveBeenCalledWith('file:///cache/ImagePicker/selfie.jpg')
  expect((screen.getByText('Camera') as HTMLButtonElement).disabled).toBe(false)
})
