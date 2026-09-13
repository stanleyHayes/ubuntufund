import { File, Paths } from 'expo-file-system'

/** Only remove picker copies inside this app's cache, never a source document. */
export function discardUploadCache(uri: string): boolean {
  let candidate: URL
  let cache: URL
  try {
    candidate = new URL(uri)
    cache = new URL(Paths.cache.uri)
    if (candidate.protocol !== 'file:' || candidate.host !== cache.host) return false
    // Do not let encoded separators or traversal escape the owned directory.
    if (/%2f|%5c/i.test(candidate.pathname)) return false
    const path = decodeURIComponent(candidate.pathname)
    const root = decodeURIComponent(cache.pathname).replace(/\/$/, '')
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part === '.' || part === '..')) return false
    if (!path.startsWith(`${root}/`) || path === `${root}/`) return false
  } catch { return false }
  const file = new File(candidate.href)
  if (file.exists) file.delete()
  return true
}
