import { Platform } from 'react-native'
import { Directory, File, Paths } from 'expo-file-system'

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

/** Cache folders expo-image-picker and expo-document-picker copy picks into. */
const PICKER_CACHE_FOLDERS = ['ImagePicker', 'DocumentPicker'] as const

function removeOlderThan(folder: Directory, before: number, failures: unknown[]) {
  for (const entry of folder.list()) {
    try {
      if (entry instanceof Directory) removeOlderThan(entry, before, failures)
      // A file whose time cannot be read is treated as stale: it cannot belong to a pick made after launch.
      else if (entry.modificationTime === null || entry.modificationTime < before) entry.delete()
    } catch (error) { failures.push(error) }
  }
}

/**
 * Startup sweep for picker copies left behind when the app was killed between
 * a pick and MediaUploadField's per-file cleanup (they can be ID images and
 * selfies). Only the two picker folders inside this app's cache are touched,
 * and only files older than `before`, so a pick made right at launch survives.
 */
export async function cleanupPickerCache(before = Date.now()) {
  if (Platform.OS === 'web') return
  const failures: unknown[] = []
  for (const name of PICKER_CACHE_FOLDERS) {
    try {
      const folder = new Directory(Paths.cache, name)
      if (folder.exists) removeOlderThan(folder, before, failures)
    } catch (error) { failures.push(error) }
  }
  if (failures.length) throw new Error('Temporary upload cleanup could not complete.')
}
