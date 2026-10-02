import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { LoadingDots, SHAPE } from '@ubuntu-fund/ui'
import type { CampaignBeneficiaryDetails, ChangeBeneficiaryResult } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import {
  CONSENT_STATUS,
  RELATIONSHIP_LABELS,
  beneficiaryInput,
  changeConfirmation,
  consentExplanation,
  consentGateText,
  nextStepText,
  partyLabel,
  payoutArrangementText,
  payoutAuthorityText,
  validateBeneficiary,
  type BeneficiaryDraft,
  type BeneficiaryField,
} from '@/lib/onBehalf'
import { PublicationConsent } from '@/components/safety/PublicationConsent'
import { BENEFICIARY_SCREENING_NOTE } from '@/lib/campaignReview'
import { BeneficiaryFields } from './BeneficiaryFields'

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback)

/**
 * The beneficiary of a campaign run on someone's behalf, for its organizer and
 * the beneficiary themselves: consent, invitation, who receives the money, and
 * the actions each of them may take. The server re-checks every action.
 */
export function CampaignBeneficiaryPanel({ campaignId, details, loading, error, onRetry, onChanged, ownEmail, ownAccountLabel }: {
  campaignId: string
  details: CampaignBeneficiaryDetails | null
  loading: boolean
  error: string | null
  onRetry: () => void
  /** An action succeeded: reload the campaign and these details, and confirm it. */
  onChanged: (confirmation: string) => void
  ownEmail?: string
  ownAccountLabel: string
}) {
  const [busy, setBusy] = useState<'resend' | 'revoke' | null>(null)
  const [actionError, setActionError] = useState('')
  const [changeOpen, setChangeOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)

  if (!details) {
    if (error) return <Alert severity="warning" sx={{ mt: 4 }} action={<Button color="inherit" onClick={onRetry}>Retry</Button>}>{error}</Alert>
    return loading ? <Skeleton variant="rounded" height={180} sx={{ mt: 4, borderRadius: SHAPE.card }} aria-label="Loading beneficiary details" /> : null
  }

  const name = details.beneficiaryName
  const status = CONSENT_STATUS[details.consentStatus]
  const gate = consentGateText(details)
  // What makes it go live from here, as the server's rules say (never more).
  const next = nextStepText(details.nextStep, name)
  // Held while our team checks the campaign's content: written, not sent.
  const held = details.invitationStatus === 'held'
  const invitation = details.invitationEmailHint
    ? held
      ? `Not sent yet. It goes to ${details.invitationEmailHint} once our team has checked the campaign.`
      : [
          `Sent to ${details.invitationEmailHint}${details.invitationSentAt ? ` on ${formatDate(details.invitationSentAt)}` : ''}.`,
          details.invitationStatus === 'pending' && details.invitationExpiresAt ? `It expires on ${formatDate(details.invitationExpiresAt)}.` : '',
          details.invitationStatus === 'expired' ? 'It has expired.' : '',
        ].filter(Boolean).join(' ')
    : ''

  async function resend() {
    setBusy('resend')
    setActionError('')
    try {
      const result = await api.post<{ expiresAt: string }>(`/campaigns/${campaignId}/beneficiary/invitation`)
      onChanged(`Invitation sent again to ${name}.${result?.expiresAt ? ` It expires on ${formatDate(result.expiresAt)}.` : ''}`)
    } catch (err) {
      setActionError(message(err, 'Could not send the invitation. Please try again.'))
    } finally {
      setBusy(null)
    }
  }

  async function revoke() {
    setBusy('revoke')
    setActionError('')
    try {
      await api.post(`/campaigns/${campaignId}/beneficiary/consent/revoke`)
      setRevokeOpen(false)
      onChanged('You withdrew your consent. The campaign cannot collect or pay out money for you.')
    } catch (err) {
      setRevokeOpen(false)
      setActionError(message(err, 'Could not withdraw your consent. Please try again.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Box
      component="section"
      aria-labelledby="beneficiary-panel-heading"
      sx={{ mt: 4, p: { xs: 2.5, md: 3 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-inset)', minWidth: 0 }}
    >
      <Typography variant="overline" color="text.secondary">
        {details.viewer.beneficiary && !details.viewer.manager ? 'Run for you' : 'Run on someone’s behalf'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <Typography id="beneficiary-panel-heading" component="h2" variant="h6" sx={{ fontWeight: 800 }}>
          Beneficiary
        </Typography>
        <Chip size="small" label={status.label} color={status.tone} sx={{ fontWeight: 700 }} />
      </Box>
      <Typography variant="body2" color="text.secondary">{consentExplanation(details.consentStatus, name, details.invitationStatus, details.canChangeBeneficiary)}</Typography>
      {(gate || next) && (
        <Alert severity={details.consentStatus === 'declined' || details.consentStatus === 'revoked' ? 'warning' : 'info'} sx={{ mt: 2 }}>
          {[gate, next].filter(Boolean).join(' ')}
        </Alert>
      )}
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '150px minmax(0, 1fr)' },
          columnGap: 2,
          rowGap: { xs: 0.25, sm: 1.25 },
          mt: 2.5,
          mb: 0,
          '& dt': { color: 'text.secondary', fontSize: '0.82rem', fontWeight: 600, mt: { xs: 1, sm: 0 } },
          '& dd': { m: 0, fontSize: '0.9rem', overflowWrap: 'anywhere' },
        }}
      >
        <dt>For</dt>
        <dd>{name} · {partyLabel(details.beneficiaryType)} · {RELATIONSHIP_LABELS[details.relationship] ?? details.relationship}</dd>
        {details.organizerName && <><dt>Organized by</dt><dd>{details.organizerName}</dd></>}
        <dt>Why</dt>
        <Box component="dd" sx={{ whiteSpace: 'pre-line' }}>{details.reason}</Box>
        {invitation && <><dt>Invitation</dt><dd>{invitation}</dd></>}
        <dt>Money goes to</dt>
        <dd>
          {payoutArrangementText(details.payoutArrangement, name, details.organizerName)}
          {details.payoutArrangement === 'organization' && details.consentStatus !== 'accepted' ? ', only if they agree' : ''}
        </dd>
        <dt>Payouts</dt>
        <dd>{payoutAuthorityText(details)}</dd>
      </Box>
      {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
      {(details.canResendInvitation || details.canChangeBeneficiary || details.canRevokeConsent) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2.5 }}>
          {details.canResendInvitation && (
            <Button variant="outlined" disabled={busy !== null} onClick={() => void resend()}>
              {busy === 'resend' ? <><LoadingDots size={6} /> <span>Sending…</span></> : 'Send invitation again'}
            </Button>
          )}
          {details.canChangeBeneficiary && (
            <Button disabled={busy !== null} onClick={() => { setActionError(''); setChangeOpen(true) }}>
              Change beneficiary
            </Button>
          )}
          {details.canRevokeConsent && (
            <Button color="error" variant="outlined" disabled={busy !== null} onClick={() => { setActionError(''); setRevokeOpen(true) }}>
              Withdraw my consent
            </Button>
          )}
        </Box>
      )}

      {changeOpen && (
        <ChangeBeneficiaryDialog
          campaignId={campaignId}
          details={details}
          ownEmail={ownEmail}
          ownAccountLabel={ownAccountLabel}
          onClose={() => setChangeOpen(false)}
          onChanged={(confirmation) => { setChangeOpen(false); onChanged(confirmation) }}
        />
      )}

      <Dialog open={revokeOpen} onClose={() => busy === null && setRevokeOpen(false)} aria-labelledby="revoke-consent-title" maxWidth="xs" fullWidth>
        <DialogTitle id="revoke-consent-title">Withdraw your consent?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The campaign will no longer have your agreement. It cannot collect or pay out money for you, and it may be
            taken off the site. You cannot undo this yourself.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={busy !== null} onClick={() => setRevokeOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={busy !== null} onClick={() => void revoke()}>
            {busy === 'revoke' ? 'Withdrawing…' : 'Withdraw'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function ChangeBeneficiaryDialog({ campaignId, details, ownEmail, ownAccountLabel, onClose, onChanged }: {
  campaignId: string
  details: CampaignBeneficiaryDetails
  ownEmail?: string
  ownAccountLabel: string
  onClose: () => void
  onChanged: (confirmation: string) => void
}) {
  // The address on file is never returned, so a change always names the new one.
  const [value, setValue] = useState<BeneficiaryDraft>(() => ({
    beneficiaryType: details.beneficiaryType,
    beneficiaryName: details.beneficiaryName,
    beneficiaryEmail: '',
    relationship: details.relationship,
    reason: details.reason,
    payoutArrangement: details.payoutArrangement,
  }))
  const [touched, setTouched] = useState<Partial<Record<BeneficiaryField, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Optional, unticked by default: the new name and reason are public text,
  // checked like a new campaign's before anyone is invited.
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const errors = validateBeneficiary(value, ownEmail)
  const valid = Object.keys(errors).length === 0

  // While our team checks the campaign's content, the new invitation waits too:
  // also when that check is waiting for a beneficiary to be named again.
  const held = details.invitationStatus === 'held' || details.nextStep === 'name_beneficiary'

  async function save() {
    setTouched({ beneficiaryName: true, beneficiaryEmail: true, relationship: true, reason: true })
    if (!valid) return
    setSaving(true)
    setError('')
    try {
      const result = await api.put<ChangeBeneficiaryResult | null>(`/campaigns/${campaignId}/beneficiary`, {
        ...beneficiaryInput(value),
        ...(held ? {} : { automatedReviewConsent }),
      })
      const name = value.beneficiaryName.trim()
      onChanged(changeConfirmation(held ? { invitationHeld: true } : result, name))
    } catch (err) {
      setError(message(err, 'Could not change the beneficiary. Please try again.'))
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={() => !saving && onClose()} aria-labelledby="change-beneficiary-title" maxWidth="sm" fullWidth>
      <DialogTitle id="change-beneficiary-title">Change beneficiary</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2.5 }}>
          {held
            ? 'The invitation goes to the new beneficiary once our team has checked the campaign.'
            : 'The new name and reason are checked before anyone is invited: by automated screening if you allow it below, otherwise by our team, and then we send the invitation. The earlier invitation stops working, and a live campaign goes back to review.'}
        </DialogContentText>
        <BeneficiaryFields
          value={value}
          onChange={setValue}
          errors={errors}
          touched={touched}
          onBlur={(field) => setTouched((t) => ({ ...t, [field]: true }))}
          organizationLabel={ownAccountLabel}
          disabled={saving}
        />
        {!held && (
          <Box sx={{ mt: 2 }}>
            <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} note={BENEFICIARY_SCREENING_NOTE} />
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button disabled={saving} onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
