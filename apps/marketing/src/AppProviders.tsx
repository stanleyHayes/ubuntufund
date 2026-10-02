import React, { type ReactNode } from 'react'
import type { EmotionCache } from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { SeoCollectorContext, type SeoMeta } from '@ubuntu-fund/ui'
import { PrerenderDataProvider, type PrerenderData } from './lib/prerenderData'

/**
 * The providers around the app, shared by the browser (main.tsx) and the build
 * (entry-server.tsx). Both sides render this same component so their trees
 * differ only in the router; React adopts prerendered HTML only when the
 * browser's first render produces the same markup, generated ids included.
 */
export function AppProviders({
  cache,
  data,
  usedData,
  collectSeo = null,
  children,
}: {
  cache: EmotionCache
  data: PrerenderData
  /** Server only: records which data keys the page read. */
  usedData?: Set<string>
  /** Server only: receives the head each page declares. */
  collectSeo?: ((meta: SeoMeta) => void) | null
  children: ReactNode
}) {
  return (
    <React.StrictMode>
      <CacheProvider value={cache}>
        <SeoCollectorContext.Provider value={collectSeo}>
          <PrerenderDataProvider data={data} used={usedData}>
            {children}
          </PrerenderDataProvider>
        </SeoCollectorContext.Provider>
      </CacheProvider>
    </React.StrictMode>
  )
}
