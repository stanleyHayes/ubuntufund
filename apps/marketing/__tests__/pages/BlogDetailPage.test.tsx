import { afterEach, it, expect, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import BlogDetailPage from '@/pages/BlogDetailPage'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const renderArticle = () => render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter initialEntries={['/blog/community-notes']}><Routes><Route path="/blog/:slug" element={<BlogDetailPage />} /></Routes></MemoryRouter></ThemeProvider>)
it('renders the published Markdown and accessible cover from the API', async () => {
  const post = { id: '1', slug: 'community-notes', title: 'Community notes', excerpt: 'Giving together.', category: 'Community', authorName: 'Editorial Team', authorRole: 'Editor', image: 'https://example.test/cover.jpg', imageAlt: 'Community meeting under a tree', body: '## A meaningful gift\n\n**Every gift matters.**\n\n[Unsafe](javascript:alert(1))\n\n<script>alert(1)</script>', publishedAt: '2026-09-12T10:00:00Z', readTime: 1 }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => ({ data: url.endsWith('/community-notes') ? post : [post] }) })))
  renderArticle()
  await expect(screen.findByRole('heading', { name: 'A meaningful gift' })).resolves.toBeTruthy()
  expect(screen.getByAltText('Community meeting under a tree')).toBeTruthy()
  expect(screen.getByText('Every gift matters.').tagName).toBe('STRONG')
  expect(screen.getByText('Unsafe').getAttribute('href')).not.toMatch(/^javascript:/)
  expect(document.querySelector('script:not([type="application/ld+json"])')).toBeNull()
})
it('offers retry for unavailable articles instead of showing a missing article', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
  renderArticle()
  await expect(screen.findByRole('button', { name: 'Retry' })).resolves.toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('temporarily unavailable')
})
