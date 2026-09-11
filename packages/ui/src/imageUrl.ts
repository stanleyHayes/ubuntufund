/**
 * Size and re-encode Cloudinary images at delivery time.
 *
 * Uploaded covers are stored as the original asset and were rendered at full
 * resolution everywhere — a phone photo straight from a camera is several
 * megabytes and several thousand pixels wide, delivered into a 320px card. On
 * the Ghanaian mobile networks this product serves, that is the single largest
 * thing standing between a visitor and the page, and Largest Contentful Paint
 * is a ranking signal as well as a real experience.
 *
 * Cloudinary applies transformations from the URL path, so this needs no upload
 * change and no migration: existing stored URLs keep working and are simply
 * requested at a sane size.
 *
 *   f_auto  negotiate WebP/AVIF from the Accept header, falling back to the original
 *   q_auto  let Cloudinary choose quality per image instead of a fixed number
 *   w_<n>   cap the width; c_limit never upscales, so a small original is left alone
 *   dpr_2.0 serve twice the CSS pixels for retina screens
 */

/** Any non-Cloudinary URL is returned untouched. */
const CLOUDINARY_UPLOAD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload)\/(.*)$/

export interface CloudinaryOptions {
  /** Target CSS width in pixels. */
  width: number
  /** Serve at 2x for high-density screens. Default true. */
  retina?: boolean
}

/**
 * Rewrite a Cloudinary delivery URL to be sized and modern-encoded.
 *
 * Returns the input unchanged when it is not a Cloudinary upload URL, when it
 * is falsy, or when it already carries a transformation — so calling it twice,
 * or on a URL someone has already tuned by hand, is safe.
 */
export function sizedImageUrl(url: string | undefined, options: CloudinaryOptions): string | undefined {
  if (!url) return url
  const match = CLOUDINARY_UPLOAD.exec(url)
  if (!match) return url

  const [, base, rest] = match
  // A transformation segment precedes the version (v123…) or public id and
  // contains `_`. If one is already present, leave the URL alone rather than
  // stacking a second, which changes the meaning of the first.
  const firstSegment = rest.split('/')[0] ?? ''
  if (firstSegment.includes('_') && !/^v\d+$/.test(firstSegment)) return url

  const width = Math.max(1, Math.round(options.width))
  const dpr = options.retina === false ? '' : ',dpr_2.0'
  return `${base}/f_auto,q_auto,c_limit,w_${width}${dpr}/${rest}`
}
