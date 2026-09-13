import { api } from '@/lib/api'

export interface ExportProgress { signal?: AbortSignal; onProgress?: (message: string) => void }

/** Read every server page. A changing or malformed collection fails instead of exporting a partial report. */
export async function loadAll<T>(path: string, { signal, onProgress }: ExportProgress = {}, select: (response: unknown) => T[] | { items: T[]; total: number } = response => response as T[] | { items: T[]; total: number }): Promise<T[]> {
  const url = new URL(path, 'https://local.invalid')
  url.searchParams.set('pageSize', '100')
  const records: T[] = []
  let expectedTotal: number | undefined
  const seen = new Set<string>()
  for (let page = 1; page <= 10000; page++) {
    signal?.throwIfAborted()
    url.searchParams.set('page', String(page))
    const result = select(await api.get<unknown>(url.pathname + url.search, { signal }))
    signal?.throwIfAborted()
    if (Array.isArray(result)) {
      if (page !== 1) throw new Error('The server changed the report pagination. Please retry.')
      return result
    }
    if (!result || !Array.isArray(result.items) || !Number.isSafeInteger(result.total) || result.total < 0) throw new Error('The server returned incomplete report data. Please retry.')
    if (expectedTotal !== undefined && expectedTotal !== result.total) throw new Error('Records changed while loading. Please retry the export.')
    expectedTotal = result.total
    for (const item of result.items) {
      const id = item && typeof item === 'object' ? (item as { id?: unknown; _id?: unknown }).id ?? (item as { _id?: unknown })._id : null
      if (id != null) {
        const key = String(id)
        if (seen.has(key)) throw new Error('Records moved between pages. Please retry the export.')
        seen.add(key)
      }
    }
    records.push(...result.items)
    onProgress?.(`Loading ${records.length.toLocaleString()} of ${expectedTotal.toLocaleString()} records…`)
    if (records.length === expectedTotal) return records
    if (!result.items.length || records.length > expectedTotal) throw new Error('The report is incomplete. Please refresh and retry.')
  }
  throw new Error('This report is too large for a browser download. Narrow its filters and retry.')
}
