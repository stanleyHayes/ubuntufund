import { vi } from 'vitest'

/** In-memory localStorage with enumerable keys, like a browser's (this jsdom has none). */
export function installMemoryStorage(): Storage {
  const storage: Record<string, string> = {}
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null) },
    setItem: { value: (key: string, value: string) => { storage[key] = String(value) } },
    removeItem: { value: (key: string) => { delete storage[key] } },
    clear: { value: () => { for (const key of Object.keys(storage)) delete storage[key] } },
    key: { value: (index: number) => Object.keys(storage)[index] ?? null },
    length: { get: () => Object.keys(storage).length },
  })
  vi.stubGlobal('localStorage', storage)
  return storage as unknown as Storage
}
