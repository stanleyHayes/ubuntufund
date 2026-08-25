/**
 * The kind of destination a short link / dynamic QR code points at. Drives how
 * the target URL is built from the campaign (and, for `live`, a live session).
 * - `campaign`  → the campaign page
 * - `live`      → the campaign's live view (optionally a specific session)
 * - `amount`    → the donate flow pre-filled with a preset amount
 * - `creator`   → the campaign creator's public profile
 * - `event`     → the campaign page tagged with an event label (offline flyers)
 */
export type QrKind = 'campaign' | 'live' | 'amount' | 'creator' | 'event'

/**
 * A single coarse scan record. Deliberately minimal: a best-effort attribution
 * source (from `utm_source`/`ref`) and a timestamp — never any donor, payment,
 * device, or IP data.
 */
export interface ShortLinkScan {
  /** Coarse attribution source (`utm_source` or `ref`), when present. */
  source?: string
  scannedAt: Date
}

/**
 * A short, shareable redirect for a campaign / dynamic QR code. `code` is the
 * public short id; `target` is the resolved destination URL that `GET /r/:code`
 * 302-redirects to.
 */
export interface ShortLink {
  id: string
  /** Public short id used in `/r/:code` and `/qr/:code.(svg|png)`. */
  code: string
  campaignId: string
  /** Present only for `kind: 'live'` links bound to a specific session. */
  liveSessionId?: string
  kind: QrKind
  /** Present only for `kind: 'amount'` links. */
  presetAmount?: number
  /** Optional human label (e.g. the event/flyer name). */
  label?: string
  createdBy: string
  /** Resolved destination URL, built from `PUBLIC_WEB_URL`. */
  target: string
  scanCount: number
  createdAt: Date
}

/**
 * A short link enriched with its human-readable short URL (`${PUBLIC_API_URL}/r/:code`).
 * Returned by the QR list endpoint.
 */
export interface ShortLinkView extends ShortLink {
  shortUrl: string
}

/** Body for `POST /campaigns/:id/qr-codes`. */
export interface CreateQrCodeInput {
  kind: QrKind
  presetAmount?: number
  label?: string
  liveSessionId?: string
}

/**
 * Response from `POST /campaigns/:id/qr-codes`: the short link plus a rendered
 * QR of its `shortUrl` (PNG data URL + inline SVG string) ready to display.
 */
export interface QrCodeResponse {
  code: string
  /** Human-readable short URL the QR encodes, `${PUBLIC_API_URL}/r/:code`. */
  shortUrl: string
  /** Resolved destination the short URL redirects to. */
  target: string
  /** `data:image/png;base64,…` PNG rendering of `shortUrl`. */
  pngDataUrl: string
  /** Standalone inline `<svg>…</svg>` rendering of `shortUrl`. */
  svg: string
}
