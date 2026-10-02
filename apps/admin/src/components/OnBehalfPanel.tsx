import TextField from '@/components/AdminTextField'
import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded'
import { EmptyState } from '@ubuntu-fund/ui'
import {
  Action,
  BENEFICIARY_RELATIONSHIPS,
  Resource,
  type BeneficiaryInvitationStatus,
  type BeneficiaryPartyType,
  type BeneficiaryRelationship,
  type Campaign,
  type CampaignBeneficiaryDetails,
  type OnBehalfConsentStatus,
  type OnBehalfPayoutArrangement,
} from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/apiError'
import { useAuth } from '@/context/AuthContext'
import { useAdminPermissions } from '@/context/AdminPermissionContext'
import { ARRANGEMENT_LABELS, RELATIONSHIP_LABELS, TYPE_LABELS } from '@/lib/onBehalfLabels'
import { insetSurface, raisedSurface } from '@/lib/surfaces'

/** `GET /admin/campaigns/:id/beneficiary/events`, oldest first. It never holds addresses. */
export interface BeneficiaryConsentEvent {
  event: string
  actorRole?: string
  actorId?: string
  payoutArrangement?: string
  reason?: string
  consentVersion?: string
  /** How a changed beneficiary's new details were admitted; absent on changes from before that was recorded. */
  admission?: string
  createdAt: string
}

type PayoutAuthority = CampaignBeneficiaryDetails['payoutAuthority']

interface Loaded {
  key: string
  details: CampaignBeneficiaryDetails | null
  detailsError: string
  events: BeneficiaryConsentEvent[]
  eventsError: string
}

const STAFF_REASON_MIN = 20
const STAFF_REASON_MAX = 2000

const CONSENT_LABELS: Record<OnBehalfConsentStatus, string> = {
  not_required: 'Not required',
  pending: 'Waiting for the beneficiary',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Invitation expired',
  revoked: 'Withdrawn by the beneficiary',
}
/** Text colour on the theme chip: the AA text tokens, which follow every skin and mode. */
const CONSENT_COLORS: Record<OnBehalfConsentStatus, string> = {
  not_required: 'text.secondary',
  pending: 'var(--text-warning)',
  accepted: 'var(--text-success)',
  declined: 'var(--text-error)',
  expired: 'var(--text-error)',
  revoked: 'var(--text-error)',
}
/** For the newest invitation, so `superseded` here means none replaced it: it was withdrawn. */
const INVITATION_LABELS: Record<BeneficiaryInvitationStatus, string> = {
  held: 'Not sent: waits for the content check',
  pending: 'Waiting for a response',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  revoked: 'Revoked',
  superseded: 'Withdrawn: no invitation is waiting',
}
const AUTHORITY_LABELS: Record<PayoutAuthority, string> = {
  beneficiary: 'The beneficiary',
  organization: 'The organizer',
  none: 'Nobody (payouts paused)',
}
const EVENT_LABELS: Record<string, string> = {
  invited: 'Invitation sent',
  resent: 'Invitation sent again',
  accepted: 'Beneficiary accepted',
  declined: 'Beneficiary declined',
  expired: 'Invitation expired',
  revoked: 'Beneficiary withdrew consent',
  beneficiary_changed: 'Organizer changed the beneficiary',
  reassigned: 'Staff reassigned the beneficiary',
  payout_authority_changed: 'Payout authority changed',
}
const ACTOR_LABELS: Record<string, string> = {
  organizer: 'Organizer',
  beneficiary: 'Beneficiary',
  admin: 'Staff',
  system: 'System',
  invitee: 'Invited person',
}
const PAYOUT_TARGET_LABELS: Record<string, string> = { beneficiary: 'Beneficiary', organization: 'Organizer', none: 'Nobody' }
const ADMISSION_LABELS: Record<string, string> = {
  screening: 'Cleared by automated screening',
  prior_approval: 'Cleared by an earlier approval of this version',
  staff_review: 'Checked by our team in the campaign review',
}

/** The raised panel with the glass skin's border and blur, like the user detail panels. */
const panelSurface = {
  ...raisedSurface,
  border: 'var(--neu-border)',
  backdropFilter: 'var(--neu-backdrop)',
  WebkitBackdropFilter: 'var(--neu-backdrop)',
}

const labelSx = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  color: 'text.secondary',
  letterSpacing: 1,
  fontFamily: '"Outfit", sans-serif',
} as const

function when(value?: string): string {
  return value ? new Date(value).toLocaleString() : '—'
}

function messageOf(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/** Server answers stay visible: 403 for a campaign the admin is part of, 409 when the state forbids the change. */
function ActionError({ error }: { error: unknown }) {
  if (!error) return null
  const status = error instanceof ApiError ? error.status : undefined
  return (
    <Alert severity="error">
      {status === 403 && <AlertTitle>Not allowed</AlertTitle>}
      {status === 409 && <AlertTitle>Not possible in the campaign’s current state</AlertTitle>}
      {messageOf(error, 'The change could not be saved. Please try again.')}
    </Alert>
  )
}

function StaffReasonField({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <TextField
      multiline
      minRows={3}
      label={`Staff reason (at least ${STAFF_REASON_MIN} characters)`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ maxLength: STAFF_REASON_MAX }}
      helperText={`${value.trim().length}/${STAFF_REASON_MAX} characters. Recorded in the consent history and the audit log.`}
    />
  )
}

function ReassignDialog({
  campaignId,
  details,
  onClose,
  onDone,
}: {
  campaignId: string
  details: CampaignBeneficiaryDetails
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [type, setType] = useState<BeneficiaryPartyType>(details.beneficiaryType)
  const [name, setName] = useState(details.beneficiaryName)
  const [email, setEmail] = useState('')
  const [relationship, setRelationship] = useState<BeneficiaryRelationship>(details.relationship)
  const [reason, setReason] = useState(details.reason)
  const [arrangement, setArrangement] = useState<OnBehalfPayoutArrangement>(details.payoutArrangement)
  const [staffReason, setStaffReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const nameValid = name.trim().length >= 2 && name.trim().length <= 120
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254
  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 1000
  const staffReasonValid = staffReason.trim().length >= STAFF_REASON_MIN && staffReason.trim().length <= STAFF_REASON_MAX
  const ready = !busy && nameValid && emailValid && reasonValid && staffReasonValid
  // The campaign's content check is still outstanding (with an invitation held
  // for it, or none since the declined content's was withdrawn): the new one waits too.
  const heldForCheck = details.invitationStatus === 'held' || details.nextStep === 'name_beneficiary'

  async function submit() {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<{ invitationHeld?: boolean } | null>(`/admin/campaigns/${campaignId}/beneficiary/reassign`, {
        beneficiaryType: type,
        beneficiaryName: name.trim(),
        beneficiaryEmail: email.trim(),
        relationship,
        reason: reason.trim(),
        payoutArrangement: arrangement,
        staffReason: staffReason.trim(),
      })
      onDone((result?.invitationHeld ?? heldForCheck)
        ? `Beneficiary reassigned to ${name.trim()}. Their invitation is sent once the content check is cleared; payouts stay paused until they accept.`
        : `Beneficiary reassigned to ${name.trim()}. They have been invited to accept; payouts stay paused until they do.`)
    } catch (cause) {
      setError(cause)
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={() => { if (!busy) onClose() }} maxWidth="sm" fullWidth aria-labelledby="reassign-beneficiary-title">
      <DialogTitle id="reassign-beneficiary-title">Reassign beneficiary</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">
            This replaces the beneficiary. Their consent and any payout authority are cleared, so nobody can request a
            payout until the new beneficiary accepts. {heldForCheck
              ? 'The new beneficiary’s invitation waits for the campaign’s content check, and the organizer is notified.'
              : 'The new beneficiary is emailed an invitation, and the organizer and any previously linked beneficiary are notified.'}
          </Alert>
          <TextField optionContext="beneficiary" select label="Beneficiary type" value={type} disabled={busy} onChange={(e) => setType(e.target.value as BeneficiaryPartyType)}>
            <MenuItem value="individual">Person</MenuItem>
            <MenuItem value="organization">Organization</MenuItem>
          </TextField>
          <TextField
            label="Beneficiary name"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            error={!!name && !nameValid}
            inputProps={{ maxLength: 120 }}
            helperText="Shown publicly on the campaign. 2 to 120 characters."
          />
          <TextField
            type="email"
            label="Beneficiary email"
            placeholder="name@example.com"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            error={!!email && !emailValid}
            inputProps={{ maxLength: 254 }}
            helperText="The invitation is sent here. It is never shown publicly."
          />
          <TextField optionContext="beneficiary" select label="Relationship to the organizer" value={relationship} disabled={busy} onChange={(e) => setRelationship(e.target.value as BeneficiaryRelationship)}>
            {BENEFICIARY_RELATIONSHIPS.map((value) => (
              <MenuItem key={value} value={value}>{RELATIONSHIP_LABELS[value]}</MenuItem>
            ))}
          </TextField>
          <TextField
            multiline
            minRows={2}
            label="Why the organizer is raising funds for them"
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            error={!!reason && !reasonValid}
            inputProps={{ maxLength: 1000 }}
            helperText="10 to 1000 characters. The beneficiary reads this in the invitation."
          />
          <TextField optionContext="payout" select label="Who receives the money" value={arrangement} disabled={busy} onChange={(e) => setArrangement(e.target.value as OnBehalfPayoutArrangement)}>
            <MenuItem value="beneficiary">Beneficiary</MenuItem>
            <MenuItem value="organization">Organizer</MenuItem>
          </TextField>
          <StaffReasonField value={staffReason} disabled={busy} onChange={setStaffReason} />
          <ActionError error={error} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" disabled={!ready} onClick={() => void submit()}>
          {busy ? 'Reassigning…' : 'Reassign and invite'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function PayoutAuthorityDialog({
  campaignId,
  details,
  onClose,
  onDone,
}: {
  campaignId: string
  details: CampaignBeneficiaryDetails
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [target, setTarget] = useState<PayoutAuthority>(details.payoutAuthority)
  const [staffReason, setStaffReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const accepted = details.consentStatus === 'accepted'
  // Mirrors the API: authority needs accepted consent, and the beneficiary a linked account.
  const available: Record<PayoutAuthority, boolean> = { beneficiary: accepted && details.linked, organization: accepted, none: true }
  const staffReasonValid = staffReason.trim().length >= STAFF_REASON_MIN && staffReason.trim().length <= STAFF_REASON_MAX
  const ready = !busy && target !== details.payoutAuthority && available[target] && staffReasonValid

  async function submit() {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await api.put(`/admin/campaigns/${campaignId}/payout-authority`, { target, staffReason: staffReason.trim() })
      onDone(`Payout authority changed. Who can request payouts now: ${AUTHORITY_LABELS[target].toLowerCase()}.`)
    } catch (cause) {
      setError(cause)
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={() => { if (!busy) onClose() }} maxWidth="sm" fullWidth aria-labelledby="payout-authority-title">
      <DialogTitle id="payout-authority-title">Change payout authority</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="warning">
            This decides who can request this campaign’s money. The organizer and the beneficiary are notified. Choose
            Nobody to pause payouts until staff decide again.
          </Alert>
          <Typography variant="body2">
            Currently: <strong>{AUTHORITY_LABELS[details.payoutAuthority]}</strong>
          </Typography>
          <TextField
            optionContext="payout-authority"
            select
            label="Who can request payouts"
            value={target}
            disabled={busy}
            onChange={(e) => setTarget(e.target.value as PayoutAuthority)}
            helperText={
              !accepted
                ? 'Beneficiary and Organizer become available once the beneficiary accepts.'
                : !details.linked
                  ? 'Beneficiary needs a linked beneficiary account.'
                  : target === details.payoutAuthority
                    ? 'Choose a different option to change it.'
                    : undefined
            }
          >
            <MenuItem value="beneficiary" disabled={!available.beneficiary}>Beneficiary</MenuItem>
            <MenuItem value="organization" disabled={!available.organization}>Organizer</MenuItem>
            <MenuItem value="none">Nobody</MenuItem>
          </TextField>
          <StaffReasonField value={staffReason} disabled={busy} onChange={setStaffReason} />
          <ActionError error={error} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!ready} onClick={() => void submit()}>
          {busy ? 'Saving…' : 'Change payout authority'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0, ...insetSurface, p: 2 }}>
      <Typography component="dt" sx={{ fontSize: '.72rem', color: 'text.secondary', mb: 0.75 }}>{label}</Typography>
      <Typography component="dd" sx={{ m: 0, fontSize: '.95rem', fontWeight: 600, color: 'text.primary', overflowWrap: 'anywhere' }}>{children}</Typography>
    </Box>
  )
}

/**
 * Staff view of a campaign run on someone else's behalf: who it is for, the
 * consent and invitation state, who may request payouts, and the consent
 * history. Reassigning and payout-authority overrides need a written reason;
 * the API refuses staff who created or benefit from the campaign.
 */
export default function OnBehalfPanel({ campaign, onChanged }: { campaign: Campaign; onChanged: (message: string) => void }) {
  const { user } = useAuth()
  const { can } = useAdminPermissions()
  const [retry, setRetry] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [dialog, setDialog] = useState<'reassign' | 'authority' | null>(null)
  // A result belongs to one campaign and attempt; anything else still loading.
  const requestKey = `${campaign.id}:${retry}`

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      api.get<CampaignBeneficiaryDetails>(`/campaigns/${campaign.id}/beneficiary`),
      api.get<BeneficiaryConsentEvent[]>(`/admin/campaigns/${campaign.id}/beneficiary/events`),
    ]).then(([loadedDetails, loadedEvents]) => {
      if (cancelled) return
      setLoaded({
        key: requestKey,
        details: loadedDetails.status === 'fulfilled' ? loadedDetails.value : null,
        detailsError: loadedDetails.status === 'rejected' ? messageOf(loadedDetails.reason, 'Try again to load who this campaign is for.') : '',
        events: loadedEvents.status === 'fulfilled' && Array.isArray(loadedEvents.value) ? loadedEvents.value : [],
        eventsError: loadedEvents.status === 'rejected' ? messageOf(loadedEvents.reason, 'The consent history could not load.') : '',
      })
    })
    return () => {
      cancelled = true
    }
  }, [campaign.id, requestKey])

  if (!loaded || loaded.key !== requestKey)
    return (
      <Box role="status" aria-label="Loading beneficiary details" sx={{ ...panelSurface, p: 3, mt: 3 }}>
        <Skeleton width={120} height={20} />
        <Skeleton width="40%" height={32} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, mt: 2 }}>
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={64} />)}
        </Box>
      </Box>
    )

  const { details, detailsError, events, eventsError } = loaded
  if (!details)
    return (
      <Box sx={{ ...panelSurface, p: 3, mt: 3 }}>
        <EmptyState
          variant="error"
          title="Beneficiary details couldn’t load"
          description={detailsError}
          compact
          action={<Button onClick={() => setRetry((value) => value + 1)}>Retry beneficiary details</Button>}
        />
      </Box>
    )

  const canAct = can(Resource.CAMPAIGNS, Action.UPDATE)
  const selfInvolved = user?.id === campaign.creatorId || details.viewer.beneficiary
  const finish = (message: string) => {
    setDialog(null)
    onChanged(message)
  }

  return (
    <Box
      component="section"
      aria-label={`On behalf of ${details.beneficiaryName}`}
      sx={{ ...panelSurface, p: { xs: 2.5, sm: 3 }, mt: 3, position: 'relative', overflow: 'hidden', overflowWrap: 'anywhere' }}
    >
      <Box aria-hidden sx={{ position: 'absolute', right: -18, bottom: -22, opacity: 0.05, pointerEvents: 'none', '& svg': { fontSize: 150 } }}>
        <HandshakeRoundedIcon />
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap gap={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ position: 'relative' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={labelSx}>On behalf of</Typography>
          <Typography component="h2" variant="h6" fontWeight={800}>{details.beneficiaryName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {TYPE_LABELS[details.beneficiaryType] ?? details.beneficiaryType} · {RELATIONSHIP_LABELS[details.relationship] ?? details.relationship}
          </Typography>
        </Box>
        <Chip label={CONSENT_LABELS[details.consentStatus] ?? details.consentStatus} sx={{ color: CONSENT_COLORS[details.consentStatus] ?? 'text.secondary', maxWidth: '100%' }} />
      </Stack>

      <Typography variant="subtitle2" sx={{ mt: 2 }}>Why the organizer is raising funds for them</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>{details.reason}</Typography>

      <Button
        component={RouterLink}
        to={`/users/${campaign.creatorId}`}
        fullWidth
        startIcon={<PersonOutlineRoundedIcon />}
        endIcon={<ArrowForwardRoundedIcon />}
        sx={{ ...insetSurface, justifyContent: 'flex-start', gap: 1, p: 2, mt: 2.5, textAlign: 'left', textTransform: 'none', '& .MuiButton-endIcon': { ml: 'auto', flexShrink: 0 } }}
      >
        <Box component="span" sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: '.72rem', color: 'text.secondary', mb: 0.5 }}>Organizer (created the campaign)</Typography>
          <Typography component="span" sx={{ display: 'block', fontSize: '.9rem', fontWeight: 700 }}>{details.organizerName || 'View organizer profile'}</Typography>
        </Box>
      </Button>

      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2, m: 0, mt: 2.5 }}>
        <Fact label="Consent">{CONSENT_LABELS[details.consentStatus] ?? details.consentStatus}{details.consentAt ? ` · ${when(details.consentAt)}` : ''}</Fact>
        <Fact label="Beneficiary account">{details.linked ? 'Linked to an Ujimora account' : 'Not linked yet'}</Fact>
        <Fact label="Invitation">{details.invitationStatus ? INVITATION_LABELS[details.invitationStatus] ?? details.invitationStatus : 'No invitation on file'}</Fact>
        <Fact label={details.invitationStatus === 'held' ? 'Invitation to' : 'Invitation sent to'}>{details.invitationEmailHint || '—'}</Fact>
        <Fact label="Invitation sent">{when(details.invitationSentAt)}</Fact>
        <Fact label="Invitation expires">{when(details.invitationExpiresAt)}</Fact>
        <Fact label="Payout arrangement">{ARRANGEMENT_LABELS[details.payoutArrangement] ?? details.payoutArrangement}</Fact>
        <Fact label="Can request payouts">{AUTHORITY_LABELS[details.payoutAuthority] ?? details.payoutAuthority}</Fact>
        <Fact label="Publication waits for consent">{details.publicationRequiresConsent ? 'Yes' : 'No'}</Fact>
        <Fact label="Donations wait for consent">{details.donationsRequireConsent ? 'Yes' : 'No'}</Fact>
      </Box>

      <Stack spacing={1.5} sx={{ mt: 3 }}>
        {canAct && selfInvolved && (
          <Alert severity="info">
            You created or benefit from this campaign. Another administrator must reassign its beneficiary or change its
            payout authority.
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap flexWrap="wrap" gap={1}>
          {canAct && (
            <>
              <Button variant="outlined" color="warning" disabled={selfInvolved} onClick={() => setDialog('reassign')} sx={{ color: 'var(--text-warning)' }}>
                Reassign beneficiary
              </Button>
              <Button variant="outlined" disabled={selfInvolved} onClick={() => setDialog('authority')}>
                Change payout authority
              </Button>
            </>
          )}
          <Button component={RouterLink} to={`/audit?search=${encodeURIComponent(campaign.id)}`} startIcon={<HistoryEduRoundedIcon />}>
            Audit log for this campaign
          </Button>
        </Stack>
        {!canAct && (
          <Typography variant="body2" color="text.secondary">Your role can view this beneficiary but not change it.</Typography>
        )}
      </Stack>

      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, mt: 3, mb: 1.5 }}>Consent history</Typography>
      {eventsError ? (
        <Alert severity="error" action={<Button onClick={() => setRetry((value) => value + 1)}>Retry</Button>}>{eventsError}</Alert>
      ) : events.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No consent events are recorded yet.</Typography>
      ) : (
        <Box component="ol" aria-label="Consent history" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {events.map((item, index) => (
            <Box
              component="li"
              key={`${item.createdAt}:${index}`}
              sx={{
                position: 'relative',
                pl: 3.5,
                pb: 2,
                '&::before': { content: '""', position: 'absolute', left: 7, top: 8, bottom: 0, borderLeft: '2px solid', borderColor: 'divider' },
                '&:last-child::before': { display: 'none' },
              }}
            >
              <Box aria-hidden sx={{ position: 'absolute', left: 2, top: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: 'primary.main' }} />
              <Typography sx={{ fontWeight: 700 }}>{EVENT_LABELS[item.event] ?? item.event.replaceAll('_', ' ')}</Typography>
              <Typography variant="caption" color="text.secondary" component="p">
                {when(item.createdAt)} · {ACTOR_LABELS[item.actorRole ?? ''] ?? 'Unknown actor'}
                {item.actorId && item.actorRole !== 'system' && (
                  <>
                    {' '}
                    <Link component={RouterLink} to={`/users/${item.actorId}`}>account {item.actorId}</Link>
                  </>
                )}
              </Typography>
              {item.payoutArrangement && (
                <Typography variant="body2">Payout: {PAYOUT_TARGET_LABELS[item.payoutArrangement] ?? item.payoutArrangement}</Typography>
              )}
              {item.reason && <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>Reason: {item.reason}</Typography>}
              {item.event === 'beneficiary_changed' && (
                <Typography variant="body2">New details: {item.admission ? ADMISSION_LABELS[item.admission] ?? item.admission : 'Not checked (changed before changes were checked); approve only after reading them'}</Typography>
              )}
              {item.consentVersion && (
                <Typography variant="caption" color="text.secondary" component="p">Consent wording {item.consentVersion}</Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {dialog === 'reassign' && (
        <ReassignDialog campaignId={campaign.id} details={details} onClose={() => setDialog(null)} onDone={finish} />
      )}
      {dialog === 'authority' && (
        <PayoutAuthorityDialog campaignId={campaign.id} details={details} onClose={() => setDialog(null)} onDone={finish} />
      )}
    </Box>
  )
}
