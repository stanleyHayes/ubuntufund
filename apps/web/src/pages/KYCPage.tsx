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
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { keyframes } from '@mui/material/styles'
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
        <CheckCircleIcon sx={{ fontSize: 64, color: '#4CAF50', mb: 2 }} />
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

      <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 3 }}>
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Personal Information</Typography>
            <TextField label="Full Name (as on ID)" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth required />
            <TextField label="Date of Birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} required />
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
              <Box sx={{
                border: '2px dashed rgba(0,0,0,0.12)',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                bgcolor: idFrontUrl ? 'rgba(46,125,50,0.04)' : 'transparent',
              }}>
                <CloudUploadIcon sx={{ fontSize: 32, color: idFrontUrl ? '#4CAF50' : 'text.disabled', mb: 1 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Front Side</Typography>
                <TextField size="small" placeholder="Document URL" value={idFrontUrl} onChange={(e) => setIdFrontUrl(e.target.value)} fullWidth sx={{ mt: 1 }} />
              </Box>
              <Box sx={{
                border: '2px dashed rgba(0,0,0,0.12)',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                bgcolor: idBackUrl ? 'rgba(46,125,50,0.04)' : 'transparent',
              }}>
                <CloudUploadIcon sx={{ fontSize: 32, color: idBackUrl ? '#4CAF50' : 'text.disabled', mb: 1 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Back Side</Typography>
                <TextField size="small" placeholder="Document URL" value={idBackUrl} onChange={(e) => setIdBackUrl(e.target.value)} fullWidth sx={{ mt: 1 }} />
              </Box>
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
            <Box sx={{
              border: '2px dashed rgba(0,0,0,0.12)',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              bgcolor: addressDocUrl ? 'rgba(46,125,50,0.04)' : 'transparent',
            }}>
              <CloudUploadIcon sx={{ fontSize: 32, color: addressDocUrl ? '#4CAF50' : 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Address Proof</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1 }}>Utility bill or bank statement (max 3 months old)</Typography>
              <TextField size="small" placeholder="Document URL" value={addressDocUrl} onChange={(e) => setAddressDocUrl(e.target.value)} fullWidth sx={{ mt: 1 }} />
            </Box>
          </Box>
        )}

        {activeStep === 3 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Selfie Verification</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              Upload a clear selfie holding your ID document. This helps us verify that the ID belongs to you.
            </Typography>
            <Box sx={{
              border: '2px dashed rgba(0,0,0,0.12)',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              bgcolor: selfieUrl ? 'rgba(46,125,50,0.04)' : 'transparent',
            }}>
              <CloudUploadIcon sx={{ fontSize: 40, color: selfieUrl ? '#4CAF50' : 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Selfie with ID</Typography>
              <TextField size="small" placeholder="Selfie URL" value={selfieUrl} onChange={(e) => setSelfieUrl(e.target.value)} fullWidth sx={{ mt: 1 }} />
            </Box>
          </Box>
        )}

        {error && (
          <Typography sx={{ color: '#EF5350', mt: 2, fontSize: '0.9rem' }}>
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
