import { createContext, useContext, type ReactNode } from 'react'
import type { PrerenderData } from './embeddedData'

export { PRERENDER_DATA_ID, readPrerenderData, serializeForScript, type PrerenderData } from './embeddedData'

/**
 * API data fetched at build time, so a prerendered page shows real content.
 *
 * The build renders every page to HTML (scripts/prerender.ts). Pages that load
 * from the API (pricing, help answers, blog posts) would otherwise prerender as
 * loading skeletons, and crawlers would index skeletons. The build fetches that
 * data once, renders with it, and embeds what each page actually read in the
 * page itself, so the browser's first render matches the HTML exactly.
 *
 * Keys name the API resource: `content:<key>`, `blog`, `blog:<slug>`, `plans`,
 * `testimonials`. Hooks still refetch after mounting, so an admin edit made
 * after the deploy appears on the next visit as before.
 */
interface PrerenderStore {
  data: PrerenderData
  /** Server only: the keys this render read, which are the ones worth embedding. */
  used?: Set<string>
}

const PrerenderDataContext = createContext<PrerenderStore>({ data: {} })

export function PrerenderDataProvider({ data, used, children }: { data: PrerenderData; used?: Set<string>; children: ReactNode }) {
  return <PrerenderDataContext.Provider value={{ data, used }}>{children}</PrerenderDataContext.Provider>
}

/** The build-time value for `key`, or undefined when the build had none. */
export function usePrerenderedData<T>(key: string): T | undefined {
  const { data, used } = useContext(PrerenderDataContext)
  used?.add(key)
  return data[key] as T | undefined
}
