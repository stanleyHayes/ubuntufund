import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import createCache from '@emotion/cache'
import type { SeoMeta } from '@ubuntu-fund/ui'
import { AppTree } from './App'
import { AppProviders } from './AppProviders'
import type { PrerenderData } from './lib/prerenderData'
import { emotionStyleTags } from './lib/emotionStyles'

/**
 * Renders one route to HTML at build time (scripts/prerender.ts loads this).
 *
 * The tree matches main.tsx except for the router, so the browser can adopt
 * the HTML without re-rendering it. Each call gets its own style cache, data
 * record and head collector: nothing from one page leaks into the next.
 */
export interface RenderedPage {
  /** The markup for inside `<div id="root">`. */
  html: string
  /** `<style>` tags for `<head>`. */
  styles: string
  /** The head the page declared through useSeo, or null if it declared none. */
  head: SeoMeta | null
  /** The build-time data the page read, to embed for the browser's first render. */
  data: Record<string, unknown>
}

export function render(url: string, data: PrerenderData): RenderedPage {
  const cache = createCache({ key: 'css' })
  // Keep rules in the cache for emotionStyleTags instead of inline <style> tags.
  cache.compat = true
  const used = new Set<string>()
  let head: SeoMeta | null = null
  const html = renderToString(
    <AppProviders cache={cache} data={data} usedData={used} collectSeo={(meta) => { head = meta }}>
      <StaticRouter location={url}>
        <AppTree />
      </StaticRouter>
    </AppProviders>,
  )
  const embedded: Record<string, unknown> = {}
  for (const key of used) if (data[key] !== undefined) embedded[key] = data[key]
  return { html, styles: emotionStyleTags(cache, html), head, data: embedded }
}
