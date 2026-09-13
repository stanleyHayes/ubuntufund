import { useCallback, useEffect, useState } from 'react'
import type { BlogArticle } from '@ubuntu-fund/types'
export type DisplayArticle = BlogArticle & {
  date: string
  author: { name: string; role: string; avatar: string }
}
const display = (post: BlogArticle): DisplayArticle => ({
  ...post,
  date: new Date(post.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }),
  author: { name: post.authorName, role: post.authorRole, avatar: post.authorName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() },
})
export function useBlog(slug?: string) {
  const [posts, setPosts] = useState<DisplayArticle[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const reload = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError('')
      setPosts([])
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || '/api/v1'}/blog${slug ? `/${encodeURIComponent(slug)}` : ''}`,
          { signal },
        )
        if (response.status === 404 && slug) return
        if (!response.ok)
          throw new Error('The journal is temporarily unavailable. Please try again.')
        const { data } = await response.json()
        if (!signal?.aborted) setPosts((slug ? [data] : data).map(display))
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Could not load articles')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [slug],
  )
  useEffect(() => {
    const controller = new AbortController()
    void reload(controller.signal)
    return () => controller.abort()
  }, [reload])
  return { posts, loading, error, reload: () => reload() }
}
