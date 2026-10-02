import { useEffect, useRef, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import BlockRoundedIcon from '@mui/icons-material/BlockRounded'
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import TextField from '@/components/AdminTextField'
import { approvalClosed, approvalValidUntil, humanizeKey, reasonView, type PublicationReviewItem, type ReviewQueue } from '@/lib/publicationReview'
import { formatDateTime, formatRelative } from '@/lib/reviewDates'
import { publicationStatusLine, type ReviewGuidance, type StatusTone } from '@/lib/reviewGuidance'
import { EvidenceText } from './ReviewParts'

export interface ReviewLinks {
  users: boolean
  campaigns: boolean
  audit: boolean
}

export interface DecisionError {
  id: string
  message: string
  status?: number
  /**
   * Why the decision was refused, from the API's `errors.review`: decided,
   * changed or author_restricted, withdrawn or superseded (409), or conflict
   * (403: the reviewer manages what it is for).
   */
  code?: string
}

export const MIN_NOTES = 20

interface Props {
  item: PublicationReviewItem
  queue: ReviewQueue
  guidance: ReviewGuidance
  now: number
  /** The reviewer wrote this submission. */
  own: boolean
  /** Tip or donation content sent to the reviewer's own page or campaign. */
  ownRecipient: boolean
  /** For a campaign the reviewer created: the API refuses their decision (conflict of interest). */
  ownCampaign?: boolean
  notes: string
  onNotesChange: (value: string) => void
  /** Notes were written for an earlier version of this content, which has changed since. */
  earlierVersionNotes: boolean
  /** The id of the item whose decision is being saved, or ''. */
  busy: string
  error: DecisionError | null
  onDecide: (decision: 'approved' | 'rejected') => void
  onRefresh: () => void
  links: ReviewLinks
}

/**
 * The title of a refused decision. Conflicts are named only when the API says
 * which one it was (`errors.review`): a restricted author is not fixed by a
 * refresh, so it must not read like a decision someone else already made.
 */
function errorTitle(error: DecisionError, author: string): string {
  if (error.code === 'decided') return 'Already decided'
  if (error.code === 'changed') return 'Content changed'
  if (error.code === 'author_restricted') return `${author} can’t publish`
  // Closed before any decision: nobody decided it, so it must not read as "Already decided".
  if (error.code === 'withdrawn') return 'Withdrawn by the author'
  if (error.code === 'superseded') return 'Replaced by a newer version'
  if (error.code === 'conflict') return 'Conflict of interest'
  return error.status === 403 ? 'Not allowed' : 'Decision not saved'
}

const STATUS_TONES: Record<StatusTone, { color: string; icon: ReactNode }> = {
  success: { color: 'var(--text-success)', icon: <CheckCircleOutlineRoundedIcon /> },
  info: { color: 'var(--text-info)', icon: <AutorenewRoundedIcon /> },
  warning: { color: 'var(--text-warning)', icon: <ErrorOutlineRoundedIcon /> },
  neutral: { color: 'text.secondary', icon: <ScheduleRoundedIcon /> },
}

const VERBS: Record<string, string> = { approved: 'Approved', rejected: 'Declined' }

const sectionSx = { borderTop: 1, borderColor: 'divider', pt: { xs: 2, sm: 3 } } as const
const noteLabelSx = { fontSize: '0.72rem', color: 'text.secondary', mb: 0.75 } as const

function reviewerName(item: PublicationReviewItem): string | null {
  if (item.reviewer?.automated || item.reviewedBy === 'automated:openai') return 'automated screening'
  if (item.reviewer?.name) return item.reviewer.name
  return item.reviewedBy ? `administrator ${item.reviewedBy}` : null
}

function Decided({ item, queue, guidance, now, links }: Pick<Props, 'item' | 'queue' | 'guidance' | 'now' | 'links'>) {
  const verb = VERBS[item.status] ?? humanizeKey(item.status || 'decided')
  const reviewer = reviewerName(item)
  const exact = formatDateTime(item.reviewedAt)
  const relative = formatRelative(item.reviewedAt, now)
  // A published, replaced or withdrawn version's approval can never be used again: its expiry says nothing.
  const validUntil = queue === 'publication' && item.status === 'approved' && !approvalClosed(item) ? approvalValidUntil(item) : undefined
  const validUntilExact = formatDateTime(validUntil)
  const stillValid = !!validUntil && Date.parse(validUntil) > now
  const validRelative = formatRelative(validUntil, now)
  const publication = queue === 'publication' ? publicationStatusLine(item, now) : null
  const tone = publication ? STATUS_TONES[publication.tone] : null
  return <Box component="section" sx={sectionSx}>
    <Stack spacing={1.5}>
      <Typography component="h3" variant="subtitle1" fontWeight={700}>Decision</Typography>
      <Typography variant="body2">
        {verb}{reviewer ? ` by ${reviewer}` : ''}
        {exact && <> · <time dateTime={item.reviewedAt}>{exact}</time>{relative ? ` (${relative})` : ''}</>}
      </Typography>
      {publication && tone && <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ color: tone.color, minWidth: 0 }}>
        <Box component="span" aria-hidden sx={{ display: 'inline-flex', pt: '1px', '& svg': { fontSize: 18 } }}>{tone.icon}</Box>
        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 600, minWidth: 0 }}>{publication.text}</Typography>
      </Stack>}
      {validUntilExact && (stillValid
        ? <Typography variant="body2">Approval valid until {validUntilExact}{validRelative ? ` (${validRelative})` : ''}</Typography>
        : <Typography variant="body2" color="text.secondary">Approval expired {validUntilExact}</Typography>)}
      {item.reviewNotes && <Box>
        <Typography sx={noteLabelSx}>Review notes</Typography>
        <EvidenceText text={item.reviewNotes} expandNoun="notes" />
      </Box>}
      {stillValid && guidance.approvedHint && <Box>
        <Typography variant="body2">{guidance.approvedHint}</Typography>
        {links.campaigns && <Button component={RouterLink} to="/campaigns" size="small" sx={{ mt: 0.5 }}>Open Campaigns</Button>}
      </Box>}
      {links.audit && <Box><Button component={RouterLink} to={`/audit?search=${encodeURIComponent(item.id)}`} startIcon={<HistoryEduRoundedIcon />}>Audit record</Button></Box>}
    </Stack>
  </Box>
}

/** What approving does: an alert with a title, a warning note when it can't be taken back, otherwise one sentence. */
function ApprovalGuidance({ approval }: { approval: ReviewGuidance['approval'] }) {
  if (approval.title) return <Alert severity="info" role="note">
    <AlertTitle>{approval.title}</AlertTitle>
    {approval.lead}
    {!!approval.bullets?.length && <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, '& > li + li': { mt: 0.5 } }}>{approval.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</Box>}
  </Alert>
  if (approval.tone === 'warning') return <Alert severity="warning" role="note">{approval.lead}</Alert>
  return <Typography variant="body2">{approval.lead}</Typography>
}

/** The decision area of a review card: guidance, notes and the two decisions, or the recorded decision. */
export function ReviewDecision({ item, queue, guidance, now, own, ownRecipient, ownCampaign = false, notes, onNotesChange, earlierVersionNotes, busy, error, onDecide, onRefresh, links }: Props) {
  const errorRef = useRef<HTMLDivElement>(null)
  // The buttons are disabled while saving, which drops keyboard focus; a failure brings it to the explanation.
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  if (item.status !== 'pending') return <Decided item={item} queue={queue} guidance={guidance} now={now} links={links} />
  const trimmed = notes.trim().length
  const blocked = own || ownRecipient || ownCampaign || !!busy || trimmed < MIN_NOTES
  const reason = reasonView(item.reason)
  const { approval } = guidance
  const contentOwner = item.action === 'donation.public_content' ? 'donor' : 'supporter'
  const author = queue === 'publication' ? 'Author' : contentOwner === 'donor' ? 'Donor' : 'Supporter'
  const audience = queue === 'publication' ? 'Visible to the author' : `Kept with the decision and the audit record; not shown to the ${contentOwner}`
  // Not a named region: every card has one, and identical landmarks only add noise. The h3 structures it.
  // Static callouts are notes, not alerts, so loading a queue does not set off a burst of announcements.
  return <Box component="section" sx={sectionSx}>
    <Stack spacing={2}>
      <Typography component="h3" variant="subtitle1" fontWeight={700}>Your decision</Typography>
      {/* The API refuses self-review; say why before the reviewer writes notes. */}
      {own && <Alert severity="info" role="note">You submitted this. Another administrator must review it.</Alert>}
      {!own && ownRecipient && <Alert severity="info" role="note">This was sent to your own campaign or creator page. Another administrator must review it.</Alert>}
      {/* The API refuses decisions on content for a campaign the reviewer manages; creating it is the case the card can see. */}
      {!own && !ownRecipient && ownCampaign && <Alert severity="info" role="note">This is for a campaign you created. Another administrator must review it.</Alert>}
      {queue === 'publication' && reason.explanation && <Typography variant="body2"><Box component="span" sx={{ fontWeight: 700 }}>Why it is here:</Box> {reason.explanation}</Typography>}
      <ApprovalGuidance approval={approval} />
      {item.reviewNotes && <Box>
        <Typography sx={noteLabelSx}>Notes from an earlier decision</Typography>
        <EvidenceText text={item.reviewNotes} expandNoun="notes" />
      </Box>}
      {/* Notes are kept per content version, so notes about earlier text can never approve this one. */}
      {earlierVersionNotes && <Alert severity="warning" role="note">This name or message changed after you wrote notes on it, so those notes were not carried over. Read it again and write notes for this version.</Alert>}
      <TextField
        optionContext="publication"
        label="Review notes (at least 20 characters)"
        multiline
        minRows={3}
        value={notes}
        onChange={event => onNotesChange(event.target.value)}
        inputProps={{ maxLength: 2000 }}
        helperText={`${trimmed.toLocaleString('en-GH')}/2,000 characters · ${audience}`}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
        <Button variant="contained" startIcon={<CheckRoundedIcon />} disabled={blocked} onClick={() => onDecide('approved')} sx={{ width: { xs: '100%', sm: 'auto' } }}>Approve this version</Button>
        <Button color="error" startIcon={<BlockRoundedIcon />} disabled={blocked} onClick={() => onDecide('rejected')} sx={{ width: { xs: '100%', sm: 'auto' } }}>Decline this version</Button>
      </Stack>
      {busy === item.id && <Typography role="status" variant="body2" color="text.secondary">Saving decision and audit record…</Typography>}
      {error?.id === item.id && <Alert ref={errorRef} tabIndex={-1} severity="error" action={<Button color="inherit" size="small" onClick={onRefresh}>Refresh</Button>}>
        <AlertTitle>{errorTitle(error, author)}</AlertTitle>
        <Typography component="span" display="block">{error.message}</Typography>
      </Alert>}
    </Stack>
  </Box>
}
