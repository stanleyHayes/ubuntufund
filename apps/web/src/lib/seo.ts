import { createUseSeo } from '@ubuntu-fund/ui'

/**
 * Per-route head for the product app.
 *
 * The origin matters: app.ujimora.com previously emitted a canonical and og:url
 * pointing at https://ujimora.com/, so every campaign, organization and creator
 * page declared itself a duplicate of the marketing homepage.
 */
export const SITE_ORIGIN = 'https://app.ujimora.com'

export const useSeo = createUseSeo(SITE_ORIGIN, {
  image: `${SITE_ORIGIN}/og-image.png`,
  imageAlt: 'Ujimora — trusted crowdfunding in Ghana',
})
