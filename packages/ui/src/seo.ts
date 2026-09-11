import { useLayoutEffect } from 'react'

/**
 * Per-route document head for a Vite SPA.
 *
 * Both apps rewrite every path to index.html, so without this each app serves
 * ONE title, description and canonical for every route. That is not merely a
 * missed signal: a static canonical pointing at another URL actively instructs
 * Google to drop the page and index that other URL instead.
 *
 * Written by hand rather than pulling in react-helmet-async for two reasons.
 * It is ~60 lines against a dependency plus a provider in every app; and it
 * MUTATES existing head elements by selector instead of appending, so exactly
 * one canonical and one og:title can ever exist. An append-based library that
 * misses a cleanup leaves duplicates, and duplicate canonicals are ignored
 * wholesale by crawlers — the failure mode is silent and total.
 *
 * A caveat worth stating plainly: tags set here are applied by client
 * JavaScript. Googlebot renders JS and will see them. Most social scrapers
 * (WhatsApp, Facebook, LinkedIn, Slack) do NOT, so they keep showing the static
 * card from index.html. Per-URL share cards need the HTML to differ at the
 * edge — a prerender step or a crawler-aware function — which is a separate
 * piece of work this hook does not pretend to solve.
 */
export interface SeoMeta {
  /** Under ~60 characters, so it is not truncated in results. */
  title: string
  /** 140–160 characters. Written for a human, not stuffed with keywords. */
  description: string
  /** Root-relative, no trailing slash (except '/'). Becomes the canonical. */
  path: string
  image?: string
  imageAlt?: string
  type?: 'website' | 'article'
  /** e.g. 'noindex, follow' for transient or private pages. */
  robots?: string
  /** JSON-LD for this route. Replaced wholesale on each navigation. */
  jsonLd?: object | object[]
}

const JSONLD_ID = 'route-jsonld'

function upsert(selector: string, create: () => HTMLElement, value: string): void {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function metaName(name: string, content: string): void {
  upsert(`meta[name="${name}"]`, () => {
    const el = document.createElement('meta')
    el.setAttribute('name', name)
    return el
  }, content)
}

function metaProperty(property: string, content: string): void {
  upsert(`meta[property="${property}"]`, () => {
    const el = document.createElement('meta')
    el.setAttribute('property', property)
    return el
  }, content)
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

function setJsonLd(data: object | object[] | undefined): void {
  document.getElementById(JSONLD_ID)?.remove()
  if (!data) return
  const el = document.createElement('script')
  el.id = JSONLD_ID
  el.type = 'application/ld+json'
  el.textContent = JSON.stringify(data)
  document.head.appendChild(el)
}

/**
 * Apply `meta` to the document head for as long as the calling route is mounted.
 *
 * `origin` is the app's own origin — the two apps live on different hosts, and
 * emitting the wrong one is exactly the bug this exists to fix.
 */
export function applySeo(meta: SeoMeta, origin: string, defaults: { image: string; imageAlt: string }): void {
  const url = `${origin}${meta.path === '/' ? '/' : meta.path.replace(/\/$/, '')}`
  const image = meta.image ?? defaults.image
  const imageAlt = meta.imageAlt ?? defaults.imageAlt

  document.title = meta.title
  metaName('title', meta.title)
  metaName('description', meta.description)
  metaName('robots', meta.robots ?? 'index, follow, max-image-preview:large')
  setCanonical(url)

  metaProperty('og:type', meta.type ?? 'website')
  metaProperty('og:url', url)
  metaProperty('og:title', meta.title)
  metaProperty('og:description', meta.description)
  metaProperty('og:image', image)
  metaProperty('og:image:alt', imageAlt)

  metaName('twitter:url', url)
  metaName('twitter:title', meta.title)
  metaName('twitter:description', meta.description)
  metaName('twitter:image', image)

  setJsonLd(meta.jsonLd)
}

/**
 * Build a `useSeo` hook bound to one app's origin and share-card defaults.
 *
 * `useLayoutEffect` rather than `useEffect`: the title should change in the same
 * frame as the route, so the tab never briefly shows the previous page's title.
 */
export function createUseSeo(origin: string, defaults: { image: string; imageAlt: string }) {
  return function useSeo(meta: SeoMeta): void {
    const { title, description, path, image, imageAlt, type, robots, jsonLd } = meta
    const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''
    useLayoutEffect(() => {
      applySeo({ title, description, path, image, imageAlt, type, robots, jsonLd }, origin, defaults)
      // No cleanup: the next route overwrites every value, and clearing on
      // unmount would blank the head for a frame during navigation.
    }, [title, description, path, image, imageAlt, type, robots, jsonLdKey])
  }
}
