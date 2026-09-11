import { createUseSeo } from '@ubuntu-fund/ui'

export const SITE_ORIGIN = 'https://ujimora.com'

/**
 * Per-route head for the marketing site.
 *
 * Every route previously served the homepage's title, description and canonical,
 * so nineteen distinct pages told Google "the real URL for this content is the
 * homepage" — which also contradicted sitemap.xml, where those same pages are
 * listed as canonical in their own right.
 */
export const useSeo = createUseSeo(SITE_ORIGIN, {
  image: `${SITE_ORIGIN}/og-image.png`,
  imageAlt: "Ujimora — Ghana's trust infrastructure for giving",
})
