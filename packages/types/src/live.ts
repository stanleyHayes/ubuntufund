/**
 * Live sessions turn a campaign into a real-time fundraising event: a host
 * starts a session, shares a QR/overlay, and donations stream to a public
 * donor sheet and to an on-screen overlay (OBS/browser source) as they land.
 *
 * Privacy is host-controlled. `showDonorNames`, `showDonorMessages`, and
 * `showAmounts` toggle each field independently; `privacyMode` is a master
 * switch that force-hides identifying donor info (names + messages) regardless
 * of the individual toggles. Hidden names render as `Anonymous`; hidden
 * amounts serialize as `null`.
 */
export type LiveSessionStatus = 'active' | 'ended'

/** Rolling counters accumulated over a live session's lifetime. */
export interface LiveSessionStats {
  /** Short-link scans attributed to this session. */
  scans: number
  /** Donation checkouts started (reserved for the hosted-payment phases). */
  checkoutStarts: number
  /** Donations that completed successfully during the session. */
  successfulDonations: number
  /** Total amount raised during the session, in the campaign's currency. */
  amountRaised: number
}

/**
 * A live fundraising session bound to a campaign.
 *
 * `overlayToken` is a secret, revocable bearer token that authorizes the
 * overlay + SSE reads — it is only ever returned to the owner (start / update /
 * rotate responses) and never appears in public DTOs.
 */
export interface LiveSession {
  id: string
  campaignId: string
  title?: string
  /** Optional session-specific goal, distinct from the campaign goal. */
  targetAmount?: number
  status: LiveSessionStatus
  /** Secret, revocable token gating overlay + SSE reads. Owner-only. */
  overlayToken: string
  showDonorNames: boolean
  showDonorMessages: boolean
  showAmounts: boolean
  /** Master privacy switch: force-hides donor names + messages when true. */
  privacyMode: boolean
  startedAt: Date
  endedAt?: Date
  stats: LiveSessionStats
}

/** Body for `POST /campaigns/:id/live-sessions`. */
export interface StartLiveSessionInput {
  title?: string
  targetAmount?: number
  showDonorNames?: boolean
  showDonorMessages?: boolean
  showAmounts?: boolean
  privacyMode?: boolean
}

/**
 * Body for `PATCH /live-sessions/:id`. Setting `status: 'ended'` closes the
 * session; any privacy fields present are applied to a still-active session.
 */
export interface UpdateLiveSessionInput {
  status?: 'ended'
  showDonorNames?: boolean
  showDonorMessages?: boolean
  showAmounts?: boolean
  privacyMode?: boolean
}

/**
 * Public donor-facing sheet for a live session (`GET /live-sessions/:id/public`).
 * Omits the overlay token and honors the host's amount-visibility choice.
 */
export interface LiveSessionPublicView {
  id: string
  campaignId: string
  title?: string
  targetAmount?: number
  status: LiveSessionStatus
  startedAt: Date
  endedAt?: Date
  /** Amount raised during the session; `null` when the host hid amounts. */
  amountRaised: number | null
  /** Successful donation count during the session (never hidden). */
  successfulDonations: number
}

export interface LiveOverlayConfig {
  showDonorNames: boolean
  showDonorMessages: boolean
  showAmounts: boolean
  privacyMode: boolean
}

/** A single recent donor entry on the overlay, already privacy-filtered. */
export interface LiveOverlayDonor {
  donationId: string
  /** `Anonymous` when the donor is anonymous or names are hidden. */
  name: string
  /** `null` when amounts are hidden. */
  amount: number | null
  /** Omitted when messages are hidden or none was left. */
  message?: string
  createdAt: Date
}

export interface LiveOverlayTotals {
  /** `null` when amounts are hidden. */
  amountRaised: number | null
  successfulDonations: number
  scans: number
  checkoutStarts: number
}

/**
 * Overlay payload (`GET /live-sessions/:id/overlay?token=…`): the session
 * config, current session + whole-campaign totals, and a privacy-filtered list
 * of recent donors, ready to render as an on-screen source. Requires the
 * session's overlay token.
 */
export interface LiveOverlayView {
  sessionId: string
  campaignId: string
  title?: string
  targetAmount?: number
  status: LiveSessionStatus
  config: LiveOverlayConfig
  totals: LiveOverlayTotals
  /** Whole-campaign raised amount, so the overlay can render a goal bar. */
  campaignRaisedAmount: number
  campaignGoalAmount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
  currency: string
  recentDonors: LiveOverlayDonor[]
}

/**
 * The four real-time event kinds pushed over the SSE gateway:
 * - `donation`  → a donation just succeeded (privacy-filtered)
 * - `total`     → recomputed running totals
 * - `milestone` → a 25/50/75/100% goal threshold was crossed
 * - `alert`     → free-form host/system message
 */
export type LiveEventType = 'donation' | 'total' | 'milestone' | 'alert'

/**
 * A single real-time event as delivered over SSE. `id` is a monotonic sequence
 * used for `Last-Event-ID` resume; `ts` is epoch milliseconds.
 */
export interface LiveEvent<T = unknown> {
  id: number
  type: LiveEventType
  data: T
  ts: number
}

/** `data` payload of a `donation` event. Dates are ISO strings over the wire. */
export interface LiveDonationEventData {
  donationId: string
  /** `Anonymous` when the donor is anonymous or names are hidden. */
  name: string
  /** `null` when amounts are hidden. */
  amount: number | null
  /** Omitted when messages are hidden or none was left. */
  message?: string
  createdAt: string
}

/** `data` payload of a `total` event. */
export interface LiveTotalEventData {
  campaignId: string
  raisedAmount: number
  goalAmount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
  currency: string
  liveSessionId?: string
  /** Session-scoped running total; `null` when the host hid amounts. */
  sessionAmountRaised?: number | null
}

/** `data` payload of a `milestone` event. */
export interface LiveMilestoneEventData {
  campaignId: string
  /** The crossed threshold: 25, 50, 75, or 100. */
  percent: number
  /** `null` when amounts are hidden (on a session channel). */
  raisedAmount: number | null
  goalAmount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency */
  currency: string
  liveSessionId?: string
}
