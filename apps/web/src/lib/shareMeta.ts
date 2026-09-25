/**
 * Server-side share cards for campaign links (used by /middleware.ts).
 *
 * The SPA sets per-route tags with client JavaScript (useSeo), which Googlebot
 * renders but link-preview scrapers (WhatsApp, Facebook, LinkedIn, Slack, X,
 * Telegram, Discord) do not: they read the raw index.html and showed the
 * generic Ujimora card for every campaign. The middleware answers only those
 * scrapers with index.html whose share tags describe the campaign.
 *
 * Pure string helpers, no DOM or React, so they run in the edge runtime and
 * in unit tests alike.
 */

/** Link-preview and social scrapers that do not execute JavaScript. */
const LINK_PREVIEW_BOT = /facebookexternalhit|facebookcatalog|facebot|meta-externalagent|whatsapp|twitterbot|linkedinbot|slackbot|slack-imgproxy|telegrambot|discordbot|pinterest|redditbot|skypeuripreview|embedly|vkshare|applebot|snapchat|viber/i

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && LINK_PREVIEW_BOT.test(userAgent)
}

/** The campaign slug or id a shareable path points at, or null. */
export function campaignKeyFromPath(pathname: string): string | null {
  const match = /^\/(?:c\/([^/]+)(?:\/donate)?|campaigns\/([a-f0-9]{24}))\/?$/i.exec(pathname)
  const raw = match?.[1] ?? match?.[2]
  if (!raw) return null
  try {
    const key = decodeURIComponent(raw)
    return /^[\w-]{1,120}$/.test(key) ? key : null
  } catch {
    return null
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface ShareMeta {
  title: string
  description: string
  url: string
  image?: string
  imageAlt?: string
}

interface CampaignShareSource {
  id: string
  slug?: string
  title: string
  description?: string
  imageUrls?: string[]
  socialPreview?: { title?: string; summary?: string; imageUrl?: string; canonicalUrl?: string }
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:—-]+$/, '')}…`
}

/** Share card for a public campaign, matching what CampaignPublicPage sets client-side. */
export function campaignShareMeta(campaign: CampaignShareSource, origin: string): ShareMeta {
  const preview = campaign.socialPreview ?? {}
  const title = clip(preview.title || campaign.title, 90)
  const story = clip(preview.summary || campaign.description || '', 155)
  const image = preview.imageUrl ?? campaign.imageUrls?.[0]
  return {
    title: `${title} | Ujimora`,
    description: story.length >= 100 ? story : `${story ? `${story} ` : ''}Donate by mobile money or card on Ujimora.`,
    url: preview.canonicalUrl && /^https:\/\//i.test(preview.canonicalUrl)
      ? preview.canonicalUrl
      : `${origin.replace(/\/+$/, '')}/c/${encodeURIComponent(campaign.slug || campaign.id)}`,
    image: image && /^https:\/\//i.test(image) ? image : undefined,
    imageAlt: title,
  }
}

function setMetaContent(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+${attr}="${key.replace(/[.:]/g, '\\$&')}"\\s+content=")[^"]*(")`, 'i')
  return html.replace(pattern, (_m, start: string, end: string) => `${start}${escapeHtml(value)}${end}`)
}

/**
 * Rewrite the share tags already present in index.html. Existing tags are
 * edited in place so there is still exactly one of each; the static image
 * tags stay when the campaign has no usable image.
 */
export function injectShareMeta(html: string, meta: ShareMeta): string {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
  for (const [attr, key, value] of [
    ['name', 'title', meta.title],
    ['name', 'description', meta.description],
    ['property', 'og:type', 'article'],
    ['property', 'og:url', meta.url],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['name', 'twitter:url', meta.url],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
  ] as const) out = setMetaContent(out, attr, key, value)
  if (meta.image) {
    // The static card declares a 1200x630 PNG; a campaign cover is neither.
    out = out.replace(/\s*<meta\s+property="og:image:(?:type|width|height)"\s+content="[^"]*"\s*\/?>/gi, '')
    for (const [attr, key, value] of [
      ['property', 'og:image', meta.image],
      ['name', 'twitter:image', meta.image],
      ['property', 'og:image:alt', meta.imageAlt ?? meta.title],
      ['name', 'twitter:image:alt', meta.imageAlt ?? meta.title],
    ] as const) out = setMetaContent(out, attr, key, value)
  }
  const canonical = `<link rel="canonical" href="${escapeHtml(meta.url)}" />`
  return /<link\s+rel="canonical"[^>]*>/i.test(out)
    ? out.replace(/<link\s+rel="canonical"[^>]*>/i, canonical)
    : out.replace(/<\/head>/i, `    ${canonical}\n  </head>`)
}
