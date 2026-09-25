import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import StatsSection from '@/components/sections/StatsSection'
import { PageErrorBoundary } from '@/components/PageErrorBoundary'
import { isAboutContent, isContactContent, isFaqContent, isStatsContent } from '@/lib/contentShapes'

/**
 * A CMS block of the wrong shape used to be rendered as-is: StatsSection
 * destructured `items` and mapped over it, so `{}` for marketing.stats threw
 * during render and, with no error boundary, blanked the whole landing page.
 */
function respondWith(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: { key: 'marketing.stats', data: payload } })))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const renderStats = () => render(<ThemeProvider theme={ujimoraTheme}><StatsSection /></ThemeProvider>)

describe('CMS content shape guards', () => {
  it('accept every block the API seeds', () => {
    const seed = JSON.parse(readFileSync(resolve(process.cwd(), '../api/src/infrastructure/database/siteContentDefaults.json'), 'utf8')) as { key: string; data: unknown }[]
    const data = (key: string) => seed.find((block) => block.key === key)?.data
    expect(isStatsContent(data('marketing.stats'))).toBe(true)
    expect(isFaqContent(data('faq'))).toBe(true)
    expect(isAboutContent(data('about'))).toBe(true)
    expect(isContactContent(data('contact'))).toBe(true)
  })

  it('reject payloads the pages cannot render', () => {
    for (const bad of [{}, { items: null }, { items: {} }, { items: [{ value: 1, label: 'x' }] }, 'text', []]) {
      expect(isStatsContent(bad), JSON.stringify(bad)).toBe(false)
    }
    expect(isFaqContent({ items: [{ question: 'Q', answer: 'A' }] })).toBe(false)
    expect(isAboutContent({ hero: { title: 'T' } })).toBe(false)
    expect(isContactContent({ responseTimes: { label: 'x' } })).toBe(false)
  })
})

describe('StatsSection', () => {
  it('renders the built-in foundations when the CMS payload lacks items', async () => {
    respondWith({})
    renderStats()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByText('Give in cedis')).toBeInTheDocument()
  })

  it('renders valid CMS items', async () => {
    respondWith({ items: [{ value: 'Custom stat', label: 'From the CMS' }] })
    renderStats()
    expect(await screen.findByText('Custom stat')).toBeInTheDocument()
  })
})

describe('PageErrorBoundary', () => {
  function Broken(): never {
    throw new Error('render failure')
  }

  it('shows a recoverable message instead of blanking the site', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ThemeProvider theme={ujimoraTheme}><p>Navbar</p><PageErrorBoundary resetKey="/"><Broken /></PageErrorBoundary></ThemeProvider>)
    expect(screen.getByRole('alert')).toHaveTextContent('This page could not be displayed')
    expect(screen.getByText('Navbar')).toBeInTheDocument()
  })
})
