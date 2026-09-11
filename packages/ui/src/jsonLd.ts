/**
 * JSON-LD builders for the structured data the site can honestly populate.
 *
 * Deliberately small. Schema.org accepts far more than Google acts on, and a
 * type whose required properties you cannot fill is worse than no markup at
 * all — it either earns nothing or, if it misdescribes the page, earns a
 * manual action. So this covers exactly two things:
 *
 *   BreadcrumbList  the one type on this product's pages that produces a
 *                   visible rich result (the trail under the search title,
 *                   replacing the bare URL)
 *   Organization    an identity node for organization profiles, which is a
 *                   genuine entity claim the data supports
 *
 * Explicitly NOT here, and each for a reason:
 *   Product/Offer      a donation is not a purchase and has no price or
 *                      availability; marking one up as a product is a
 *                      misrepresentation Google penalises
 *   Review / AggregateRating  there are no reviews; trust scores are computed
 *                      internally, not submitted by people
 *   NGO                the platform is a company, and campaign owners are not
 *                      verified charities
 *   DonateAction       not a top-level type Google surfaces; it belongs inside
 *                      a potentialAction, and earns nothing on its own
 */

export interface BreadcrumbItem {
  /** The visible label, e.g. 'Explore'. */
  name: string
  /** Root-relative path. Omit on the final crumb — the current page. */
  path?: string
}

/**
 * Build a BreadcrumbList for the trail leading to the current page.
 *
 * The last item is the current page and carries no `item`, per Google's
 * guidance: a self-link in the trail is redundant and some validators flag it.
 */
export function breadcrumbList(origin: string, items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.path ? { item: `${origin}${crumb.path}` } : {}),
    })),
  }
}

export interface OrganizationNode {
  name: string
  /** Canonical URL of the profile page. */
  url: string
  description?: string
  logo?: string
  /** Where the organization operates, when known. */
  areaServed?: string
  /** Verified external profiles only — a guessed URL is a wrong entity claim. */
  sameAs?: string[]
}

/**
 * An Organization node for a profile page.
 *
 * Every optional field is dropped when absent rather than emitted empty:
 * `"description": ""` is a claim that the organization has no description,
 * and structured data is read literally.
 */
export function organization(node: OrganizationNode): object {
  const sameAs = node.sameAs?.filter((url) => /^https?:\/\//i.test(url)) ?? []
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: node.name,
    url: node.url,
    ...(node.description ? { description: node.description } : {}),
    ...(node.logo ? { logo: node.logo } : {}),
    ...(node.areaServed ? { areaServed: node.areaServed } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
}
