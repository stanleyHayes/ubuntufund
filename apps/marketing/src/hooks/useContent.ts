import { useEffect, useState } from 'react'

/**
 * Runtime CMS consumer.
 *
 * Fetches a single headless-CMS block from `GET /api/v1/content/:key` (same-origin;
 * the Vercel rewrite in `vercel.json` proxies `/api/v1/*` to the API) and returns the
 * block's `data` payload. If the request fails, the key is unknown (404), or the shape
 * is empty, it falls back to the passed-in hardcoded default so the marketing site never
 * breaks and always renders.
 *
 * Because the SPA reads at runtime, admin edits in the CMS reflect on the next page load
 * with no redeploy.
 *
 * The API response envelope is `{ data: SiteContentRecord, message, status }` and the
 * record itself is `{ key, type, data, updatedAt, updatedBy? }` — so the block payload we
 * want lives at `json.data.data`.
 */
export function useContent<T>(key: string, fallback: T): T {
  const [content, setContent] = useState<T>(fallback)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/v1/content/${encodeURIComponent(key)}`, {
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return // 404 (unknown key) or server error → keep fallback
        const json = await res.json()
        const payload = json?.data?.data
        if (!cancelled && payload != null) {
          setContent(payload as T)
        }
      } catch {
        // Network/parse failure → keep the fallback so the section still renders.
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [key])

  return content
}

export default useContent
