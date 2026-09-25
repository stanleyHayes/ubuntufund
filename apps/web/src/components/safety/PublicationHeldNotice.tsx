import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Link from '@mui/material/Link'
import type { SxProps, Theme } from '@mui/material/styles'

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
  return (
    <Alert severity="info" role="status" sx={sx}>
      <AlertTitle>Waiting for safety review</AlertTitle>
      Saved privately for safety review. This version is not public yet. After a reviewer approves it, {retry} to publish it.{' '}
      {reviews === 'link'
        ? <Link href="/settings#privacy" target="_blank" rel="noopener">Check Publication reviews for the decision (opens in a new tab).</Link>
        : `Check Publication reviews ${reviews} for the decision.`}
    </Alert>
  )
}
