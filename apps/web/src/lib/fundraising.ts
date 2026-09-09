// ---------------------------------------------------------------------------
// Fundraising client — typed wrapper over the "Seamless Social & LIVE
// Fundraising" extension endpoints (see SOCIAL_LIVE_FUNDRAISING.md).
//
// Covers the guest donate flow (campaign-by-slug + donation intents with
// Paystack/wallet rails), owner LIVE-session controls, and dynamic QR codes.
// Built on the existing `api` client (auth-aware, unwraps the `{ data }`
// envelope). The one call that needs a custom header — the donation intent's
// `Idempotency-Key` — and the PATCH calls (which `api` has no method for) use
// the lower-level `request` helper, which also unwraps errors as `ApiError`.
// ---------------------------------------------------------------------------

import { api, request, ApiError } from './api'
import type {
  CampaignPublicView,
  CreateDonationIntentInput,
  DonationIntentPublicView,
  LiveSession,
  StartLiveSessionInput,
  UpdateLiveSessionInput,
  LiveSessionPublicView,
  CreateQrCodeInput,
  QrCodeResponse,
  ShortLinkView,
} from '@ubuntu-fund/types'

// --- Re-exported contract types (import from this module in the UI) ---------
export type { CampaignPublicView, CreateDonationIntentInput, DonationIntentPublicView, LiveSession, StartLiveSessionInput, LiveSessionPublicView, QrKind, CreateQrCodeInput, QrCodeResponse, ShortLinkView } from '@ubuntu-fund/types'

// The API base the browser talks to. In production `/api/v1` is rewritten to
// the API; set VITE_API_URL to point at an absolute origin instead.
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the Paystack rail is disabled server-side (no secret key
 * configured) — the API answers `POST /donation-intents {provider:'paystack'}`
 * with `501`. The UI can detect this specific case via `err.code` /
 * `err.status` and fall back to the wallet rail or show a "payments coming
 * soon" state, rather than treating it as a generic failure.
 */
export class PaymentsNotConfiguredError extends Error {
  readonly code = 'PAYMENTS_NOT_CONFIGURED' as const
  readonly status = 501
  constructor(message = 'Payments are not configured') {
    super(message)
    this.name = 'PaymentsNotConfiguredError'
  }
}

/** Narrowing helper for `catch` blocks in the UI. */
export function isPaymentsNotConfigured(err: unknown): err is PaymentsNotConfiguredError {
  return (
    err instanceof PaymentsNotConfiguredError ||
    (err instanceof ApiError && err.status === 501)
  )
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read the stored access token (mirrors the resolution used by `api`). */
function getStoredToken(): string | undefined {
  const direct = localStorage.getItem('accessToken')
  if (direct) return direct
  try {
    const tokens = JSON.parse(localStorage.getItem('uf_tokens') ?? 'null')
    return tokens?.accessToken ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Authenticated PATCH that unwraps the `{ data }` envelope. `api` exposes no
 * PATCH method, so this reuses the lower-level `request` (attaching the stored
 * token) and returns the unwrapped payload.
 */
async function authedPatch<T>(path: string, body?: unknown): Promise<T> {
  const envelope = await request<{ data: T }>(path, {
    method: 'PATCH',
    token: getStoredToken(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  return envelope.data
}

// ---------------------------------------------------------------------------
// Donation intents (guest-capable)
// ---------------------------------------------------------------------------

/**
 * Result of `createDonationIntent`. The Paystack rail returns the hosted
 * checkout handoff (`authorization_url` etc.) wrapping the created intent; the
 * wallet rail settles inline and returns just the intent — this shape
 * normalizes both so `.intent` is always present.
 */
export interface DonationIntentCreateResult {
  intent: DonationIntentPublicView & { providerRef?: string }
  /** Paystack-hosted page the donor is redirected to (paystack rail only). */
  authorization_url?: string
  /** Access code for Paystack Inline (paystack rail only). */
  access_code?: string
  /** Transaction reference correlating the later webhook (paystack rail only). */
  reference?: string
}

/**
 * Create a donation intent (`POST /donation-intents`, guest-capable). Sends a
 * fresh `Idempotency-Key` so retries never double-charge, and forwards the
 * stored auth token when present (needed for the authenticated wallet rail).
 *
 * @throws {PaymentsNotConfiguredError} when the Paystack rail is disabled (501).
 */
export async function createDonationIntent(
  input: CreateDonationIntentInput,
): Promise<DonationIntentCreateResult> {
  try {
    const envelope = await request<{ data: unknown }>('/donation-intents', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      token: getStoredToken(),
    })

    const data = envelope.data
    // Paystack rail → `{ intent, authorization_url, ... }`; wallet rail → the
    // intent view directly. Normalize both to `DonationIntentCreateResult`.
    if (data && typeof data === 'object' && 'intent' in data) {
      return data as DonationIntentCreateResult
    }
    return { intent: data as DonationIntentPublicView & { providerRef?: string } }
  } catch (err) {
    if (err instanceof ApiError && err.status === 501) {
      throw new PaymentsNotConfiguredError(err.message)
    }
    throw err
  }
}

/**
 * Poll a donation intent's public status (`GET /donation-intents/:id/public`).
 * Never treat a Paystack redirect as success — poll this for `SUCCEEDED`.
 */
export function getDonationIntentStatus(id: string): Promise<DonationIntentPublicView> {
  return api.get<DonationIntentPublicView>(`/donation-intents/${id}/public`)
}

// ---------------------------------------------------------------------------
// Campaigns (public, by slug)
// ---------------------------------------------------------------------------

/**
 * Resolve the public campaign view by vanity slug
 * (`GET /campaigns/slug/:slug/public`) — the campaign DTO plus a
 * `socialPreview` block for share cards / meta tags.
 */
export function getCampaignBySlug(slug: string): Promise<CampaignPublicView> {
  return api.get<CampaignPublicView>(`/campaigns/slug/${encodeURIComponent(slug)}/public`)
}

// ---------------------------------------------------------------------------
// LIVE sessions (owner — authenticated via `api`)
// ---------------------------------------------------------------------------

/** Privacy toggles accepted when updating an active LIVE session. */
export type LiveSessionPrivacyToggles = Pick<
  UpdateLiveSessionInput,
  'showDonorNames' | 'showDonorMessages' | 'showAmounts' | 'privacyMode'
>

/**
 * Start a LIVE session for a campaign
 * (`POST /campaigns/:id/live-sessions`, owner). The returned session includes
 * the secret `overlayToken` (owner-only) used to build the overlay URL.
 */
export function startLiveSession(
  campaignId: string,
  body: StartLiveSessionInput = {},
): Promise<LiveSession> {
  return api.post<LiveSession>(`/campaigns/${campaignId}/live-sessions`, body)
}

/** End a LIVE session (`PATCH /live-sessions/:id` with `{ status:'ended' }`). */
export function endLiveSession(sessionId: string): Promise<LiveSession> {
  return authedPatch<LiveSession>(`/live-sessions/${sessionId}`, { status: 'ended' })
}

/** Update a still-active session's privacy toggles (`PATCH /live-sessions/:id`). */
export function updateLiveSessionPrivacy(
  sessionId: string,
  toggles: LiveSessionPrivacyToggles,
): Promise<LiveSession> {
  return authedPatch<LiveSession>(`/live-sessions/${sessionId}`, toggles)
}

/**
 * Revoke and reissue the overlay token
 * (`POST /live-sessions/:id/overlay-token/rotate`, owner). The returned session
 * carries the new `overlayToken`.
 */
export function rotateOverlayToken(sessionId: string): Promise<LiveSession> {
  return api.post<LiveSession>(`/live-sessions/${sessionId}/overlay-token/rotate`)
}

/**
 * Public donor-facing session sheet (`GET /live-sessions/:id/public`). Omits
 * the overlay token and honors the host's amount-visibility choice.
 */
export function getLiveSessionPublic(sessionId: string): Promise<LiveSessionPublicView> {
  return api.get<LiveSessionPublicView>(`/live-sessions/${sessionId}/public`)
}

// ---------------------------------------------------------------------------
// Dynamic QR codes (owner — authenticated via `api`)
// ---------------------------------------------------------------------------

/**
 * Mint a dynamic QR / short-link for a campaign
 * (`POST /campaigns/:id/qr-codes`, owner) — returns the short code, its
 * shareable `shortUrl`, the resolved `target`, and rendered QR (`pngDataUrl`
 * + inline `svg`).
 */
export function createQrCode(
  campaignId: string,
  input: CreateQrCodeInput,
): Promise<QrCodeResponse> {
  return api.post<QrCodeResponse>(`/campaigns/${campaignId}/qr-codes`, input)
}

/** List a campaign's short-links / QR codes (`GET /campaigns/:id/qr-codes`, owner). */
export function listCampaignQrCodes(campaignId: string): Promise<ShortLinkView[]> {
  return api.get<ShortLinkView[]>(`/campaigns/${campaignId}/qr-codes`)
}

// ---------------------------------------------------------------------------
// URL / path helpers
// ---------------------------------------------------------------------------

/**
 * Absolute overlay browser-source URL for OBS
 * (`GET /live-sessions/:id/overlay/view?token=…`). Hand this to the host to
 * paste into OBS as a Browser Source.
 */
export function overlayViewUrl(sessionId: string, token: string): string {
  // OBS needs an ABSOLUTE URL — when API_BASE is a proxied relative path
  // ('/api/v1'), anchor it to the current origin so the copied link resolves.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const base = /^https?:\/\//.test(API_BASE) ? API_BASE : `${origin}${API_BASE}`
  return `${base}/live-sessions/${sessionId}/overlay/view?token=${encodeURIComponent(token)}`
}

/** In-app path to a campaign's public page. Accepts a slug or campaign id. */
export function campaignPublicPath(slugOrId: string): string {
  return `/c/${slugOrId}`
}

/** In-app path to a campaign's guest donate flow. Accepts a slug or campaign id. */
export function donatePath(slugOrId: string): string {
  return `/c/${slugOrId}/donate`
}
