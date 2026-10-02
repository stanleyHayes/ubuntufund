import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Box, Chip, IconButton, Paper, Stack, Typography } from '@mui/material'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import ForwardToInboxRoundedIcon from '@mui/icons-material/ForwardToInboxRounded'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded'
import LocalCafeRoundedIcon from '@mui/icons-material/LocalCafeRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import { raisedSurface } from '@/lib/surfaces'
import {
  CAMPAIGN_SCOPED_ACTIONS,
  actionLabel,
  contextNames,
  hiddenCharacters,
  hiddenCharactersIn,
  hiddenSummary,
  humanizeKey,
  isObjectId,
  parseSubmission,
  reasonView,
  statusView,
  untitledHeading,
  type AccountSummary,
  type PublicationReviewItem,
  type ReviewQueue,
} from '@/lib/publicationReview'
import { formatDateTime, formatRelative } from '@/lib/reviewDates'
import { guidanceFor } from '@/lib/reviewGuidance'
import { ContextItem, Disclosure, Isolated, joinParts, labelSx, wellSurface } from './ReviewParts'
import { ReviewDecision, type DecisionError, type ReviewLinks } from './ReviewDecision'
import { SubmissionView, SubmittedRecord } from './SubmissionView'

export type { DecisionError, ReviewLinks } from './ReviewDecision'

const DAY_MS = 86_400_000

/** Elements, not component types, so nothing is created during render. */
const ACTION_ICONS: Record<string, ReactNode> = {
  'campaign.create': <RocketLaunchRoundedIcon />,
  'update.create': <CampaignRoundedIcon />,
  'update.edit': <EditNoteRoundedIcon />,
  'live.start': <LiveTvRoundedIcon />,
  'campaign.slug': <LinkRoundedIcon />,
  'comment.create': <ChatBubbleOutlineRoundedIcon />,
  'thank_you.send': <ForwardToInboxRoundedIcon />,
  'account.profile': <PersonOutlineRoundedIcon />,
  'creator.profile': <StorefrontRoundedIcon />,
  'organization.profile': <CorporateFareRoundedIcon />,
  'tip.public_content': <LocalCafeRoundedIcon />,
  'donation.public_content': <VolunteerActivismRoundedIcon />,
}
const DEFAULT_ICON = <FactCheckRoundedIcon />
const PERSON_ICON = <PersonOutlineRoundedIcon />
const ORGANIZATION_ICON = <CorporateFareRoundedIcon />
const CAMPAIGN_ICON = <CampaignRoundedIcon />
const CREATOR_ICON = <StorefrontRoundedIcon />

const ACCOUNT_TYPES: Record<string, string> = { user: 'Individual account', admin: 'Staff account' }
const VERIFICATION_LEVELS: Record<number, string> = { 0: 'None', 1: 'Email / phone', 2: 'National ID', 3: 'Institutional', 4: 'Community' }
const CAMPAIGN_STATUSES: Record<string, string> = { active: 'Active', pending_review: 'Pending review', funded: 'Funded', expired: 'Expired', blocked: 'Blocked', draft: 'Draft' }

/** Theme chip with an AA text token; long labels wrap instead of clipping. */
function chipSx(color: string) {
  return { color, maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.25 } }
}

interface Props {
  item: PublicationReviewItem
  queue: ReviewQueue
  /** When the page loaded. Passed in so nothing reads the clock while rendering. */
  now: number
  currentUserId?: string
  links: ReviewLinks
  notes: string
  onNotesChange: (value: string) => void
  /** Notes were written for an earlier version of this content, which has changed since. */
  earlierVersionNotes?: boolean
  busy: string
  error: DecisionError | null
  onDecide: (decision: 'approved' | 'rejected') => void
  onRefresh: () => void
  campaignReviewGoalGhs?: number
  /** Publishing on approval is on (some version in the list publishes by itself). */
  autoPublishing?: boolean
}

interface AccountLine {
  /** The account's name, or a system phrase; shown isolated. */
  primary: string
  suffix?: string
  secondary?: ReactNode
  to?: string
}

/** Who an account is. Names, emails and organization names are author-controlled, so they are isolated from the labels around them. */
function accountLine(account: AccountSummary | null | undefined, accountId: string, currentUserId: string | undefined, links: ReviewLinks): AccountLine {
  if (account === null) return { primary: 'Account not found', secondary: accountId }
  if (account === undefined) {
    // An older API sends only the id.
    return { primary: `Account ${accountId}`, suffix: accountId === currentUserId ? ' (you)' : undefined, to: links.users && isObjectId(accountId) ? `/users/${accountId}` : undefined }
  }
  const type = account.accountType === 'organization'
    ? <>Organization account{account.organizationName ? <> · <Isolated>{account.organizationName}</Isolated></> : null}</>
    : ACCOUNT_TYPES[account.accountType ?? '']
  const verification = account.verificationLevel === undefined ? undefined : `Verification: ${VERIFICATION_LEVELS[account.verificationLevel] ?? `level ${account.verificationLevel}`}`
  const parts = [account.email ? <Isolated>{account.email}</Isolated> : undefined, type, verification, account.emailVerified === false ? 'Email not verified' : undefined, account.closed ? 'Closed account' : undefined]
  return {
    primary: account.name || 'Unnamed account',
    suffix: account.id === currentUserId ? ' (you)' : undefined,
    secondary: parts.some(Boolean) ? joinParts(parts) : undefined,
    to: links.users && !account.closed && isObjectId(account.id) ? `/users/${account.id}` : undefined,
  }
}

function CampaignContext({ item, links }: { item: PublicationReviewItem; links: ReviewLinks }) {
  const { campaign } = item
  if (campaign === null) return <ContextItem icon={CAMPAIGN_ICON} label="Campaign" primary="Campaign not found" secondary={item.resourceId} />
  if (campaign === undefined) {
    if (!item.resourceId) return null
    if (item.action === 'update.edit') return <ContextItem icon={CAMPAIGN_ICON} label="Campaign" primary={`Campaign update ${item.resourceId}`} />
    return <ContextItem icon={CAMPAIGN_ICON} label="Campaign" primary={`Campaign ${item.resourceId}`} to={links.campaigns && isObjectId(item.resourceId) ? `/campaigns/${item.resourceId}` : undefined} />
  }
  const status = campaign.deleted ? 'Deleted' : campaign.status ? CAMPAIGN_STATUSES[campaign.status] ?? humanizeKey(campaign.status) : undefined
  const warn = campaign.deleted || campaign.status === 'blocked' || campaign.status === 'expired'
  const secondary = (status || campaign.slug) ? joinParts([
    status && <Box component="span" sx={warn ? { color: 'var(--text-warning)', fontWeight: 600 } : undefined}>{status}</Box>,
    campaign.slug && <Isolated>/c/{campaign.slug}</Isolated>,
  ]) : undefined
  return <ContextItem icon={CAMPAIGN_ICON} label="Campaign" primary={campaign.title || 'Untitled campaign'} secondary={secondary} to={links.campaigns && !campaign.deleted && isObjectId(campaign.id) ? `/campaigns/${campaign.id}` : undefined} />
}

function RecipientContext({ item, links }: { item: PublicationReviewItem; links: ReviewLinks }) {
  const { recipient } = item
  if (!recipient) return null
  if (recipient.kind === 'campaign') {
    return <ContextItem icon={CAMPAIGN_ICON} label="Sent to" primary={recipient.name || 'Untitled campaign'} secondary="Campaign" to={links.campaigns && isObjectId(recipient.id) ? `/campaigns/${recipient.id}` : undefined} />
  }
  return <ContextItem icon={CREATOR_ICON} label="Sent to" primary={recipient.name || 'Creator page'} secondary={recipient.handle ? <>Creator page <Isolated>@{recipient.handle}</Isolated></> : 'Creator page'} to={links.users && isObjectId(recipient.id) ? `/users/${recipient.id}` : undefined} />
}

/** The full reference, selectable, with a copy button that says what happened. */
function ReferenceRow({ id }: { id: string }) {
  const [copyState, setCopyState] = useState<'' | 'copied' | 'failed'>('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const pending = timer
    return () => clearTimeout(pending.current)
  }, [])
  async function copy() {
    let copied = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id)
        copied = true
      }
    } catch { copied = false }
    setCopyState(copied ? 'copied' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopyState(''), 3000)
  }
  let message = ''
  if (copyState === 'copied') message = 'Copied'
  else if (copyState === 'failed') message = 'Copy unavailable. Select the reference instead.'
  return <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap columnGap={1} rowGap={0.5} sx={{ minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
      Reference <Box component="span" sx={{ userSelect: 'all', wordBreak: 'break-all' }}>{id}</Box>
    </Typography>
    <IconButton size="small" aria-label="Copy reference" onClick={() => void copy()} sx={{ p: 0.5, '& svg': { fontSize: 16 } }}><ContentCopyRoundedIcon /></IconButton>
    <Typography role="status" variant="caption" color="text.secondary">{message}</Typography>
  </Stack>
}

/** Invisible or text-direction characters in the submission, or in the account, campaign and page names shown with it. */
function hiddenCharacterWarning(item: PublicationReviewItem): string | null {
  const inText = hiddenCharacters(item.text)
  const inNames = hiddenCharactersIn(contextNames(item))
  if (!inText.length && !inNames.length) return null
  const sentences: string[] = []
  if (inText.length) sentences.push(`This submission contains ${hiddenSummary(inText)}.`)
  if (inNames.length) sentences.push(`The names on this card ${inText.length ? 'also contain' : 'contain'} ${hiddenSummary(inNames)}.`)
  let check = 'the names'
  if (inText.length) check = inNames.length ? 'the submitted text and the names' : 'the submitted text'
  sentences.push(`They can hide or reorder text. Check ${check} before deciding.`)
  return sentences.join(' ')
}

/** What the date of a supporter tip or donation is: the payment, not when its public message was last changed. */
const PAYMENT_DATE_LABELS: Record<string, string> = { 'tip.public_content': 'Tip sent', 'donation.public_content': 'Donation made' }

/** One submission in the review queue, laid out so the reviewer can check every field before deciding. */
export default function PublicationReviewCard({ item, queue, now, currentUserId, links, notes, onNotesChange, earlierVersionNotes = false, busy, error, onDecide, onRefresh, campaignReviewGoalGhs, autoPublishing = false }: Props) {
  const titleId = useId()
  const parsed = useMemo(() => parseSubmission(item.action, item.text, item.mediaUrls), [item.action, item.text, item.mediaUrls])
  const hiddenWarning = useMemo(() => hiddenCharacterWarning(item), [item])
  const guidance = guidanceFor(item, parsed, { queue, now, campaignReviewGoalGhs, autoPublishing })
  const status = statusView(item, now)
  const reason = reasonView(item.reason)

  const untitled = untitledHeading(item.action)
  const titled = !!untitled && parsed.kind === 'structured'
  let heading = actionLabel(item.action)
  if (titled) heading = parsed.heading ?? untitled
  else if (item.action === 'creator.profile' && item.baseVersion) heading = item.baseVersion === 'new' ? 'New creator page' : 'Creator page edit'

  const submittedExact = formatDateTime(item.createdAt)
  const submittedRelative = formatRelative(item.createdAt, now)
  const dateLabel = (queue === 'content' && PAYMENT_DATE_LABELS[item.action]) || 'Submitted'
  const purgeAt = Date.parse(item.purgeAt ?? '')
  const purgeSoon = item.status === 'pending' && Number.isFinite(purgeAt) && purgeAt > now && purgeAt - now <= 7 * DAY_MS
  const own = item.status === 'pending' && !!currentUserId && item.actorId === currentUserId
  const ownRecipient = item.status === 'pending' && !!currentUserId && item.ownerId === currentUserId
  // Staff may not decide content for a campaign they manage; the card can see when they created it.
  const ownCampaign = item.status === 'pending' && !!currentUserId && CAMPAIGN_SCOPED_ACTIONS.has(item.action) && item.campaign?.creatorId === currentUserId

  const author = item.actorId === 'Guest' ? { primary: 'Guest (no account)' } : accountLine(item.author, item.actorId, currentUserId, links)
  const profile = item.profileAccount === undefined ? null : accountLine(item.profileAccount, item.resourceId ?? '', currentUserId, links)

  // Buttons keep normal word wrapping: inherited "anywhere" lets a flex row squeeze a label to one letter per line.
  return <Paper component="article" aria-labelledby={titleId} data-review-id={item.id} sx={{ ...raisedSurface, p: { xs: 2, sm: 3 }, overflowWrap: 'anywhere', '& .MuiButton-root': { overflowWrap: 'normal' } }}>
    <Stack spacing={2.5}>
      <Stack spacing={1.25}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '40px minmax(0, 1fr)', sm: '40px minmax(0, 1fr) auto' }, columnGap: 2, rowGap: 1, alignItems: 'start' }}>
          <Box aria-hidden sx={{ ...wellSurface, width: 40, height: 40, display: 'grid', placeItems: 'center', color: 'text.secondary', '& svg': { fontSize: 22 } }}>
            {ACTION_ICONS[item.action] ?? DEFAULT_ICON}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {titled && <Typography sx={labelSx}>{actionLabel(item.action)}</Typography>}
            {/* Focusable from script only: the page returns keyboard focus here after reloading the queue. */}
            <Typography id={titleId} component="h2" variant="h6" fontWeight={800} tabIndex={-1} sx={{ lineHeight: 1.3, overflowWrap: 'anywhere' }}>{heading}</Typography>
            {guidance.subtitle && <Typography variant="body2" color="text.secondary">{guidance.subtitle}</Typography>}
            {titled && parsed.headingMissing && <Typography variant="body2" color="text.secondary">No title was entered.</Typography>}
          </Box>
          <Box sx={{ gridColumn: { xs: '2', sm: 'auto' }, justifySelf: { xs: 'start', sm: 'end' }, minWidth: 0, maxWidth: '100%' }}>
            <Chip size="small" label={status.label} sx={chipSx(status.color)} />
          </Box>
        </Box>
        <Stack direction="row" flexWrap="wrap" useFlexGap columnGap={1.5} rowGap={0.75} alignItems="center">
          {queue === 'publication' && <Chip size="small" label={reason.label} sx={chipSx(reason.color)} />}
          {submittedExact && <Typography variant="body2" color="text.secondary">
            {dateLabel} {submittedRelative ? <time dateTime={item.createdAt} title={submittedExact}>{submittedRelative}</time> : null}{submittedRelative ? ' · ' : ''}{submittedExact}
          </Typography>}
          {purgeSoon && <Typography variant="body2" sx={{ color: 'var(--text-warning)', fontWeight: 600 }}>
            Proposal deleted <time dateTime={item.purgeAt} title={formatDateTime(item.purgeAt) ?? undefined}>{formatRelative(item.purgeAt, now)}</time>
          </Typography>}
        </Stack>
        <ReferenceRow id={item.id} />
      </Stack>

      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, m: 0 }}>
        <ContextItem icon={PERSON_ICON} label="Submitted by" {...author} />
        {CAMPAIGN_SCOPED_ACTIONS.has(item.action) && <CampaignContext item={item} links={links} />}
        {profile && <ContextItem icon={item.profileAccount?.accountType === 'organization' ? ORGANIZATION_ICON : PERSON_ICON} label="Profile of" {...profile} />}
        <RecipientContext item={item} links={links} />
      </Box>

      {hiddenWarning && <Alert severity="warning" role="note">{hiddenWarning}</Alert>}

      <SubmissionView item={item} parsed={parsed} campaignReviewGoalGhs={campaignReviewGoalGhs} now={now} />

      <Disclosure showLabel="Show submitted text" hideLabel="Hide submitted text">
        <SubmittedRecord item={item} boundTo={guidance.boundTo} />
      </Disclosure>

      <ReviewDecision
        item={item}
        queue={queue}
        guidance={guidance}
        now={now}
        own={own}
        ownRecipient={ownRecipient}
        ownCampaign={ownCampaign}
        notes={notes}
        onNotesChange={onNotesChange}
        earlierVersionNotes={earlierVersionNotes}
        busy={busy}
        error={error}
        onDecide={onDecide}
        onRefresh={onRefresh}
        links={links}
      />
    </Stack>
  </Paper>
}
