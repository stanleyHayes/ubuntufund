import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ write: vi.fn(), remove: vi.fn(), share: vi.fn(), available: vi.fn(), list: vi.fn() }))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: mocks.write, deleteAsync: mocks.remove, readDirectoryAsync: mocks.list }))
vi.mock('expo-sharing', () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }))
import { downloadRecoveryCodes, cleanupRecoveryCodeCache } from '../recoveryCodes'
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

it('removes interrupted older exports without touching current exports or unrelated files', async () => {
  mocks.list.mockResolvedValue(['ujimora-recovery-codes-100.txt', 'ujimora-recovery-codes-200.txt',
    'ujimora-recovery-codes-201.txt', 'my-recovery-codes.txt', '../ujimora-recovery-codes-100.txt',
    'ujimora-recovery-codes-invalid.txt', 'ujimora-recovery-codes-99999999999999999999.txt'])
  await cleanupRecoveryCodeCache(200)
  expect(mocks.remove.mock.calls).toEqual([['file:///cache/ujimora-recovery-codes-100.txt', { idempotent: true }]])
})
it('attempts all old export removals and reports cleanup failure without including codes or paths', async () => {
  mocks.list.mockResolvedValue(['ujimora-recovery-codes-100.txt', 'ujimora-recovery-codes-101.txt'])
  mocks.remove.mockRejectedValueOnce(new Error('private path'))
  await expect(cleanupRecoveryCodeCache(200)).rejects.toThrow('Temporary recovery-code cleanup could not complete.')
  expect(mocks.remove).toHaveBeenCalledTimes(2)
})
