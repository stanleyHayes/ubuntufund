// ---------------------------------------------------------------------------
// useLiveTotals — subscribe to a campaign's real-time SSE feed and expose the
// running totals + latest donations for LIVE creator controls / overlays.
//
// Opens `GET /campaigns/:id/events` (the "Seamless Social & LIVE Fundraising"
// SSE gateway — see SOCIAL_LIVE_FUNDRAISING.md) with a plain EventSource and
// listens for the named frames the server pushes:
//   • `total`     → recomputed running totals (raised / goal)
//   • `donation`  → a donation just succeeded (privacy-filtered)
//   • `milestone` → a 25/50/75/100% threshold was crossed
//
// It deliberately talks to the fundraising events endpoint directly rather than
// going through `useSSE` (which targets the separate `/sse/*` gateway and is
// gated behind VITE_SSE_ENABLED). EventSource reconnects on its own; the hook
// closes the stream on unmount / campaign change.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import type {
  LiveDonationEventData,
  LiveTotalEventData,
  LiveMilestoneEventData,
} from '@ubuntu-fund/types'

// Same base the rest of the app talks to; '/api/v1' is proxied to the API.
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

export interface UseLiveTotalsOptions {
  /** Seed the raised total from the already-loaded campaign until live data lands. */
  initialRaisedAmount?: number
  /** Seed the goal from the already-loaded campaign until live data lands. */
  initialGoalAmount?: number
  /** When false, the hook never opens a connection (e.g. no active session). */
  enabled?: boolean
  /** Cap on the retained `donations` buffer (newest first). Defaults to 50. */
  maxDonations?: number
}

export interface LiveTotals {
  /** Current campaign raised amount (live once a `total`/`milestone` frame lands). */
  raisedAmount: number
  /** Campaign goal amount. */
  goalAmount: number
  /** Recent donation events observed this subscription, newest first. */
  donations: LiveDonationEventData[]
  /** The most recent donation event, or null before any arrive. */
  lastDonation: LiveDonationEventData | null
  /** Whether the SSE stream is currently open. */
  connected: boolean
}

/**
 * Subscribe to a campaign's live donation/total feed.
 *
 * @param campaignId  campaign to subscribe to; when falsy no stream is opened.
 * @param options     seed totals + control flags (see {@link UseLiveTotalsOptions}).
 */
export function useLiveTotals(
  campaignId: string | undefined,
  options: UseLiveTotalsOptions = {},
): LiveTotals {
  const {
    initialRaisedAmount = 0,
    initialGoalAmount = 0,
    enabled = true,
    maxDonations = 50,
  } = options

  const [raisedAmount, setRaisedAmount] = useState(initialRaisedAmount)
  const [goalAmount, setGoalAmount] = useState(initialGoalAmount)
  const [donations, setDonations] = useState<LiveDonationEventData[]>([])
  const [lastDonation, setLastDonation] = useState<LiveDonationEventData | null>(null)
  const [connected, setConnected] = useState(false)

  // Whether a live `total`/`milestone` frame has landed yet. Until it does, the
  // seed values from the loaded campaign (which resolve asynchronously) may
  // still refresh the displayed totals; once live data flows, it takes over.
  const hasLiveTotalRef = useRef(false)

  // Seed / re-seed from the campaign's known totals until live data arrives.
  // The seeds resolve asynchronously (the campaign loads after mount), so we sync
  // them into state here; the set-state-in-effect rule flags it, but seeding from
  // async-loaded props until the live feed takes over is intended.
  useEffect(() => {
    if (hasLiveTotalRef.current) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setRaisedAmount(initialRaisedAmount)
    setGoalAmount(initialGoalAmount)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialRaisedAmount, initialGoalAmount])

  useEffect(() => {
    if (!enabled || !campaignId) return
    if (typeof EventSource === 'undefined') return

    // Fresh subscription — reset the per-connection buffers. Synchronous resets
    // on subscription setup are intended (a new campaign starts a clean feed).
    hasLiveTotalRef.current = false
    /* eslint-disable react-hooks/set-state-in-effect */
    setDonations([])
    setLastDonation(null)
    /* eslint-enable react-hooks/set-state-in-effect */

    let es: EventSource
    try {
      es = new EventSource(`${API_BASE}/campaigns/${campaignId}/events`)
    } catch {
      // EventSource unavailable/blocked — degrade to the seeded static totals.
      return
    }

    const handleOpen = () => setConnected(true)
    // The browser retries automatically; just reflect the dropped state.
    const handleError = () => setConnected(false)

    const handleTotal = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as LiveTotalEventData
        hasLiveTotalRef.current = true
        if (typeof data.raisedAmount === 'number') setRaisedAmount(data.raisedAmount)
        if (typeof data.goalAmount === 'number') setGoalAmount(data.goalAmount)
      } catch {
        /* ignore a malformed frame */
      }
    }

    const handleDonation = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as LiveDonationEventData
        setLastDonation(data)
        setDonations((prev) => [data, ...prev].slice(0, maxDonations))
      } catch {
        /* ignore a malformed frame */
      }
    }

    const handleMilestone = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as LiveMilestoneEventData
        hasLiveTotalRef.current = true
        if (typeof data.raisedAmount === 'number') setRaisedAmount(data.raisedAmount)
        if (typeof data.goalAmount === 'number') setGoalAmount(data.goalAmount)
      } catch {
        /* ignore a malformed frame */
      }
    }

    es.addEventListener('open', handleOpen)
    es.addEventListener('error', handleError)
    es.addEventListener('total', handleTotal as EventListener)
    es.addEventListener('donation', handleDonation as EventListener)
    es.addEventListener('milestone', handleMilestone as EventListener)

    return () => {
      es.removeEventListener('open', handleOpen)
      es.removeEventListener('error', handleError)
      es.removeEventListener('total', handleTotal as EventListener)
      es.removeEventListener('donation', handleDonation as EventListener)
      es.removeEventListener('milestone', handleMilestone as EventListener)
      es.close()
      setConnected(false)
    }
  }, [campaignId, enabled, maxDonations])

  return { raisedAmount, goalAmount, donations, lastDonation, connected }
}
