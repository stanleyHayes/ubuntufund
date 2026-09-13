import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ remove: vi.fn(), files: vi.fn(), exists: true }))
vi.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///app/cache/' } },
  File: class {
    exists = state.exists
    constructor(uri: string) { state.files(uri) }
    delete() { state.remove() }
  },
}))
import { discardUploadCache } from '../uploadCache'
beforeEach(() => { state.remove.mockReset(); state.files.mockReset(); state.exists = true })
it('removes an app-owned picker cache file and handles an already removed copy', () => {
  expect(discardUploadCache('file:///app/cache/DocumentPicker/identity.pdf')).toBe(true)
  expect(state.remove).toHaveBeenCalledOnce()
  state.exists = false
  expect(discardUploadCache('file:///app/cache/ImagePicker/selfie.jpg')).toBe(true)
  expect(state.remove).toHaveBeenCalledOnce()
})
it.each(['file:///app/Documents/identity.pdf', 'content://documents/123', 'https://example.test/identity.pdf', 'file:///app/cache-other/photo.jpg', 'file:///app/cache/', 'file:///app/cache/../Documents/id.pdf', 'file:///app/cache/%2e%2e/Documents/id.pdf', 'file:///app/cache/%2e%2e%2fDocuments/id.pdf', 'file://another-host/app/cache/id.pdf'])('preserves source files and paths outside the cache: %s', uri => {
  expect(discardUploadCache(uri)).toBe(false)
  expect(state.files).not.toHaveBeenCalled()
  expect(state.remove).not.toHaveBeenCalled()
})
it('surfaces deletion failure so the UI can report incomplete local cleanup', () => {
  state.remove.mockImplementation(() => { throw new Error('Device storage error') })
  expect(() => discardUploadCache('file:///app/cache/id.pdf')).toThrow('Device storage error')
})
