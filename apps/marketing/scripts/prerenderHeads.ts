import fs from 'node:fs/promises'
import path from 'node:path'
import type { Logger, Plugin } from 'vite'
import { POLICY_HEADS, SITE_ORIGIN, STATIC_PATHS, blogPostHead, pageHead, type PageHead } from '../src/lib/pageSeo.ts'

/**
 * Writes one HTML file per public route, each with its own title, description,
 * canonical and share tags, so crawlers see the right head before JavaScript
 * runs.
 *
 * The site is a single-page app: vercel.json rewrites every unknown path to one
 * HTML file. When that file was index.html, every route arrived with the
 * homepage's canonical, which tells Google each page is a copy of the homepage
 * and keeps it out of the index. Vercel serves a real file before applying a
 * rewrite, so /about now gets dist/about/index.html. Anything not generated here
 * (a post published after the build, a mistyped URL) gets app-shell.html, which
 * carries no canonical at all; `useSeo` sets the right one once the page runs.
 */

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (value: string) => escapeText(value).replace(/"/g, '&quot;')

function replaceOnce(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) throw new Error(`prerenderHeads: index.html has no ${label}; update the template or this build step`)
  // A function replacement keeps `$` in page copy from being read as a group reference.
  return html.replace(pattern, (_, before: string, after: string) => `${before}${replacement}${after}`)
}

const META = (attr: 'name' | 'property', key: string) => new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`)
const CANONICAL = /(<link rel="canonical" href=")[^"]*(")/

export function renderRouteHtml(template: string, head: PageHead): string {
  const url = `${SITE_ORIGIN}${head.path === '/' ? '/' : head.path}`
  let html = replaceOnce(template, /(<title>)[^<]*(<\/title>)/, escapeText(head.title), '<title>')
  const metas: ['name' | 'property', string, string][] = [
    ['name', 'title', head.title],
    ['name', 'description', head.description],
    ['property', 'og:type', head.type ?? 'website'],
    ['property', 'og:url', url],
    ['property', 'og:title', head.title],
    ['property', 'og:description', head.description],
    ['name', 'twitter:url', url],
    ['name', 'twitter:title', head.title],
    ['name', 'twitter:description', head.description],
  ]
  for (const [attr, key, value] of metas) html = replaceOnce(html, META(attr, key), escapeAttr(value), `${key} meta tag`)
  return replaceOnce(html, CANONICAL, escapeAttr(url), 'canonical link')
}

/** The rewrite fallback: no canonical or page URL, so it never claims another page. */
export function renderShellHtml(template: string): string {
  const html = template
    .replace(/\s*<!-- Canonical -->/, '')
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta property="og:url"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:url"[^>]*>/, '')
  if (CANONICAL.test(html)) throw new Error('prerenderHeads: app-shell.html still has a canonical link')
  return html
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Published posts from the API. Only on Vercel builds (or PRERENDER_BLOG=1), so
 * local and CI builds stay offline. A failure only means posts fall back to
 * app-shell.html until the next deploy; it never fails the build.
 */
async function blogHeads(logger: Logger): Promise<PageHead[]> {
  if (process.env.VERCEL !== '1' && process.env.PRERENDER_BLOG !== '1') return []
  const api = process.env.PRERENDER_API_URL ?? 'https://api.ujimora.com/api/v1'
  try {
    const response = await fetch(`${api}/blog`, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { data } = (await response.json()) as { data: { slug?: unknown; title?: unknown; excerpt?: unknown }[] }
    // Slugs become directory names, so anything unexpected is skipped, not written.
    return data
      .filter((post): post is { slug: string; title: string; excerpt: string } =>
        typeof post.slug === 'string' && SLUG.test(post.slug) && typeof post.title === 'string' && typeof post.excerpt === 'string')
      .map(blogPostHead)
  } catch (error) {
    logger.warn(`prerenderHeads: blog posts not prerendered (${error instanceof Error ? error.message : String(error)})`)
    return []
  }
}

export function routeHeads(posts: PageHead[] = []): PageHead[] {
  return [...STATIC_PATHS.map(pageHead), ...POLICY_HEADS, ...posts]
}

export function prerenderHeads(): Plugin {
  let outDir = ''
  let logger: Logger
  return {
    name: 'ujimora-prerender-heads',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
      logger = config.logger
    },
    async writeBundle() {
      const template = await fs.readFile(path.join(outDir, 'index.html'), 'utf8')
      const heads = routeHeads(await blogHeads(logger))
      for (const head of heads) {
        const file = head.path === '/' ? path.join(outDir, 'index.html') : path.join(outDir, head.path.slice(1), 'index.html')
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, renderRouteHtml(template, head))
      }
      await fs.writeFile(path.join(outDir, 'app-shell.html'), renderShellHtml(template))
      logger.info(`prerenderHeads: wrote ${heads.length} route pages and app-shell.html`)
    },
  }
}
