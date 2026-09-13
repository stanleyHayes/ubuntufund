import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ write: vi.fn(), remove: vi.fn(), share: vi.fn(), available: vi.fn() }))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: mocks.write, deleteAsync: mocks.remove }))
vi.mock('expo-sharing', () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }))
import { downloadRecoveryCodes } from '../recoveryCodes'
beforeEach(() => { vi.resetAllMocks(); mocks.available.mockResolvedValue(true); mocks.write.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); mocks.share.mockResolvedValue(undefined) })
it('exports the exact codes to a local file and removes it when the save sheet closes', async () => {
  await downloadRecoveryCodes(['private-code-1', 'private-code-2'])
  const path = mocks.write.mock.calls[0][0]
  expect(path).toMatch(/^file:\/\/\/cache\/ujimora-recovery-codes-\d+\.txt$/)
  expect(mocks.write.mock.calls[0][1]).toContain('private-code-1\nprivate-code-2')
  expect(mocks.share).toHaveBeenCalledWith(path, expect.objectContaining({ mimeType: 'text/plain' }))
  expect(mocks.remove).toHaveBeenCalledWith(path, { idempotent: true })
})
it('also removes temporary plaintext after a failed save and reports unavailable sharing before writing', async () => {
  mocks.share.mockRejectedValueOnce(new Error('save failed'))
  await expect(downloadRecoveryCodes(['private-code'])).rejects.toThrow('save failed')
  expect(mocks.remove).toHaveBeenCalledTimes(1)
  mocks.available.mockResolvedValue(false); mocks.write.mockClear()
  await expect(downloadRecoveryCodes(['private-code'])).rejects.toThrow('Copy the codes instead')
  expect(mocks.write).not.toHaveBeenCalled()
})
