import type { EmotionCache } from '@emotion/cache'

/**
 * The `<style>` tags for one server render, ready for `<head>`.
 *
 * The same extraction @emotion/server performs, kept here so the build does
 * not need another dependency. Rendering with `cache.compat = true` makes
 * Emotion keep each rule's CSS in `cache.inserted` instead of writing it inline
 * next to the element. Rules whose class names appear in the HTML go into one
 * `css` tag; global rules (fonts, the baseline, keyframes) each get their own
 * `css-global` tag, which is the shape Emotion's browser cache looks for, so the
 * browser adopts these tags instead of inserting every rule a second time.
 */
export function emotionStyleTags(cache: EmotionCache, html: string): string {
  const inHtml = new Set<string>()
  for (const match of html.matchAll(new RegExp(`${cache.key}-([a-zA-Z0-9-_]+)`, 'g'))) inHtml.add(match[1])

  const globals: string[] = []
  const ids: string[] = []
  let css = ''
  for (const [id, rules] of Object.entries(cache.inserted)) {
    if (typeof rules !== 'string') continue
    const registered = cache.registered[`${cache.key}-${id}`] !== undefined
    if (registered) {
      // A class rendered nowhere in this page's HTML is not this page's CSS.
      if (!inHtml.has(id)) continue
      ids.push(id)
      css += rules
    } else {
      globals.push(`<style data-emotion="${cache.key}-global ${id}">${rules}</style>`)
    }
  }
  // Class rules after the globals, as Emotion orders them in the browser.
  return `${globals.join('')}<style data-emotion="${cache.key} ${ids.join(' ')}">${css}</style>`
}
