import { beforeEach, expect, it, vi } from 'vitest'
const fs = vi.hoisted(() => {
  class File {
    constructor(public uri: string, public modificationTime: number | null, private owner: Map<string, unknown>) {}
    delete() { if (fs.fail.has(this.uri)) throw new Error('Device storage error'); fs.deleted.push(this.uri); this.owner.delete(this.uri) }
  }
  class Directory {
    uri: string
    constructor(...parts: (string | { uri: string })[]) { this.uri = parts.map(p => typeof p === 'string' ? p : p.uri).join('/') }
    get exists() { return fs.tree.has(this.uri) }
    list() { const entries = fs.tree.get(this.uri); return entries ? [...entries.values()] : [] }
  }
  return { File, Directory, tree: new Map<string, Map<string, unknown>>(), deleted: [] as string[], fail: new Set<string>(), listed: [] as string[] }
})
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('expo-file-system', () => ({ Paths: { cache: { uri: 'file:///app/cache' } }, File: fs.File, Directory: fs.Directory }))
import { cleanupPickerCache } from '../uploadCache'

function folder(uri: string, files: [string, number | null][], dirs: string[] = []) {
  const entries = new Map<string, unknown>()
  for (const [name, time] of files) entries.set(`${uri}/${name}`, new fs.File(`${uri}/${name}`, time, entries))
  for (const dir of dirs) entries.set(dir, new fs.Directory(dir))
  fs.tree.set(uri, entries)
}
beforeEach(() => { fs.tree.clear(); fs.deleted.length = 0; fs.fail.clear() })

it('removes only picker copies older than the cutoff, including nested ones', async () => {
  folder('file:///app/cache/ImagePicker', [['old-selfie.jpg', 1_000], ['fresh.jpg', 5_000], ['unknown-time.jpg', null]])
  folder('file:///app/cache/DocumentPicker', [], ['file:///app/cache/DocumentPicker/abc'])
  folder('file:///app/cache/DocumentPicker/abc', [['id-front.pdf', 2_000]])
  folder('file:///app/cache/Other', [['keep.txt', 1]])
  await cleanupPickerCache(4_000)
  expect(fs.deleted.sort()).toEqual(['file:///app/cache/DocumentPicker/abc/id-front.pdf', 'file:///app/cache/ImagePicker/old-selfie.jpg', 'file:///app/cache/ImagePicker/unknown-time.jpg'])
  expect(fs.tree.get('file:///app/cache/Other')?.size).toBe(1)
})

it('is a no-op when the picker folders do not exist', async () => {
  await expect(cleanupPickerCache(4_000)).resolves.toBeUndefined()
  expect(fs.deleted).toEqual([])
})

it('keeps going after a failed delete and then reports it', async () => {
  folder('file:///app/cache/ImagePicker', [['locked.jpg', 1_000], ['old.jpg', 1_000]])
  fs.fail.add('file:///app/cache/ImagePicker/locked.jpg')
  await expect(cleanupPickerCache(4_000)).rejects.toThrow('Temporary upload cleanup could not complete.')
  expect(fs.deleted).toEqual(['file:///app/cache/ImagePicker/old.jpg'])
})
