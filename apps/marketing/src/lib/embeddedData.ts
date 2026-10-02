/**
 * The build-time API data embedded in each prerendered page; see
 * prerenderData.tsx for how pages read it. Kept free of React so the build
 * step (scripts/prerender.ts) can import it.
 */
export type PrerenderData = Readonly<Record<string, unknown>>

/** The id of the `<script type="application/json">` the build embeds the data in. */
export const PRERENDER_DATA_ID = 'prerender-data'

/** Read the embedded data. A missing or unreadable block means "no data", never an error. */
export function readPrerenderData(doc: Document = document): PrerenderData {
  const text = doc.getElementById(PRERENDER_DATA_ID)?.textContent
  if (!text) return {}
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as PrerenderData) : {}
  } catch {
    return {}
  }
}

/**
 * JSON that is safe inside a `<script type="application/json">` element. Only
 * `<` needs escaping: it is what lets content such as `</script>` or `<!--` in a
 * blog post end or confuse the element. The browser never runs this block as
 * JavaScript; JSON.parse reads it back.
 */
export function serializeForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
