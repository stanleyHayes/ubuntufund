import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Link from '@mui/material/Link'
import type { SxProps, Theme } from '@mui/material/styles'

/**
 * Screen readers reliably announce text added to a live region they already
 * know about, not a region that arrives with its text. Safari needs about this
 * long to pick up a new region (react-aria's announcer uses the same delay).
 */
const LIVE_REGION_DELAY_MS = 100
/** Keeps the empty region in the accessibility tree without showing it or taking space. */
const registering = { position: 'absolute', width: '1px', height: '1px', p: 0, m: '-1px', border: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/**
 * Shown when the API held a public change for safety review (see
 * `isPublicationHeld`). Being held is an expected step, not a failure, so this
 * is a neutral status notice rather than a red error.
 *
 * `reviews` says where the Publication reviews list is: already on screen
 * (`above` / `below`), or elsewhere (`link`, opened in a new tab so an unsaved
 * draft on this page is kept).
 */
export function PublicationHeldNotice({ retry = 'submit it again unchanged', reviews = 'link', sx }: {
  /** What to do after approval, completing "After a reviewer approves it, …". */
  retry?: string
  reviews?: 'above' | 'below' | 'link'
  sx?: SxProps<Theme>
}) {
  // Mount the status region empty and hidden, then fill it once it has
  // registered, so the notice is announced; it looks the same, a moment later.
  const [registered, setRegistered] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setRegistered(true), LIVE_REGION_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <Alert severity="info" role="status" aria-live="polite" sx={registered ? sx : registering}>
      {registered && <>
        <AlertTitle>Waiting for safety review</AlertTitle>
        Saved privately for safety review. This version is not public yet. After a reviewer approves it, {retry} to publish it.{' '}
        {reviews === 'link'
          ? <Link href="/settings#privacy" target="_blank" rel="noopener">Check Publication reviews for the decision (opens in a new tab).</Link>
          : `Check Publication reviews ${reviews} for the decision.`}
      </>}
    </Alert>
  )
}
