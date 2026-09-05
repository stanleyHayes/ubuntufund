import { BrandedDatePicker } from '@ubuntu-fund/ui'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Paper from '@mui/material/Paper'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { keyframes } from '@mui/material/styles'
import { ImageUpload } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

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
  const [country, setCountry] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [addressDocUrl, setAddressDocUrl] = useState('')

  // Step 4: Selfie
  const [selfieUrl, setSelfieUrl] = useState('')

  function handleNext() {
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
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/kyc/identity', {
        personalInfo: {
          fullName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
          nationality,
          idNumber,
          address: { street, city, state, country, postalCode },
        },
        documents: [
          ...(idFrontUrl ? [{ type: 'id_card' as const, url: idFrontUrl }] : []),
          ...(idBackUrl ? [{ type: 'id_card' as const, url: idBackUrl }] : []),
          ...(addressDocUrl ? [{ type: 'utility_bill' as const, url: addressDocUrl }] : []),
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
        <Button variant="contained" href="/dashboard" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
          Go to Dashboard
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 6, animation: `${fadeIn} 0.4s ease` }}>
      <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, textAlign: 'center' }}>
        KYC Verification
      </Typography>
      <Typography sx={{ color: 'text.secondary', textAlign: 'center', mb: 4 }}>
        Complete the steps below to verify your identity and unlock full platform access.
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, boxShadow: 'var(--neu-raised)', borderRadius: 3 }}>
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Personal Information</Typography>
            <TextField label="Full Name (as on ID)" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth required />
            <BrandedDatePicker label="Date of Birth"  value={dateOfBirth} onChange={setDateOfBirth} maxDate={new Date().toLocaleDateString('en-CA')} fullWidth  required />
            <TextField label="Nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} fullWidth required />
            <TextField label="ID Number" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} fullWidth required helperText="National ID, Passport, or Driver's License number" />
          </Box>
        )}

        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>ID Document Upload</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              Upload a clear photo or scan of your government-issued ID. Front and back required for ID cards.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <ImageUpload
                value={idFrontUrl}
                onChange={setIdFrontUrl}
                label="Front side"
                helperText="Clear photo or scan of the front of your ID."
                accept="image/*,application/pdf"
              />
              <ImageUpload
                value={idBackUrl}
                onChange={setIdBackUrl}
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
            <TextField label="Street Address" value={street} onChange={(e) => setStreet(e.target.value)} fullWidth required />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} fullWidth required />
              <TextField label="State/Province" value={state} onChange={(e) => setState(e.target.value)} fullWidth required />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="Country" value={country} onChange={(e) => setCountry(e.target.value)} fullWidth required />
              <TextField label="Postal Code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} fullWidth required />
            </Box>
            <ImageUpload
              value={addressDocUrl}
              onChange={setAddressDocUrl}
              label="Address proof"
              helperText="Utility bill or bank statement (max 3 months old)."
              accept="image/*,application/pdf"
            />
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
