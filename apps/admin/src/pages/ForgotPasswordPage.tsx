import { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material'
import ShieldIcon from '@mui/icons-material/Shield'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import { Link as RouterLink } from 'react-router-dom'
import { keyframes } from '@emotion/react'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
`

// ---------------------------------------------------------------------------
// Input styling
// ---------------------------------------------------------------------------
const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: 'rgba(255,255,255,0.02)',
    backdropFilter: 'blur(12px)',
    transition: 'all 0.25s ease',
    '& fieldset': {
      borderColor: 'rgba(255,255,255,0.06)',
      transition: 'all 0.25s ease',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(76,175,80,0.25)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#4CAF50',
      borderWidth: '1.5px',
    },
    '&.Mui-focused': {
      bgcolor: 'rgba(76,175,80,0.03)',
      boxShadow: '0 0 0 4px rgba(76,175,80,0.06), inset 0 0 20px rgba(76,175,80,0.02)',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.35)',
    '&.Mui-focused': { color: '#4CAF50' },
  },
  '& .MuiOutlinedInput-input': {
    color: '#E0E0E8',
  },
}

// ---------------------------------------------------------------------------
// ForgotPasswordPage
// ---------------------------------------------------------------------------
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email) {
      setError('Please enter your email address.')
      return
    }
    setSubmitted(true)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#0A0A12',
        px: 3,
        py: 4,
      }}
    >
      {/* ====== CONTENT ====== */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 400,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            textAlign: 'center',
            mb: 4,
            animation: `${fadeInUp} 0.6s ease both`,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '14px',
              background: 'rgba(76,175,80,0.08)',
              border: '1px solid rgba(76,175,80,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
            }}
          >
            <ShieldIcon sx={{ fontSize: 28, color: '#4CAF50' }} />
          </Box>
          <Typography
            sx={{
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: '1.5rem',
              color: '#E0E0E8',
            }}
          >
            Ubuntu
            <Box
              component="span"
              sx={{
                color: '#4CAF50',
              }}
            >
              Fund
            </Box>
          </Typography>
          <Typography
            sx={{
              fontFamily: '"TT Squares", monospace',
              fontSize: '0.65rem',
              color: 'rgba(76,175,80,0.4)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              mt: 0.5,
            }}
          >
            Password Recovery
          </Typography>
        </Box>

        {/* Card */}
        <Box
          sx={{
            animation: `${fadeInUp} 0.6s 0.1s ease both`,
            p: { xs: 3, sm: 4 },
            borderRadius: '16px',
            bgcolor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          {submitted ? (
            /* ---- SUCCESS STATE ---- */
            <Box
              sx={{
                textAlign: 'center',
                py: 2,
                animation: `${popIn} 0.4s ease both`,
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'rgba(76,175,80,0.08)',
                  border: '1px solid rgba(76,175,80,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                  // animation removed
                }}
              >
                <MarkEmailReadIcon sx={{ fontSize: 32, color: '#4CAF50' }} />
              </Box>

              <Typography
                sx={{
                  fontFamily: '"TT Squares", sans-serif',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  color: '#E0E0E8',
                  mb: 1,
                }}
              >
                Check your email
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  mb: 3,
                }}
              >
                If an account exists for{' '}
                <Box component="span" sx={{ color: '#4CAF50', fontWeight: 500 }}>
                  {email}
                </Box>
                , you&apos;ll receive a password reset link shortly.
              </Typography>

              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                sx={{
                  borderRadius: '10px',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#E0E0E8',
                  fontWeight: 600,
                  fontFamily: '"TT Squares", sans-serif',
                  '&:hover': {
                    borderColor: 'rgba(76,175,80,0.3)',
                    bgcolor: 'rgba(76,175,80,0.04)',
                  },
                }}
              >
                Back to Sign In
              </Button>
            </Box>
          ) : (
            /* ---- FORM STATE ---- */
            <>
              <Box sx={{ mb: 3 }}>
                <Typography
                  sx={{
                    fontFamily: '"TT Squares", sans-serif',
                    fontWeight: 900,
                    fontSize: '1.35rem',
                    color: '#E0E0E8',
                    mb: 0.5,
                  }}
                >
                  Reset password
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
                  We&apos;ll send a reset link to your email
                </Typography>
              </Box>

              {error && (
                <Alert
                  severity="error"
                  sx={{
                    mb: 3,
                    borderRadius: '10px',
                    bgcolor: 'rgba(239,83,80,0.08)',
                    border: '1px solid rgba(239,83,80,0.2)',
                    '& .MuiAlert-icon': { color: '#EF5350' },
                    color: '#E0E0E8',
                  }}
                >
                  {error}
                </Alert>
              )}

              <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
              >
                <TextField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  autoComplete="email"
                  autoFocus
                  sx={inputSx}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  sx={{
                    borderRadius: '10px',
                    py: 1.5,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    fontFamily: '"TT Squares", sans-serif',
                    background: '#2E7D32',
                    boxShadow: '0 4px 20px rgba(76,175,80,0.2)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 6px 28px rgba(76,175,80,0.35)',
                      transform: 'translateY(-1px)',
                    },
                    '&:active': { transform: 'translateY(0)' },
                  }}
                >
                  Send Reset Link
                </Button>

                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    component={RouterLink}
                    to="/login"
                    sx={{
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.35)',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      transition: 'color 0.2s ease',
                      '&:hover': { color: '#4CAF50' },
                    }}
                  >
                    <ArrowBackIcon sx={{ fontSize: 14 }} />
                    Back to Sign In
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Box>

        {/* Footer */}
        <Typography
          sx={{
            textAlign: 'center',
            mt: 4,
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.15)',
            letterSpacing: '0.05em',
            animation: `${fadeInUp} 0.6s 0.3s ease both`,
          }}
        >
          UbuntuFund &copy; {new Date().getFullYear()} &mdash; Secured Admin Portal
        </Typography>
      </Box>
    </Box>
  )
}
