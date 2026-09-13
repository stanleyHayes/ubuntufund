import { beforeEach, expect, it, vi } from 'vitest'
import { loadAll } from '@/lib/exports/loadAll'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))
beforeEach(() => vi.mocked(api.get).mockReset())
it('loads all server pages and preserves filter parameters', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ items: [{ id: 'one' }, { id: 'two' }], total: 3 }).mockResolvedValueOnce({ items: [{ id: 'three' }], total: 3 })
  expect(await loadAll('/audit?search=review&page=7')).toHaveLength(3)
  expect(api.get).toHaveBeenNthCalledWith(1, '/audit?search=review&page=1&pageSize=100', { signal: undefined })
  expect(api.get).toHaveBeenNthCalledWith(2, '/audit?search=review&page=2&pageSize=100', { signal: undefined })
})
it('fails on changing totals, repeated IDs and empty intermediate pages', async () => {
  for (const second of [{ items: [{ id: 'two' }], total: 3 }, { items: [{ id: 'one' }], total: 2 }, { items: [], total: 2 }]) {
    vi.mocked(api.get).mockReset().mockResolvedValueOnce({ items: [{ id: 'one' }], total: 2 }).mockResolvedValueOnce(second)
    await expect(loadAll('/audit')).rejects.toThrow()
  }
})
it('does not return partial data after cancellation or a denied page', async () => {
  const controller = new AbortController()
  vi.mocked(api.get).mockImplementationOnce(async () => { controller.abort(); return { items: [{ id: 'one' }], total: 1 } })
  await expect(loadAll('/users', { signal: controller.signal })).rejects.toThrow()
  vi.mocked(api.get).mockReset().mockResolvedValueOnce({ items: [{ id: 'one' }], total: 2 }).mockRejectedValueOnce(new Error('Permission denied'))
  await expect(loadAll('/users')).rejects.toThrow('Permission denied')
})
it('supports explicitly selected queue collections and valid empty results', async () => {
  vi.mocked(api.get).mockResolvedValue({ purchases: [], purchaseTotal: 0 })
  expect(await loadAll('/queue', {}, result => ({ items: (result as { purchases: never[] }).purchases, total: (result as { purchaseTotal: number }).purchaseTotal }))).toEqual([])
})
