import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { Link as RouterLink } from 'react-router-dom'
import { OrganizationType } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'

type AccountType = 'individual' | 'organization'

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  organizationName?: string
  organizationType?: string
  website?: string
}

const ORG_TYPE_LABELS: Record<OrganizationType, string> = {
  [OrganizationType.NGO]: 'NGO / Non-profit',
  [OrganizationType.HOSPITAL]: 'Hospital / Health',
  [OrganizationType.SCHOOL]: 'School / Education',
  [OrganizationType.RELIGIOUS]: 'Religious body',
  [OrganizationType.GOVERNMENT]: 'Government / Public',
  [OrganizationType.OTHER]: 'Other',
}

export function RegisterForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register } = useAuth()

  // A `?role=organization` link (e.g. the marketing "Create Organization
  // Account" CTA) preselects the organization form.
  const [accountType, setAccountType] = useState<AccountType>(
    searchParams.get('role') === 'organization' ? 'organization' : 'individual',
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationType, setOrganizationType] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [website, setWebsite] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isOrg = accountType === 'organization'

  function validate(): FormErrors {
    const newErrors: FormErrors = {}
    if (!name.trim()) newErrors.name = isOrg ? 'Contact name is required' : 'Name is required'
    if (!email.trim()) newErrors.email = 'Email is required'
    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
    if (isOrg) {
      if (!organizationName.trim()) newErrors.organizationName = 'Organization name is required'
      if (!organizationType) newErrors.organizationType = 'Select an organization type'
      if (website.trim() && !/^https?:\/\/.+/i.test(website.trim())) {
        newErrors.website = 'Enter a full URL (https://…)'
      }
    }
    return newErrors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors = validate()
    setErrors(newErrors)
    setApiError('')
    if (Object.keys(newErrors).length > 0) return

    setSubmitting(true)
    try {
      let referralCode: string | undefined
      try {
        referralCode = localStorage.getItem('uf_ref')?.trim() || undefined
      } catch {
        referralCode = undefined
      }
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        referralCode,
        ...(isOrg
          ? {
              role: 'organization',
              organizationName: organizationName.trim(),
              organizationType,
              registrationNumber: registrationNumber.trim() || undefined,
              website: website.trim() || undefined,
            }
          : {}),
      })
      navigate('/dashboard')
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {apiError && <Alert severity="error">{apiError}</Alert>}

      <ToggleButtonGroup
        value={accountType}
        exclusive
        fullWidth
        color="primary"
        onChange={(_, val: AccountType | null) => { if (val) setAccountType(val) }}
        aria-label="Account type"
        size="small"
      >
        <ToggleButton value="individual">Individual</ToggleButton>
        <ToggleButton value="organization">Organization</ToggleButton>
      </ToggleButtonGroup>

      {isOrg && (
        <>
          <TextField
            label="Organization name"
            name="organizationName"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            error={!!errors.organizationName}
            helperText={errors.organizationName}
            fullWidth
            required
          />
          <TextField
            select
            label="Organization type"
            name="organizationType"
            value={organizationType}
            onChange={(e) => setOrganizationType(e.target.value)}
            error={!!errors.organizationType}
            helperText={errors.organizationType}
            fullWidth
            required
          >
            {Object.values(OrganizationType).map((t) => (
              <MenuItem key={t} value={t}>{ORG_TYPE_LABELS[t]}</MenuItem>
            ))}
          </TextField>
        </>
      )}

      <TextField
        label={isOrg ? 'Contact name' : 'Full Name'}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={!!errors.name}
        helperText={errors.name}
        fullWidth
        required
        autoComplete="name"
      />

      <TextField
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={!!errors.email}
        helperText={errors.email}
        fullWidth
        required
        autoComplete="email"
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={!!errors.password}
        helperText={errors.password}
        fullWidth
        required
        autoComplete="new-password"
      />

      <TextField
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword}
        fullWidth
        required
        autoComplete="new-password"
      />

      {isOrg && (
        <>
          <TextField
            label="Registration number (optional)"
            name="registrationNumber"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            fullWidth
          />
          <TextField
            label="Website (optional)"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            error={!!errors.website}
            helperText={errors.website}
            placeholder="https://"
            fullWidth
          />
        </>
      )}

      <Button
        type="submit"
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        disabled={submitting}
      >
        {submitting ? 'Creating account...' : isOrg ? 'Create Organization Account' : 'Create Account'}
      </Button>

      <Typography variant="body2" align="center" color="text.secondary">
        Already have an account?{' '}
        <Link component={RouterLink} to="/login" underline="hover" sx={{ color: 'secondary.main', fontWeight: 600 }}>
          Sign in
        </Link>
      </Typography>
    </Box>
  )
}
