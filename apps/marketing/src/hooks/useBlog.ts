import { useCallback, useEffect, useState } from 'react'
import type { BlogArticle } from '@ubuntu-fund/types'
import { usePrerenderedData } from '@/lib/prerenderData'
export type DisplayArticle = BlogArticle & {
  date: string
  author: { name: string; role: string; avatar: string }
}
const display = (post: BlogArticle): DisplayArticle => ({
  ...post,
  // UTC: publish dates are stored as midnight UTC, and formatting them in the
  // reader's own zone showed the day before to everyone west of Greenwich. It
  // also has to match the prerendered HTML, which is formatted at build time.
  date: new Date(post.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  author: { name: post.authorName, role: post.authorRole, avatar: post.authorName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() },
})
/** The prerender data key for the post list, or for one post. */
export const blogDataKey = (slug?: string) => (slug ? `blog:${slug}` : 'blog')
export function useBlog(slug?: string) {
  // Posts the build already fetched (lib/prerenderData): the page renders them
  // straight away and refreshes quietly instead of flashing a skeleton.
  const prerendered = usePrerenderedData<BlogArticle | BlogArticle[]>(blogDataKey(slug))
  const initial = prerendered ? (Array.isArray(prerendered) ? prerendered : [prerendered]).map(display) : null
  const [posts, setPosts] = useState<DisplayArticle[]>(() => initial ?? []),
    [loading, setLoading] = useState(!initial),
    [error, setError] = useState('')
  const [quietRefresh] = useState(!!initial)
  const reload = useCallback(
    async (signal?: AbortSignal, quiet = false) => {
      if (!quiet) {
        setLoading(true)
        setError('')
        setPosts([])
      }
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || '/api/v1'}/blog${slug ? `/${encodeURIComponent(slug)}` : ''}`,
          { signal },
        )
        if (response.status === 404 && slug) {
          if (!signal?.aborted) setPosts([])
          return
        }
        if (!response.ok)
          throw new Error('The journal is temporarily unavailable. Please try again.')
        const { data } = await response.json()
        if (!signal?.aborted) setPosts((slug ? [data] : data).map(display))
      } catch (e) {
        // A failed quiet refresh keeps the prerendered posts on screen.
        if (!signal?.aborted && !quiet) setError(e instanceof Error ? e.message : 'Could not load articles')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [slug],
  )
  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal, quietRefresh)
    return () => controller.abort()
  }, [reload, quietRefresh])
  return { posts, loading, error, reload: () => reload() }
}
