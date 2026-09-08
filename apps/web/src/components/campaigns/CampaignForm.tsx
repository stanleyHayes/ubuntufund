import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import EmergencyRoundedIcon from '@mui/icons-material/EmergencyRounded'
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded'
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded'
import ChurchRoundedIcon from '@mui/icons-material/ChurchRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import { BrandedDatePicker } from '@ubuntu-fund/ui'
import { Fragment, useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { Link as RouterLink } from 'react-router-dom'
import { CampaignCategory, CampaignPriority, CampaignStatus, CollaboratorRole } from '@ubuntu-fund/types'
import { formatCurrency, ImageUpload, SHAPE, LoadingDots } from '@ubuntu-fund/ui'
import { useCreateCampaign } from '@/hooks/useCampaigns'
import Alert from '@mui/material/Alert'
import { api } from '@/lib/api'
import { uploadImageViaApi } from '@/lib/uploadImage'
import { useCampaignCreationOptions } from '@/hooks/useCampaignCreationOptions'
import { CampaignCreationExtras, type SplitRow } from './CampaignCreationExtras'
import { ShareCampaignButton } from './ShareCampaignButton'
import { CampaignSplitSetup } from './CampaignSplitSetup'

// ---------------------------------------------------------------------------
// Sage & Neutrals palette — brand hexes only (see design system)
// ---------------------------------------------------------------------------
const FOREST = '#2E3D2F'
const FOREST_DARK = '#1C261D'
const SAGE = '#A8B5A0'
const INK = 'text.primary'
const INK_SECONDARY = 'text.secondary'
const GOLD = '#C7A24A'
const GOLD_DARK = 'var(--text-warning)'
const CLAY = 'var(--text-error)'
const DIVIDER = '#DAD7CD'

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const CATEGORY_ICONS = { medical: LocalHospitalRoundedIcon, education: SchoolRoundedIcon, emergency: EmergencyRoundedIcon, business: BusinessCenterRoundedIcon, community: Diversity3RoundedIcon, religious: ChurchRoundedIcon, creative: PaletteRoundedIcon }

const CATEGORIES = Object.values(CampaignCategory).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
}))

const PRIORITIES: { value: CampaignPriority; label: string; blurb: string; tone: string; tint: string }[] = [
  { value: CampaignPriority.NORMAL, label: 'Normal', blurb: 'A steady campaign with standard listing.', tone: FOREST, tint: 'rgba(46, 61, 47, 0.07)' },
  { value: CampaignPriority.URGENT, label: 'Urgent', blurb: 'A time-sensitive need with a near-term deadline.', tone: GOLD_DARK, tint: 'rgba(199, 162, 74, 0.12)' },
  { value: CampaignPriority.CRITICAL, label: 'Critical', blurb: 'An immediate, critical need requiring urgent attention.', tone: CLAY, tint: 'rgba(165, 67, 47, 0.10)' },
]

const STEPS = [
  { key: 'basics', label: 'Basics', hint: 'Title & category', heading: 'The essentials', sub: 'What is this campaign, and where does it belong?' },
  { key: 'story', label: 'Story', hint: 'Details & media', heading: 'Your story', sub: 'Explain the need and who it helps.' },
  { key: 'goal', label: 'Goal & timeline', hint: 'Target & dates', heading: 'Goal & timeline', sub: 'How much, by when, and how urgent.' },
  { key: 'review', label: 'Review', hint: 'Confirm & publish', heading: 'Review & publish', sub: 'Check everything, then send it for review.' },
] as const

// Fields validated on each step (priority always has a value)
const STEP_FIELDS: Record<number, (keyof FormErrors)[]> = {
  0: ['title', 'summary', 'category'],
  1: ['description', 'beneficiaries', 'coverImageUrl'],
  2: ['goalAmount', 'endDate'],
  3: [],
}

interface FormData {
  title: string
  summary: string
  category: CampaignCategory | ''
  description: string
  beneficiaries: string
  coverImageUrl: string
  goalAmount: string
  currency: string
  endDate: string
  priority: CampaignPriority
}

interface FormErrors {
  title?: string
  summary?: string
  category?: string
  description?: string
  beneficiaries?: string
  coverImageUrl?: string
  goalAmount?: string
  endDate?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseBeneficiaries(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function validate(data: FormData): FormErrors {
  const e: FormErrors = {}

  if (!data.title.trim()) e.title = 'Give your campaign a title'
  else if (data.title.trim().length < 5) e.title = 'Use at least 5 characters'

  if (!data.summary.trim()) e.summary = 'Add a one-line summary'
  else if (data.summary.trim().length < 10) e.summary = 'A little more detail — 10+ characters'
  else if (data.summary.length > 140) e.summary = 'Keep it under 140 characters'

  if (!data.category) e.category = 'Pick a category'

  if (!data.description.trim()) e.description = 'Tell your story'
  else if (data.description.trim().length < 20) e.description = 'At least 20 characters'

  if (parseBeneficiaries(data.beneficiaries).length === 0) e.beneficiaries = 'Name at least one beneficiary'

  if (!data.goalAmount) e.goalAmount = 'Set a goal amount'
  else if (!Number.isFinite(Number(data.goalAmount))) e.goalAmount = 'Enter a number'
  else if (Number(data.goalAmount) <= 0) e.goalAmount = 'Goal must be greater than zero'

  if (!data.endDate) e.endDate = 'Choose an end date'
  else if (new Date(data.endDate) <= new Date()) e.endDate = 'Pick a future date'

  return e
}

const todayIso = new Date().toISOString().split('T')[0]

// ---------------------------------------------------------------------------
// Small presentational atoms
// ---------------------------------------------------------------------------
function Eyebrow({ children, color = GOLD_DARK }: { children: ReactNode; color?: string }) {
  return (
    <Typography
      component="span"
      sx={{
        display: 'block',
        fontSize: '0.66rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
        color,
        lineHeight: 1.4,
      }}
    >
      {children}
    </Typography>
  )
}

/** Rotated-square bullet — a signature brand device. */
function DiamondBullet({ color = GOLD, size = 7 }: { color?: string; size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{ width: size, height: size, flex: '0 0 auto', bgcolor: color, transform: 'rotate(45deg)' }}
    />
  )
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: SHAPE.sm,
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: GOLD, borderWidth: '1.5px' },
  },
  '& label.Mui-focused': { color: GOLD_DARK },
} as const

// ---------------------------------------------------------------------------
// Brand stepper — custom horizontal progress (not the default MUI stepper)
// ---------------------------------------------------------------------------
function WizardStepper({ current }: { current: number }) {
  return (
    <Box sx={{ mb: { xs: 3, sm: 4 } }}>
      {/* Compact label — mobile only */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 1.75 }}>
        <Eyebrow>
          Step {current + 1} of {STEPS.length}
        </Eyebrow>
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: INK, mt: 0.25 }}>{STEPS[current].label}</Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        {STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <Fragment key={s.key}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', px: { xs: 0, sm: 0.5 } }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: SHAPE.sm,
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    border: '1.5px solid',
                    borderColor: active ? GOLD : done ? FOREST : DIVIDER,
                    bgcolor: active ? GOLD : done ? FOREST : 'transparent',
                    color: active ? FOREST_DARK : done ? '#F5F2EA' : INK_SECONDARY,
                    boxShadow: active ? `0 0 0 4px rgba(199, 162, 74, 0.18)` : 'none',
                    transition: 'background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}
                >
                  {done ? <CheckRoundedIcon sx={{ fontSize: 20 }} /> : i + 1}
                </Box>
                <Typography
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    mt: 1,
                    fontSize: '0.72rem',
                    fontWeight: active ? 700 : 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: active ? GOLD_DARK : done ? 'primary.main' : INK_SECONDARY,
                    textAlign: 'center',
                    maxWidth: 92,
                    lineHeight: 1.3,
                  }}
                >
                  {s.label}
                </Typography>
                <Typography
                  sx={{
                    display: { xs: 'none', md: 'block' },
                    mt: 0.25,
                    fontSize: '0.68rem',
                    color: INK_SECONDARY,
                    opacity: 0.75,
                    textAlign: 'center',
                    maxWidth: 100,
                    lineHeight: 1.3,
                  }}
                >
                  {s.hint}
                </Typography>
              </Box>
              {i < STEPS.length - 1 && (
                <Box
                  sx={{
                    flex: 1,
                    height: 2,
                    mt: '17px',
                    mx: { xs: 0.75, sm: 1 },
                    borderRadius: SHAPE.bar,
                    bgcolor: i < current ? GOLD : DIVIDER,
                    transition: 'background-color 220ms ease',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}
                />
              )}
            </Fragment>
          )
        })}
      </Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Review helpers
// ---------------------------------------------------------------------------
function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <Box sx={{ py: 2, borderTop: `1px solid ${DIVIDER}`, '&:first-of-type': { borderTop: 'none', pt: 0 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
        <Eyebrow>{title}</Eyebrow>
        <Button
          type="button"
          onClick={onEdit}
          startIcon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
          sx={{ color: 'primary.main', minHeight: 0, py: 0.25, px: 1, fontSize: '0.8rem' }}
        >
          Edit
        </Button>
      </Box>
      <Box sx={{ display: 'grid', gap: 1 }}>{children}</Box>
    </Box>
  )
}

function ReviewItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '148px 1fr' }, gap: { xs: 0.25, sm: 2 }, alignItems: 'start' }}>
      <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY, fontWeight: 600 }}>{label}</Typography>
      <Box sx={{ fontSize: '0.9rem', color: INK, lineHeight: 1.55 }}>{children}</Box>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// CampaignForm — a self-contained stepwise creation wizard
// ---------------------------------------------------------------------------
export function CampaignForm() {
  const { options, error: optionsError, retry } = useCampaignCreationOptions()
  const [invitations, setInvitations] = useState('')
  const [split, setSplit] = useState(false)
  const [rows, setRows] = useState<SplitRow[]>([{ name: '', email: '', percent: '50' }, { name: '', email: '', percent: '50' }])
  const [setupErrors, setSetupErrors] = useState<string[]>([])
  const [pendingSetup, setPendingSetup] = useState<{ path: string; payload: unknown; label: string }[]>([])
  const [setupBusy, setSetupBusy] = useState(false)
  const [createdStatus, setCreatedStatus] = useState<CampaignStatus | null>(null)
  const inviteEmails = [...new Set(invitations.split(/[\s,;]+/).map(email => email.trim().toLowerCase()).filter(Boolean))]
  const extrasError = inviteEmails.length && !options?.plan.campaignCollaboration ? 'Your plan does not include invitations.'
    : inviteEmails.some(email => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ? 'Enter valid collaborator email addresses.'
    : options && options.plan.maxCollaboratorsPerCampaign >= 0 && inviteEmails.length > options.plan.maxCollaboratorsPerCampaign ? `Your plan allows ${options.plan.maxCollaboratorsPerCampaign} collaborators.`
    : split && (!options?.canSplit || rows.some(row => !row.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email) || !Number.isFinite(Number(row.percent)) || Number(row.percent) <= 0 || !/^\d+(\.\d{1,2})?$/.test(row.percent)) || rows.reduce((sum, row) => sum + Math.round(Number(row.percent) * 100), 0) !== 10000) ? 'Check split eligibility, names, emails, and shares totalling 100% (up to two decimals).' : ''
  const [formData, setFormData] = useState<FormData>({
    title: '',
    summary: '',
    category: '',
    description: '',
    beneficiaries: '',
    coverImageUrl: '',
    goalAmount: '',
    currency: 'GHS',
    endDate: '',
    priority: CampaignPriority.NORMAL,
  })
  const [touched, setTouched] = useState<Partial<Record<keyof FormErrors, boolean>>>({})
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const { createCampaign, isSubmitting, error: submitError } = useCreateCampaign()
  // Capture "now" once at mount — keeps the render body pure (react-hooks/purity).
  const [nowMs] = useState(() => Date.now())

  const errors = useMemo(() => {
    const result = validate(formData)
    if (options?.maxGoal != null && Number(formData.goalAmount) > options.maxGoal) result.goalAmount = `Your current limit is ${formatCurrency(options.maxGoal)}. Reduce the goal or change your plan.`
    if (formData.coverImageUrl && options?.plan.maxMediaPerCampaign === 0) result.coverImageUrl = 'Your plan does not include campaign images.'
    return result
  }, [formData, options])
  const isStepValid = STEP_FIELDS[step].every((f) => !errors[f])

  const errFor = (f: keyof FormErrors) => Boolean(touched[f] && errors[f])
  const helperFor = (f: keyof FormErrors, fallback?: ReactNode): ReactNode => (touched[f] && errors[f] ? errors[f] : fallback)
  const blur = (f: keyof FormErrors) => () => setTouched((t) => ({ ...t, [f]: true }))

  function change(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  function selectCategory(value: CampaignCategory) {
    setFormData((prev) => ({ ...prev, category: value }))
    setTouched((t) => ({ ...t, category: true }))
  }

  function handleNext(event: React.MouseEvent<HTMLButtonElement>) {
    // The same button becomes a submit button on the final step. Cancel this
    // click default before React updates its type, so Continue never publishes.
    event.preventDefault()
    if (!isStepValid) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function retrySetup() {
    setSetupBusy(true)
    const failed: typeof pendingSetup = []
    const messages: string[] = []
    for (const action of pendingSetup) {
      try { await api.post(action.path, action.payload) }
      catch (error) { failed.push(action); messages.push(`${action.label}: ${error instanceof Error ? error.message : 'failed'}`) }
    }
    setPendingSetup(failed); setSetupErrors(messages); setSetupBusy(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (step !== STEPS.length - 1) return
    if (!options?.canCreate || extrasError || setupBusy) return
    const all = errors
    if (Object.keys(all).length > 0) {
      setTouched({ title: true, summary: true, category: true, description: true, beneficiaries: true, coverImageUrl: true, goalAmount: true, endDate: true })
      // Jump back to the first step that still has an error.
      const firstBad = Object.keys(STEP_FIELDS).find((k) => STEP_FIELDS[Number(k)].some((f) => all[f]))
      if (firstBad !== undefined) setStep(Number(firstBad))
      return
    }

    const cover = formData.coverImageUrl.trim()
    try {
      const created = await createCampaign({
        title: formData.title.trim(),
        summary: formData.summary.trim(),
        category: formData.category as CampaignCategory,
        description: formData.description.trim(),
        beneficiaries: parseBeneficiaries(formData.beneficiaries),
        imageUrls: cover ? [cover] : [],
        goalAmount: Number(formData.goalAmount),
        currency: 'GHS',
        // The date input yields a date-only value ("YYYY-MM-DD"); the API expects
        // a full ISO datetime (z.string().datetime()), so widen it before sending.
        endDate: new Date(`${formData.endDate}T00:00:00.000Z`).toISOString(),
        priority: formData.priority,
      })
      if (!created?.id) throw new Error('Campaign creation did not return an ID')
      setCreatedId(created.id)
      setCreatedStatus(created.status)
      setSetupBusy(true)
      const failures: string[] = []
      const pending: typeof pendingSetup = []
      for (const email of inviteEmails) {
        try { await api.post(`/campaigns/${created.id}/collaborators/invite`, { userEmail: email, role: CollaboratorRole.EDITOR, revenueSharePercent: 0 }) }
        catch (error) { pending.push({ path: `/campaigns/${created.id}/collaborators/invite`, payload: { userEmail: email, role: CollaboratorRole.EDITOR, revenueSharePercent: 0 }, label: `Invitation to ${email}` }); failures.push(`Invitation to ${email}: ${error instanceof Error ? error.message : 'failed'}`) }
      }
      if (split) {
        try { await api.post(`/campaigns/${created.id}/split`, { allocations: rows.map(row => ({ name: row.name.trim(), email: row.email.trim(), shareBps: Math.round(Number(row.percent) * 100) })) }) }
        catch (error) { pending.push({ path: `/campaigns/${created.id}/split`, payload: { allocations: rows.map(row => ({ name: row.name.trim(), email: row.email.trim(), shareBps: Math.round(Number(row.percent) * 100) })) }, label: 'Split draft' }); failures.push(`Split draft: ${error instanceof Error ? error.message : 'could not be saved'}`) }
      }
      setPendingSetup(pending)
      setSetupErrors(failures)
      setSetupBusy(false)
      setSubmitted(true)
    } catch {
      // Error surfaced via `submitError`; stay on the review step so the user
      // can retry without losing anything they entered.
    }
  }

  const beneficiaryList = parseBeneficiaries(formData.beneficiaries)
  const goalNumber = Number(formData.goalAmount)
  const durationDays = formData.endDate
    ? Math.max(0, Math.ceil((new Date(formData.endDate).getTime() - nowMs) / 86_400_000))
    : 0
  // -------------------------------------------------------------------------
  // Success state — preserves the current mock message
  // -------------------------------------------------------------------------
  if (submitted) {
    return (
      <Box sx={{ textAlign: 'center', py: { xs: 2, sm: 4 } }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            mx: 'auto',
            mb: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: SHAPE.card,
            bgcolor: GOLD,
            color: FOREST_DARK,
            boxShadow: `0 0 0 6px rgba(199, 162, 74, 0.16)`,
          }}
        >
          <CheckRoundedIcon sx={{ fontSize: 34 }} />
        </Box>
        <Eyebrow>Campaign submitted</Eyebrow>
        <Typography sx={{ mt: 1, fontWeight: 800, fontSize: '1.5rem', color: INK }}>
          {formData.title || 'Your campaign'} is on its way
        </Typography>
        <Typography sx={{ mt: 1.5, color: INK_SECONDARY, maxWidth: 440, mx: 'auto', lineHeight: 1.6 }}>
          {createdStatus === CampaignStatus.ACTIVE ? 'Your campaign is live. Share it with your community.' : 'Your campaign is awaiting review. You can share it once it is live.'}
        </Typography>
        {setupErrors.map(message => <Alert severity="warning" key={message} sx={{ mt: 2, textAlign: 'left' }}>Campaign created, but {message}. Retry the unfinished setup below; do not recreate the campaign.</Alert>)}
        {!!pendingSetup.length && <Button sx={{ mt: 2 }} disabled={setupBusy} onClick={retrySetup}>{setupBusy ? 'Retrying…' : 'Retry unfinished setup'}</Button>}
        {split && !setupErrors.some(message => message.startsWith('Split draft')) && <Alert severity="info" sx={{ mt: 2 }}>Split saved as a draft. Beneficiary consent and activation are still required.</Alert>}
        {createdId && split && !setupErrors.some(message => message.startsWith('Split draft')) && <CampaignSplitSetup campaignId={createdId} />}
        {createdId && createdStatus === CampaignStatus.ACTIVE && <Box sx={{ mt: 2 }}><ShareCampaignButton campaignId={createdId} title={formData.title} url={`${window.location.origin}/campaigns/${createdId}`} /></Box>}
        <Box sx={{ mt: 3.5, display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            component={RouterLink}
            to={createdId ? `/campaigns/${createdId}` : '/my-campaigns'}
            variant="contained"
            color="secondary"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            {createdId ? 'View campaign' : 'Go to my campaigns'}
          </Button>
          <Button component={RouterLink} to="/explore" sx={{ color: 'primary.main' }}>
            Explore campaigns
          </Button>
        </Box>
      </Box>
    )
  }

  const meta = STEPS[step]

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {!options && !optionsError && <Alert severity="info" sx={{ mb: 2 }}>Checking your campaign limits…</Alert>}
      {optionsError && <Alert severity="error" action={<Button onClick={retry}>Retry</Button>} sx={{ mb: 2 }}>{optionsError}</Alert>}
      {options && <Alert severity={options.canCreate ? 'info' : 'warning'} sx={{ mb: 2 }}>
        <Typography variant="body2">{options.plan.name}: {options.maxGoal === null ? 'No goal limit' : `Goals up to ${formatCurrency(options.maxGoal)}`} · {options.activeCount} active/pending campaigns.</Typography>
        {!options.canCreate && <Typography variant="body2" sx={{ mt: 0.5 }}>
          {options.creationBlockReason === 'verification_required'
            ? 'Complete account verification before creating your first campaign. You have not reached your plan’s campaign limit.'
            : options.creationBlockReason === 'verification_limit'
              ? `Your current verification level allows ${options.verificationCampaignLimit} campaigns in total. Review your verification to create more.`
              : options.creationBlockReason === 'plan_limit'
                ? 'Your plan’s active campaign limit has been reached. Finish an existing campaign or change your plan to create another.'
                : 'Campaign creation is currently unavailable. Review your account verification and plan eligibility.'}
        </Typography>}
        <Button component={RouterLink} to={options.creationBlockReason?.startsWith('verification_') ? '/kyc' : '/subscription'} size="small">
          {options.creationBlockReason?.startsWith('verification_') ? 'Review verification' : 'Manage plan'}
        </Button>
      </Alert>}
      <WizardStepper current={step} />

      {/* Step heading */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: INK }}>{meta.heading}</Typography>
        <Typography variant="body2" sx={{ color: INK_SECONDARY, mt: 0.25 }}>
          {meta.sub}
        </Typography>
      </Box>

      {/* Animated step panel — remounts on step change */}
      <Box
        key={step}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2.75,
          '@media (prefers-reduced-motion: no-preference)': { animation: 'wizardStepIn 220ms ease' },
          '@keyframes wizardStepIn': {
            from: { opacity: 0, transform: 'translateY(4px)' },
            to: { opacity: 1, transform: 'none' },
          },
        }}
      >
        {/* ----------------------------- STEP 1: BASICS ----------------------------- */}
        {step === 0 && (
          <>
            <TextField
              label="Campaign title"
              placeholder="e.g. Rebuild Auntie Ama's roadside kitchen"
              value={formData.title}
              onChange={change('title')}
              onBlur={blur('title')}
              error={errFor('title')}
              helperText={helperFor('title', 'The headline donors see first.')}
              fullWidth
              sx={fieldSx}
              slotProps={{ htmlInput: { maxLength: 90 } }}
            />

            <TextField
              label="Short summary"
              placeholder="One sentence on what you're raising for and why."
              value={formData.summary}
              onChange={change('summary')}
              onBlur={blur('summary')}
              error={errFor('summary')}
              helperText={helperFor('summary', `${formData.summary.length}/140`)}
              fullWidth
              multiline
              rows={2}
              sx={fieldSx}
              slotProps={{ htmlInput: { maxLength: 140 } }}
            />

            <Box>
              <Eyebrow>Category</Eyebrow>
              <Box role="group" aria-label="Category" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {CATEGORIES.map((c) => {
                  const selected = formData.category === c.value
                  const CategoryIcon = CATEGORY_ICONS[c.value as keyof typeof CATEGORY_ICONS] ?? CategoryRoundedIcon
                  return (
                    <Box
                      key={c.value}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => selectCategory(c.value)}
                      onKeyDown={(ev: KeyboardEvent) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          selectCategory(c.value)
                        }
                      }}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.9,
                        px: 1.5,
                        py: 0.9,
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderRadius: SHAPE.sm,
                        border: '1.5px solid',
                        borderColor: selected ? GOLD : DIVIDER,
                        bgcolor: 'background.paper',
                        boxShadow: selected ? 'var(--neu-inset)' : 'var(--neu-subtle)',
                        backdropFilter: 'var(--neu-backdrop)',
                        color: selected ? 'text.primary' : INK_SECONDARY,
                        fontSize: '0.85rem',
                        fontWeight: selected ? 700 : 600,
                        transition: 'border-color 160ms ease, background-color 160ms ease',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        '&:hover': { borderColor: selected ? GOLD : SAGE },
                        '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
                      }}
                    >
                      <CategoryIcon sx={{ fontSize: 22, color: selected ? 'primary.main' : 'text.secondary' }} />
                      {c.label}
                    </Box>
                  )
                })}
              </Box>
              {errFor('category') && (
                <Typography sx={{ mt: 1, fontSize: '0.75rem', color: CLAY }}>{errors.category}</Typography>
              )}
            </Box>
          </>
        )}

        {/* ----------------------------- STEP 2: STORY ----------------------------- */}
        {step === 1 && (
          <>
            <TextField
              label="Your story"
              placeholder="Describe the situation, what the funds will do, and the impact it will have."
              value={formData.description}
              onChange={change('description')}
              onBlur={blur('description')}
              error={errFor('description')}
              helperText={helperFor('description', `${formData.description.trim().length} characters · aim for a full, honest picture`)}
              fullWidth
              multiline
              rows={6}
              sx={fieldSx}
            />

            <Box>
              <TextField
                label="Who will this help?"
                placeholder="e.g. Ama Mensah, the Osu community kitchen"
                value={formData.beneficiaries}
                onChange={change('beneficiaries')}
                onBlur={blur('beneficiaries')}
                error={errFor('beneficiaries')}
                helperText={helperFor('beneficiaries', 'Separate multiple beneficiaries with commas.')}
                fullWidth
                sx={fieldSx}
              />
              {beneficiaryList.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
                  {beneficiaryList.map((b) => (
                    <Box
                      key={b}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1.25,
                        py: 0.5,
                        borderRadius: SHAPE.sm,
                        bgcolor: 'rgba(46, 61, 47, 0.06)',
                        border: `1px solid ${DIVIDER}`,
                        fontSize: '0.8rem',
                        color: 'primary.main',
                        fontWeight: 600,
                      }}
                    >
                      <DiamondBullet color={SAGE} size={6} />
                      {b}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <ImageUpload
              value={formData.coverImageUrl}
              onChange={(url) => {
                setFormData((prev) => ({ ...prev, coverImageUrl: url }))
                setTouched((t) => ({ ...t, coverImageUrl: true }))
              }}
              uploadFn={(file, onProgress) => uploadImageViaApi(file, 'campaigns', onProgress)}
              label="Cover image"
              helperText="Optional — a single strong photo helps donors connect."
            />
          </>
        )}

        {/* -------------------------- STEP 3: GOAL & TIMELINE -------------------------- */}
        {step === 2 && (
          <>
            <Box>
              <TextField
                label="Goal amount"
                type="number"
                value={formData.goalAmount}
                onChange={change('goalAmount')}
                onBlur={blur('goalAmount')}
                error={errFor('goalAmount')}
                helperText={helperFor('goalAmount', 'How much do you need to raise in total?')}
                fullWidth
                sx={fieldSx}
                slotProps={{
                  htmlInput: { min: 1, step: 1 },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>GH₵</Typography>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {goalNumber > 0 && (
                <Typography sx={{ mt: 0.75, fontSize: '0.8rem', color: INK_SECONDARY }}>
                  Donors will see a goal of{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {formatCurrency(goalNumber)}
                  </Box>
                </Typography>
              )}
            </Box>

            <Box>
              <BrandedDatePicker
                label="End date"

                value={formData.endDate}
                onChange={(value) => setFormData((prev) => ({ ...prev, endDate: value }))}
                onBlur={blur('endDate')}
                error={errFor('endDate')}
                helperText={helperFor('endDate', 'When should the campaign stop accepting donations?')}
                fullWidth
                sx={fieldSx}
                minDate={todayIso}
              />
              {durationDays > 0 && (
                <Typography sx={{ mt: 0.75, fontSize: '0.8rem', color: INK_SECONDARY }}>
                  Runs for{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {durationDays} {durationDays === 1 ? 'day' : 'days'}
                  </Box>{' '}
                  from today.
                </Typography>
              )}
            </Box>

            <Box>
              <Eyebrow>Priority</Eyebrow>
              <Box role="group" aria-label="Priority" sx={{ display: 'grid', gap: 1.25, mt: 1 }}>
                {PRIORITIES.map((p) => {
                  const selected = formData.priority === p.value
                  return (
                    <Box
                      key={p.value}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => setFormData((prev) => ({ ...prev, priority: p.value }))}
                      onKeyDown={(ev: KeyboardEvent) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          setFormData((prev) => ({ ...prev, priority: p.value }))
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1.25,
                        px: 1.75,
                        py: 1.4,
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderRadius: SHAPE.card,
                        border: '1.5px solid',
                        borderColor: selected ? p.tone : DIVIDER,
                        bgcolor: selected ? p.tint : 'transparent',
                        transition: 'border-color 160ms ease, background-color 160ms ease',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        '&:hover': { borderColor: selected ? p.tone : SAGE },
                        '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
                      }}
                    >
                      <Box sx={{ mt: 0.6 }}>
                        <DiamondBullet color={p.tone} size={9} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 700, color: selected ? 'primary.main' : INK, fontSize: '0.95rem' }}>
                          {p.label}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY, mt: 0.1 }}>{p.blurb}</Typography>
                      </Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </>
        )}

        {/* ----------------------------- STEP 4: REVIEW ----------------------------- */}
        {step === 3 && (
          <Box
            sx={{
              borderRadius: SHAPE.card,
              border: `1px solid ${DIVIDER}`,
              bgcolor: 'action.hover',
              px: { xs: 2, sm: 2.75 },
              py: { xs: 2, sm: 2.5 },
            }}
          >
            <ReviewSection title="Basics" onEdit={() => setStep(0)}>
              <ReviewItem label="Title">{formData.title || '—'}</ReviewItem>
              <ReviewItem label="Summary">{formData.summary || '—'}</ReviewItem>
              <ReviewItem label="Category">
                {formData.category ? CATEGORIES.find((c) => c.value === formData.category)?.label : '—'}
              </ReviewItem>
            </ReviewSection>

            <ReviewSection title="Story" onEdit={() => setStep(1)}>
              <ReviewItem label="Description">
                <Box sx={{ whiteSpace: 'pre-wrap' }}>{formData.description || '—'}</Box>
              </ReviewItem>
              <ReviewItem label="Beneficiaries">
                {beneficiaryList.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {beneficiaryList.map((b) => (
                      <Box
                        key={b}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.6,
                          px: 1,
                          py: 0.35,
                          borderRadius: SHAPE.sm,
                          bgcolor: 'rgba(46, 61, 47, 0.06)',
                          border: `1px solid ${DIVIDER}`,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'primary.main',
                        }}
                      >
                        <DiamondBullet color={SAGE} size={6} />
                        {b}
                      </Box>
                    ))}
                  </Box>
                ) : (
                  '—'
                )}
              </ReviewItem>
              <ReviewItem label="Cover image">
                {formData.coverImageUrl ? (
                  <Box
                    component="img"
                    src={formData.coverImageUrl}
                    alt="Campaign cover"
                    sx={{ width: 120, height: 72, objectFit: 'cover', borderRadius: SHAPE.sm, border: `1px solid ${DIVIDER}` }}
                  />
                ) : (
                  'None'
                )}
              </ReviewItem>
            </ReviewSection>

            <ReviewSection title="Goal & timeline" onEdit={() => setStep(2)}>
              <ReviewItem label="Goal">
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {goalNumber > 0 ? formatCurrency(goalNumber) : '—'}
                </Box>
              </ReviewItem>
              <ReviewItem label="Ends">
                {formData.endDate
                  ? `${new Date(formData.endDate).toLocaleDateString('en-GH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}${durationDays > 0 ? ` · ${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : ''}`
                  : '—'}
              </ReviewItem>
              <ReviewItem label="Priority">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  <DiamondBullet color={PRIORITIES.find((p) => p.value === formData.priority)?.tone ?? FOREST} />
                  {PRIORITIES.find((p) => p.value === formData.priority)?.label}
                </Box>
              </ReviewItem>
            </ReviewSection>

            <Box
              sx={{
                mt: 1,
                pt: 2,
                borderTop: `1px solid ${DIVIDER}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                color: INK_SECONDARY,
              }}
            >
              <ShieldRoundedIcon sx={{ fontSize: 18, color: 'primary.main', mt: 0.1 }} />
              <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                Campaigns may go live immediately or require review, depending on the applicable checks. You can still edit any step above.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Inline submit error — keeps the wizard on the review step on failure */}
      {step === 3 && options && <CampaignCreationExtras options={options} invitations={invitations} setInvitations={setInvitations} split={split} setSplit={setSplit} rows={rows} setRows={setRows} />}
      {step === 3 && extrasError && <Alert severity="warning" sx={{ mt: 2 }}>{extrasError}</Alert>}
      {step === STEPS.length - 1 && submitError && (
        <Box
          role="alert"
          sx={{
            mt: 3,
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            borderRadius: SHAPE.card,
            border: `1px solid ${CLAY}`,
            bgcolor: 'rgba(165, 67, 47, 0.06)',
          }}
        >
          <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: CLAY, mt: 0.1 }} />
          <Box>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: CLAY }}>
              We couldn&apos;t publish your campaign
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: INK_SECONDARY, mt: 0.25 }}>
              {submitError} Your details are safe — please try again.
            </Typography>
          </Box>
        </Box>
      )}

      {/* ----------------------------- NAVIGATION ----------------------------- */}
      <Box
        sx={{
          mt: 4,
          pt: 3,
          borderTop: `1px solid ${DIVIDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Button
          type="button"
          onClick={handleBack}
          disabled={step === 0 || isSubmitting || setupBusy}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ color: 'primary.main', visibility: step === 0 ? 'hidden' : 'visible' }}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid || !options?.canCreate}
            variant="contained"
            color="secondary"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            size="large"
            disabled={isSubmitting || setupBusy || !options?.canCreate || !!extrasError || Object.keys(errors).length > 0}
            startIcon={isSubmitting ? <LoadingDots size={6} /> : <CheckRoundedIcon />}
          >
            {isSubmitting || setupBusy ? 'Setting up campaign…' : 'Publish campaign'}
          </Button>
        )}
      </Box>
    </Box>
  )
}
