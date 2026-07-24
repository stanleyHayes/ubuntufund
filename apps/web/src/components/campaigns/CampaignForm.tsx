import { Fragment, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import { Link as RouterLink } from 'react-router-dom'
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types'
import { formatCurrency, SHAPE } from '@ubuntu-fund/ui'
import { useCreateCampaign } from '@/hooks/useCampaigns'
import { getCloudinaryConfig, uploadToCloudinary } from '@/lib/cloudinary'

// ---------------------------------------------------------------------------
// Sage & Neutrals palette — brand hexes only (see design system)
// ---------------------------------------------------------------------------
const FOREST = '#2E3D2F'
const FOREST_DARK = '#1C261D'
const SAGE = '#A8B5A0'
const INK = '#1A2E22'
const INK_SECONDARY = '#4A5A50'
const GOLD = '#C7A24A'
const GOLD_DARK = '#A07E33'
const CLAY = '#A5432F'
const DIVIDER = '#DAD7CD'

// Cloudinary is optional — computed once from public build-time env vars.
// When null, the cover step falls back to a paste-a-URL input only.
const CLOUDINARY = getCloudinaryConfig()

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const CATEGORIES = Object.values(CampaignCategory).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
}))

const PRIORITIES: { value: CampaignPriority; label: string; blurb: string; tone: string; tint: string }[] = [
  { value: CampaignPriority.NORMAL, label: 'Normal', blurb: 'A steady campaign with standard listing.', tone: FOREST, tint: 'rgba(46, 61, 47, 0.07)' },
  { value: CampaignPriority.URGENT, label: 'Urgent', blurb: 'Time-sensitive need — boosted visibility.', tone: GOLD_DARK, tint: 'rgba(199, 162, 74, 0.12)' },
  { value: CampaignPriority.CRITICAL, label: 'Critical', blurb: 'Life-or-death need — front-page priority.', tone: CLAY, tint: 'rgba(165, 67, 47, 0.10)' },
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
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

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

  if (data.coverImageUrl.trim() && !isValidUrl(data.coverImageUrl.trim())) e.coverImageUrl = 'Enter a valid https:// link'

  if (!data.goalAmount) e.goalAmount = 'Set a goal amount'
  else if (Number.isNaN(Number(data.goalAmount))) e.goalAmount = 'Enter a number'
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
                    color: active ? GOLD_DARK : done ? FOREST : INK_SECONDARY,
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
          sx={{ color: FOREST, minHeight: 0, py: 0.25, px: 1, fontSize: '0.8rem' }}
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
  const [coverError, setCoverError] = useState(false)
  // Cloudinary upload state — null progress means "no upload in flight".
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { createCampaign, isSubmitting, error: submitError } = useCreateCampaign()
  // Capture "now" once at mount — keeps the render body pure (react-hooks/purity).
  const [nowMs] = useState(() => Date.now())

  const errors = useMemo(() => validate(formData), [formData])
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

  function handleNext() {
    if (!isStepValid) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so re-selecting the same file fires onChange again.
    e.target.value = ''
    if (!file || !CLOUDINARY) return
    setUploadError(null)
    setUploadProgress(0)
    try {
      const { secureUrl } = await uploadToCloudinary(file, CLOUDINARY, setUploadProgress)
      setCoverError(false)
      setFormData((prev) => ({ ...prev, coverImageUrl: secureUrl }))
      setTouched((t) => ({ ...t, coverImageUrl: true }))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploadProgress(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const all = validate(formData)
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
        endDate: formData.endDate,
        priority: formData.priority,
      })
      // The api client returns the created campaign; guard for the demo
      // account (which yields an empty payload) so we still show success.
      const id = created && typeof created === 'object' && 'id' in created ? String(created.id) : null
      setCreatedId(id && id.length > 0 ? id : null)
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
  const showCover = Boolean(formData.coverImageUrl.trim()) && isValidUrl(formData.coverImageUrl.trim()) && !coverError

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
          Your campaign has been submitted and is now pending review by our team. Once live, every cedi raised is tracked and
          every donor is thanked.
        </Typography>
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
          <Button component={RouterLink} to="/explore" sx={{ color: FOREST }}>
            Explore campaigns
          </Button>
        </Box>
      </Box>
    )
  }

  const meta = STEPS[step]

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
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
                        bgcolor: selected ? 'rgba(199, 162, 74, 0.12)' : 'transparent',
                        color: selected ? FOREST_DARK : INK_SECONDARY,
                        fontSize: '0.85rem',
                        fontWeight: selected ? 700 : 600,
                        transition: 'border-color 160ms ease, background-color 160ms ease',
                        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        '&:hover': { borderColor: selected ? GOLD : SAGE },
                        '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
                      }}
                    >
                      <DiamondBullet color={selected ? GOLD : SAGE} />
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
                        color: FOREST,
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

            <Box>
              <Eyebrow>Cover image</Eyebrow>
              {/* Cloudinary upload — only shown when the public env vars are configured. */}
              {CLOUDINARY && (
                <Box sx={{ mt: 1, mb: 1.5 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadProgress !== null}
                      startIcon={
                        uploadProgress !== null ? (
                          <CircularProgress size={16} sx={{ color: GOLD_DARK }} />
                        ) : (
                          <CloudUploadRoundedIcon />
                        )
                      }
                      sx={{
                        borderRadius: SHAPE.sm,
                        borderColor: DIVIDER,
                        color: FOREST,
                        '&:hover': { borderColor: SAGE, bgcolor: 'rgba(46, 61, 47, 0.04)' },
                      }}
                    >
                      {uploadProgress !== null ? `Uploading… ${uploadProgress}%` : 'Upload an image'}
                    </Button>
                    <Typography sx={{ fontSize: '0.8rem', color: INK_SECONDARY }}>or paste a link below</Typography>
                  </Box>
                  {uploadProgress !== null && (
                    <LinearProgress
                      variant="determinate"
                      value={uploadProgress}
                      sx={{ mt: 1.25, borderRadius: SHAPE.bar, height: 6, '& .MuiLinearProgress-bar': { bgcolor: GOLD } }}
                    />
                  )}
                  {uploadError && (
                    <Typography sx={{ mt: 1, fontSize: '0.78rem', color: CLAY }}>{uploadError}</Typography>
                  )}
                </Box>
              )}
              <TextField
                label="Cover image URL"
                placeholder="https://…"
                value={formData.coverImageUrl}
                onChange={(e) => {
                  setCoverError(false)
                  setUploadError(null)
                  setFormData((prev) => ({ ...prev, coverImageUrl: e.target.value }))
                }}
                onBlur={blur('coverImageUrl')}
                error={errFor('coverImageUrl')}
                helperText={helperFor('coverImageUrl', 'Optional — a single strong photo helps donors connect.')}
                fullWidth
                sx={fieldSx}
              />
              {showCover && (
                <Box
                  component="img"
                  src={formData.coverImageUrl.trim()}
                  alt="Campaign cover preview"
                  onError={() => setCoverError(true)}
                  sx={{
                    display: 'block',
                    mt: 1.5,
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'cover',
                    borderRadius: SHAPE.card,
                    border: `1px solid ${DIVIDER}`,
                  }}
                />
              )}
            </Box>
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
                        <Typography sx={{ fontWeight: 700, color: FOREST }}>GH₵</Typography>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {goalNumber > 0 && (
                <Typography sx={{ mt: 0.75, fontSize: '0.8rem', color: INK_SECONDARY }}>
                  Donors will see a goal of{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: FOREST }}>
                    {formatCurrency(goalNumber)}
                  </Box>
                </Typography>
              )}
            </Box>

            <Box>
              <TextField
                label="End date"
                type="date"
                value={formData.endDate}
                onChange={change('endDate')}
                onBlur={blur('endDate')}
                error={errFor('endDate')}
                helperText={helperFor('endDate', 'When should the campaign stop accepting donations?')}
                fullWidth
                sx={fieldSx}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: todayIso } }}
              />
              {durationDays > 0 && (
                <Typography sx={{ mt: 0.75, fontSize: '0.8rem', color: INK_SECONDARY }}>
                  Runs for{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: FOREST }}>
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
                        <Typography sx={{ fontWeight: 700, color: selected ? p.tone : INK, fontSize: '0.95rem' }}>
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
              bgcolor: 'rgba(242, 239, 234, 0.5)',
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
                          color: FOREST,
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
                {showCover ? (
                  <Box
                    component="img"
                    src={formData.coverImageUrl.trim()}
                    alt="Campaign cover"
                    onError={() => setCoverError(true)}
                    sx={{ width: 120, height: 72, objectFit: 'cover', borderRadius: SHAPE.sm, border: `1px solid ${DIVIDER}` }}
                  />
                ) : formData.coverImageUrl.trim() ? (
                  formData.coverImageUrl.trim()
                ) : (
                  'None added'
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
              <ShieldRoundedIcon sx={{ fontSize: 18, color: FOREST, mt: 0.1 }} />
              <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                Your campaign is reviewed by our team before it goes live. You can still edit any step above.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Inline submit error — keeps the wizard on the review step on failure */}
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
          disabled={step === 0 || isSubmitting}
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ color: FOREST, visibility: step === 0 ? 'hidden' : 'visible' }}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid}
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
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <CheckRoundedIcon />}
          >
            {isSubmitting ? 'Publishing…' : 'Publish campaign'}
          </Button>
        )}
      </Box>
    </Box>
  )
}
