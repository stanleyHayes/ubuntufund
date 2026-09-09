import { Country, State, City } from 'country-state-city'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Autocomplete from '@mui/material/Autocomplete'
import { COUNTRY_OPTIONS } from '@/data/countries'
import { BrandedDatePicker } from '@ubuntu-fund/ui'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Paper from '@mui/material/Paper'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { keyframes } from '@mui/material/styles'
import { ImageUpload } from '@ubuntu-fund/ui'
import { Link as RouterLink } from 'react-router-dom'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { api } from '@/lib/api'
import { uploadImageViaApi } from '@/lib/uploadImage'

// Upload KYC documents through our own API (browser → API → Cloudinary) so an
// ad-blocker or restrictive network can't block the direct Cloudinary request.
const uploadKycDoc = (file: File, onProgress: (percent: number) => void) =>
  uploadImageViaApi(file, 'kyc', onProgress)

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const steps = ['Personal Info', 'ID Document', 'Address Proof', 'Selfie Verification']

export function KYCPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Personal info
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [nationality, setNationality] = useState('')
  const [idNumber, setIdNumber] = useState('')

  // Step 2: ID document
  const [idFrontUrl, setIdFrontUrl] = useState('')
  const [idBackUrl, setIdBackUrl] = useState('')

  // Step 3: Address
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('Ghana')
  const [countryCode, setCountryCode] = useState('GH')
  const [stateCode, setStateCode] = useState('')
  const [proofMethod, setProofMethod] = useState<'ghana_post_gps' | 'document'>('ghana_post_gps')
  const [gpsAddress, setGpsAddress] = useState('')
  const countries = Country.getAllCountries()
  const states = State.getStatesOfCountry(countryCode)
  const cities = stateCode ? City.getCitiesOfState(countryCode, stateCode) : []
  const dropdownProps = { paper: { sx: { bgcolor: 'background.paper', color: 'text.primary', boxShadow: 'var(--neu-raised)', border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)', '& .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: 'action.selected', color: 'primary.main' } } } }

  function addressError() {
    if (!country || !city.trim() || (states.length > 0 && !state)) return 'Select your country, region and city.'
    if (proofMethod === 'ghana_post_gps') {
      if (countryCode !== 'GH' || !/^[A-Z]{2}-[0-9]{3,5}-[0-9]{4}$/.test(gpsAddress.trim())) return 'Enter a GhanaPost GPS address, for example GA-183-8164.'
    } else if (!street.trim() || !addressDocUrl) return 'Enter your street address and upload proof of address.'
    return null
  }
  const [postalCode, setPostalCode] = useState('')
  const [addressDocUrl, setAddressDocUrl] = useState('')

  // Step 4: Selfie
  const [selfieUrl, setSelfieUrl] = useState('')

  function handleNext() {
    if (activeStep === 0 && !nationality) { setError('Select your nationality from the list.'); return }
    if (activeStep === 2) { const message = addressError(); if (message) { setError(message); return } }
    setError(null)
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1)
    }
  }

  function handleBack() {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1)
    }
  }

  async function handleSubmit() {
    if (!COUNTRY_OPTIONS.some(option => option.label === nationality)) { setActiveStep(0); setError('Select your nationality from the list.'); return }
    const message = addressError()
    if (message) { setActiveStep(2); setError(message); return }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/kyc/identity', {
        personalInfo: {
          fullName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
          nationality,
          idNumber,
          address: { city: city.trim(), state, country, proofMethod, ...(proofMethod === 'document' ? { street: street.trim(), postalCode: postalCode.trim() } : {}), ...(proofMethod === 'ghana_post_gps' ? { gpsAddress: gpsAddress.trim() } : {}) },
        },
        documents: [
          ...(idFrontUrl ? [{ type: 'id_card' as const, url: idFrontUrl }] : []),
          ...(idBackUrl ? [{ type: 'id_card' as const, url: idBackUrl }] : []),
          ...(proofMethod === 'document' && addressDocUrl ? [{ type: 'utility_bill' as const, url: addressDocUrl }] : []),
          ...(selfieUrl ? [{ type: 'passport' as const, url: selfieUrl }] : []),
        ],
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center', animation: `${fadeIn} 0.5s ease` }}>
        <CheckCircleIcon sx={{ fontSize: 64, color: 'var(--text-success)', mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Verification Submitted!
        </Typography>
        <Typography sx={{ color: 'text.secondary', mb: 4 }}>
          Your documents are under review. We'll notify you once the review is complete.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button component={RouterLink} to="/profile" variant="outlined" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Back to profile
          </Button>
          <Button component={RouterLink} to="/dashboard" variant="contained" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Go to Dashboard
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ minWidth: 0, width: '100%', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 6 }, animation: `${fadeIn} 0.4s ease` }}>
      <Button
        component={RouterLink}
        to="/profile"
        startIcon={<ArrowBackRoundedIcon />}
        sx={{ mb: 2, textTransform: 'none', fontWeight: 600, color: 'text.secondary', boxShadow: 'none', '&:hover': { boxShadow: 'none', bgcolor: 'action.hover' } }}
      >
        Back to profile
      </Button>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, textAlign: 'center' }}>
        KYC Verification
      </Typography>
      <Typography sx={{ color: 'text.secondary', textAlign: 'center', mb: 4 }}>
        Complete the steps below to verify your identity and unlock full platform access.
      </Typography>

      <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 3 }} aria-label={`Step ${activeStep + 1} of ${steps.length}: ${steps[activeStep]}`}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Step {activeStep + 1} of {steps.length} · <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>{steps[activeStep]}</Box></Typography>
        <Box aria-hidden="true" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1 }}>{steps.map((label, index) => <Box key={label} sx={{ height: 5, borderRadius: 1, bgcolor: index <= activeStep ? 'primary.main' : 'action.disabledBackground' }} />)}</Box>
      </Box>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, display: { xs: 'none', sm: 'flex' }, minWidth: 0 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={0} sx={{ minWidth: 0, p: { xs: 2, sm: 4 }, boxShadow: 'var(--neu-raised)', borderRadius: 3 }}>
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Personal Information</Typography>
            <TextField label="Full Name (as on ID)" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth required />
            <BrandedDatePicker label="Date of Birth"  value={dateOfBirth} onChange={setDateOfBirth} maxDate={new Date().toLocaleDateString('en-CA')} fullWidth  required />
            <Autocomplete
              options={COUNTRY_OPTIONS}
              value={COUNTRY_OPTIONS.find(option => option.label === nationality) ?? null}
              onChange={(_, option) => { setNationality(option?.label ?? ''); setError(null) }}
              isOptionEqualToValue={(option, value) => option.code === value.code}
              autoHighlight
              fullWidth
              noOptionsText="No matching country. Try another search."
              slotProps={{ paper: { sx: { bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)', border: 'var(--neu-border)', backdropFilter: 'var(--neu-backdrop)' } } }}
              renderInput={(params) => <TextField {...params} label="Nationality" placeholder="Search country of nationality" helperText="Select the country of nationality shown on your identity document." required />}
            />
            <TextField label="ID Number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} fullWidth required helperText="National ID, Passport, or Driver's License number" />
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>ID Document Upload</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              Upload a clear photo or scan of your government-issued ID. Front and back required for ID cards.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
              <ImageUpload
                value={idFrontUrl}
                onChange={setIdFrontUrl}
                uploadFn={uploadKycDoc}
                label="Front side"
                helperText="Clear photo or scan of the front of your ID."
                accept="image/*,application/pdf"
              />
              <ImageUpload
                value={idBackUrl}
                onChange={setIdBackUrl}
                uploadFn={uploadKycDoc}
                label="Back side"
                helperText="Clear photo or scan of the back of your ID."
                accept="image/*,application/pdf"
              />
            </Box>
          </Box>
        )}

        {activeStep === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Address Verification</Typography>
            <Typography color="text.secondary">Select your location, then choose how to provide your address.</Typography>
            <Autocomplete options={countries} getOptionLabel={(option) => option.name} value={countries.find(option => option.isoCode === countryCode) ?? null}
              onChange={(_, option) => { setCountry(option?.name ?? ''); setCountryCode(option?.isoCode ?? ''); setState(''); setStateCode(''); setCity(''); setGpsAddress(''); setPostalCode(''); if (option?.isoCode !== 'GH') setProofMethod('document'); setError(null) }}
              isOptionEqualToValue={(a, b) => a.isoCode === b.isoCode} autoHighlight fullWidth slotProps={dropdownProps}
              renderInput={(params) => <TextField {...params} label="Country" required placeholder="Search countries" />} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
              {states.length > 0 ? <Autocomplete options={states} getOptionLabel={(option) => option.name} value={states.find(option => option.isoCode === stateCode) ?? null}
                onChange={(_, option) => { setState(option?.name ?? ''); setStateCode(option?.isoCode ?? ''); setCity('') }}
                isOptionEqualToValue={(a, b) => a.isoCode === b.isoCode} autoHighlight fullWidth slotProps={dropdownProps}
                renderInput={(params) => <TextField {...params} label={countryCode === 'GH' ? 'Region' : 'State / Province'} required placeholder="Search regions" />} />
                : <TextField label="State / Province (optional)" value={state} disabled={!countryCode} onChange={(e) => setState(e.target.value)} fullWidth />}
              <Autocomplete freeSolo options={[...new Set(cities.map(option => option.name))]} value={city} inputValue={city}
                onInputChange={(_, value) => setCity(value)} onChange={(_, value) => setCity(value ?? '')} disabled={!countryCode || (states.length > 0 && !stateCode)}
                autoHighlight fullWidth slotProps={dropdownProps}
                renderInput={(params) => <TextField {...params} label="City / Town" required helperText="Select a city or type your town if it is not listed." />} />
            </Box>
            <Typography sx={{ fontWeight: 700 }}>Proof of address</Typography>
            {countryCode === 'GH' && <ToggleButtonGroup exclusive value={proofMethod} onChange={(_, value) => { if (value) { setProofMethod(value); setError(null) } }} fullWidth aria-label="Proof of address method" sx={{ '& .MuiToggleButton-root': { flex: 1, textTransform: 'none', '&.Mui-selected': { color: 'primary.main', bgcolor: 'action.selected', borderColor: 'primary.main' } } }}>
              <ToggleButton value="ghana_post_gps">GhanaPost GPS</ToggleButton>
              <ToggleButton value="document">Upload document</ToggleButton>
            </ToggleButtonGroup>}
            {proofMethod === 'ghana_post_gps' && countryCode === 'GH' ? <>
              <TextField label="GhanaPost GPS address" value={gpsAddress} onChange={(e) => { setGpsAddress(e.target.value.toUpperCase().replace(/\s/g, '')); setError(null) }} fullWidth required placeholder="GA-183-8164" helperText="Enter the digital address for your home. It will be reviewed with your identity details." />
              <Button component="a" href="https://ghanapostgps.com/" target="_blank" rel="noopener noreferrer" sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>Find my GhanaPost GPS address</Button>
            </> : <>
              <TextField label="Street Address" value={street} onChange={(e) => setStreet(e.target.value)} fullWidth required autoComplete="street-address" />
              <TextField label="Postal Code (optional)" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} fullWidth autoComplete="postal-code" />
              <ImageUpload value={addressDocUrl} onChange={setAddressDocUrl} uploadFn={uploadKycDoc} label="Address proof" helperText="Utility bill or bank statement (max 3 months old)." accept="image/*,application/pdf" />
            </>}
          </Box>
        )}

        {activeStep === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Selfie Verification</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              Upload a clear selfie holding your ID document. This helps us verify that the ID belongs to you.
            </Typography>
            <ImageUpload
              value={selfieUrl}
              onChange={setSelfieUrl}
              uploadFn={uploadKycDoc}
              label="Selfie with ID"
              helperText="Clear selfie holding your ID document."
              accept="image/*"
            />
          </Box>
        )}

        {error && (
          <Typography sx={{ color: 'var(--text-error)', mt: 2, fontSize: '0.9rem' }}>
            {error}
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={activeStep === 0}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Back
          </Button>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 4 }}
            >
              {submitting ? 'Submitting...' : 'Submit Verification'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 4 }}
            >
              Next
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  )
}
