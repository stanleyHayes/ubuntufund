import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { api } from '@/lib/api'

/**
 * A single headless-CMS content block as returned by the API.
 * Mirrors the `SiteContentRecord` contract from `apps/api`.
 */
export interface SiteContentRecord<T = unknown> {
  key: string
  type: string
  data: T
  updatedAt: string
  updatedBy?: string
}

export interface UseContentBlockResult<T> {
  /** The working copy of the block data, edited locally until saved. */
  data: T
  /** Replace the working copy (accepts a value or updater fn). */
  setData: Dispatch<SetStateAction<T>>
  /** The last persisted record, or null if the key has never been saved. */
  record: SiteContentRecord<T> | null
  /** True while the initial GET is in flight. */
  loading: boolean
  /** True while a PUT is in flight. */
  saving: boolean
  /** Load error message (network/permission), or null. A missing key is not an error. */
  error: string | null
  /** Whether the block existed on the server (false = never seeded / 404). */
  exists: boolean
  /** Local edits differ from the last persisted snapshot. */
  isDirty: boolean
  /** Re-fetch the block from the server. */
  reload: () => void
  /** Persist the working copy. Returns the saved record, or throws on failure. */
  save: () => Promise<SiteContentRecord<T>>
}

/**
 * Load and save one CMS content block (`GET`/`PUT /content/:key`).
 *
 * The public GET is unauthenticated; the PUT is admin-only and uses the bearer
 * token attached by `@/lib/api`. A 404 on load is treated as "not seeded yet"
 * rather than an error — the caller renders defaults and the first save creates
 * the key. Dirty state is tracked by comparing a serialized snapshot of the
 * last persisted `data` against the working copy.
 */
export function useContentBlock<T>(
  key: string,
  type: string,
  fallback: T,
): UseContentBlockResult<T> {
  const [data, setData] = useState<T>(fallback)
  const [record, setRecord] = useState<SiteContentRecord<T> | null>(null)
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(fallback))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exists, setExists] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .get<SiteContentRecord<T>>(`/content/${key}`)
      .then((rec) => {
        if (cancelled) return
        if (rec && typeof rec === 'object' && 'data' in rec && rec.data != null) {
          setRecord(rec)
          setData(rec.data)
          setBaseline(JSON.stringify(rec.data))
          setExists(true)
        } else {
          // Unexpected shape — fall back to defaults but don't block editing.
          setExists(false)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load content'
        // A missing block (404) is an expected "not seeded" state, not an error.
        if (/no content found|404|not found/i.test(message)) {
          setExists(false)
        } else {
          setError(message)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [key, reloadToken])

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const saved = await api.put<SiteContentRecord<T>>(`/content/${key}`, { type, data })
      setRecord(saved)
      setExists(true)
      // Prefer the server's echoed data; fall back to what we sent.
      const persisted = saved && typeof saved === 'object' && 'data' in saved ? saved.data : data
      setBaseline(JSON.stringify(persisted))
      return saved
    } finally {
      setSaving(false)
    }
  }, [key, type, data])

  const isDirty = JSON.stringify(data) !== baseline

  return { data, setData, record, loading, saving, error, exists, isDirty, reload, save }
}
