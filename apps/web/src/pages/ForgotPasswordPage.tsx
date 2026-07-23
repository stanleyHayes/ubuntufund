import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import { Link as RouterLink } from 'react-router-dom'
import { keyframes } from '@emotion/react'
import { SHAPE } from '@ubuntu-fund/ui'
import { AuthLayout } from '../components/auth/AuthLayout'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const drawUnderline = keyframes`
  from { width: 0; }
  to   { width: 100%; }
`

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`

const markerSwipe = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`

const popIn = keyframes`
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
`

const drawPath = keyframes`
  to { stroke-dashoffset: 0; }
`

const floatUp = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
`

const sketchyInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '4px',
    bgcolor: 'transparent',
    fontFamily: '"Inter", "Roboto", sans-serif',
    transition: 'all 0.3s ease',
    '& fieldset': {
      border: 'none',
      borderBottom: '2px solid rgba(0,0,0,0.12)',
      borderRadius: 0,
      transition: 'border-color 0.3s ease',
    },
    '&:hover fieldset': {
      borderBottom: '2px solid rgba(46,125,50,0.4)',
    },
    '&.Mui-focused fieldset': {
      borderBottom: '2.5px solid #2E7D32',
      borderWidth: '0 0 2.5px 0',
    },
  },
  '& .MuiInputLabel-root': {
    fontFamily: '"Inter", sans-serif',
    fontSize: '0.85rem',
    color: 'rgba(0,0,0,0.45)',
    '&.Mui-focused': {
      color: '#2E7D32',
    },
  },
}

// ---------------------------------------------------------------------------
// Doodled envelope SVG
// ---------------------------------------------------------------------------

function DoodleEnvelope() {
  return (
    <svg width="80" height="60" viewBox="0 0 80 60">
      {/* Envelope body */}
      <rect
        x="5"
        y="10"
        width="70"
        height="45"
        rx="3"
        fill="rgba(46,125,50,0.04)"
        stroke="#2E7D32"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="300"
        strokeDashoffset="300"
        style={{ animation: `${drawPath} 1s ease forwards` }}
      />
      {/* Envelope flap */}
      <path
        d="M5,12 L40,35 L75,12"
        fill="none"
        stroke="#2E7D32"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: `${drawPath} 0.7s 0.6s ease forwards` }}
      />
      {/* Little heart on the seal */}
      <path
        d="M40,28 C40,25 37,25 37,28 C37,31 40,33 40,33 C40,33 43,31 43,28 C43,25 40,25 40,28 Z"
        fill="#F9A825"
        opacity={0}
        style={{ animation: `${popIn} 0.4s 1.2s ease both` }}
      />
      {/* Motion lines */}
      <line
        x1="16" y1="6" x2="28" y2="6"
        stroke="#F9A825"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="15"
        strokeDashoffset="15"
        opacity={0.5}
        style={{ animation: `${drawPath} 0.3s 1.4s ease forwards` }}
      />
      <line
        x1="52" y1="4" x2="64" y2="4"
        stroke="#4CAF50"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="15"
        strokeDashoffset="15"
        opacity={0.5}
        style={{ animation: `${drawPath} 0.3s 1.5s ease forwards` }}
      />
      <line
        x1="32" y1="2" x2="48" y2="2"
        stroke="#F9A825"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="20"
        strokeDashoffset="20"
        opacity={0.4}
        style={{ animation: `${drawPath} 0.3s 1.6s ease forwards` }}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Doodled lock + key SVG
// ---------------------------------------------------------------------------

function DoodleLockKey() {
  return (
    <svg width="70" height="70" viewBox="0 0 70 70">
      {/* Lock body */}
      <rect
        x="18"
        y="30"
        width="34"
        height="28"
        rx="4"
        fill="rgba(46,125,50,0.04)"
        stroke="#5D4037"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="200"
        strokeDashoffset="200"
        style={{ animation: `${drawPath} 0.8s ease forwards` }}
      />
      {/* Lock shackle */}
      <path
        d="M25,32 L25,22 C25,14 35,8 35,14 C35,8 45,14 45,22 L45,32"
        fill="none"
        stroke="#5D4037"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: `${drawPath} 0.7s 0.5s ease forwards` }}
      />
      {/* Keyhole */}
      <circle
        cx="35"
        cy="42"
        r="3.5"
        fill="none"
        stroke="#2E7D32"
        strokeWidth="1.5"
        strokeDasharray="30"
        strokeDashoffset="30"
        style={{ animation: `${drawPath} 0.4s 1s ease forwards` }}
      />
      <line
        x1="35" y1="45" x2="35" y2="51"
        stroke="#2E7D32"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="10"
        strokeDashoffset="10"
        style={{ animation: `${drawPath} 0.3s 1.2s ease forwards` }}
      />
      {/* Little sparkle */}
      {[
        { x: 52, y: 18 },
        { x: 14, y: 26 },
      ].map((s, i) => (
        <g key={i} style={{ animation: `${popIn} 0.3s ${1.4 + i * 0.2}s ease both` }}>
          <line x1={s.x} y1={s.y - 3} x2={s.x} y2={s.y + 3} stroke="#F9A825" strokeWidth="1" strokeLinecap="round" />
          <line x1={s.x - 3} y1={s.y} x2={s.x + 3} y2={s.y} stroke="#F9A825" strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// ForgotPasswordPage
// ---------------------------------------------------------------------------

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setSent(true)
    }, 1200)
  }

  return (
    <AuthLayout>
      {sent ? (
        /* ============ SUCCESS — CHECK YOUR EMAIL ============ */
        <Box
          sx={{
            textAlign: 'center',
            py: 2,
            animation: `${popIn} 0.5s ease both`,
          }}
        >
          {/* Animated envelope */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 3,
              animation: `${floatUp} 3s 0.5s ease-in-out infinite`,
            }}
          >
            <DoodleEnvelope />
          </Box>

          <Typography
            sx={{
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: '1.5rem',
              color: '#1a1a1a',
              mb: 1,
              position: 'relative',
              display: 'inline-block',
            }}
          >
            Check your email
            <Box
              component="span"
              sx={{
                position: 'absolute',
                bottom: -3,
                left: 0,
                width: '100%',
                height: 5,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='5' viewBox='0 0 80 5'%3E%3Cpath d='M0,3 C5,1 10,4 15,2.5 C20,1 25,4 30,2.5 C35,1 40,4 45,2.5 C50,1 55,4 60,2.5 C65,1 70,4 75,2.5 C80,1 80,3 80,3' fill='none' stroke='%23F9A825' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat-x',
                backgroundSize: '80px 5px',
              }}
            />
          </Typography>

          <Typography
            sx={{
              color: 'rgba(0,0,0,0.5)',
              fontSize: '0.88rem',
              mt: 2,
              fontStyle: 'italic',
              lineHeight: 1.6,
            }}
          >
            We&apos;ve sent a password reset link to{' '}
            <Box component="span" sx={{ color: '#2E7D32', fontWeight: 600, fontStyle: 'normal' }}>
              {email}
            </Box>
          </Typography>

          <Typography
            sx={{
              color: 'rgba(0,0,0,0.35)',
              fontSize: '0.78rem',
              mt: 1.5,
              fontStyle: 'italic',
            }}
          >
            Didn&apos;t receive it? Check your spam folder or try again.
          </Typography>

          <Box
            sx={{
              mt: 4,
              p: 2,
              border: '1.5px dashed rgba(46,125,50,0.25)',
              borderRadius: SHAPE.card,
              bgcolor: 'rgba(46,125,50,0.03)',
            }}
          >
            <Typography sx={{ fontSize: '0.78rem', color: '#5D4037', fontStyle: 'italic' }}>
              This is a mock &mdash; no email was sent.
            </Typography>
          </Box>

          {/* Back to sign in */}
          <Box sx={{ mt: 4 }}>
            <Box
              component={RouterLink}
              to="/login"
              sx={{
                color: '#2E7D32',
                fontSize: '0.88rem',
                fontWeight: 600,
                textDecoration: 'none',
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: -2,
                  left: 0,
                  width: 0,
                  height: 2,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='6' viewBox='0 0 40 6'%3E%3Cpath d='M0,3 C5,0 10,6 15,3 C20,0 25,6 30,3 C35,0 40,6 40,3' fill='none' stroke='%232E7D32' stroke-width='1.5'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'repeat-x',
                  backgroundSize: '40px 6px',
                  transition: 'width 0.4s ease',
                },
                '&:hover::after': {
                  width: '100%',
                },
              }}
            >
              &larr; Back to Sign in
            </Box>
          </Box>
        </Box>
      ) : (
        /* ============ FORM — ENTER EMAIL ============ */
        <Box component="form" onSubmit={handleSubmit}>
          {/* Doodled lock illustration */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 3,
              animation: `${fadeIn} 0.5s ease both`,
            }}
          >
            <DoodleLockKey />
          </Box>

          {/* Header */}
          <Box sx={{ mb: 4, animation: `${fadeIn} 0.6s 0.1s ease both`, textAlign: 'center' }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                color: '#1a1a1a',
                fontFamily: '"TT Squares", sans-serif',
                fontSize: '1.6rem',
                position: 'relative',
                display: 'inline-block',
              }}
            >
              Forgot password?
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  left: 0,
                  width: '100%',
                  height: 6,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='6' viewBox='0 0 80 6'%3E%3Cpath d='M0,3 C5,1 10,5 15,3 C20,1 25,5 30,3 C35,1 40,5 45,3 C50,1 55,5 60,3 C65,1 70,5 75,3 C80,1 80,3 80,3' fill='none' stroke='%23F9A825' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'repeat-x',
                  backgroundSize: '80px 6px',
                  animation: `${drawUnderline} 0.8s 0.4s ease both`,
                  overflow: 'hidden',
                }}
              />
            </Typography>
            <Typography
              sx={{
                color: 'rgba(0,0,0,0.5)',
                fontSize: '0.85rem',
                mt: 1.5,
                fontStyle: 'italic',
              }}
            >
              No worries &mdash; enter your email and we&apos;ll send you a reset link
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: SHAPE.card,
                bgcolor: 'rgba(229,57,53,0.04)',
                border: '1.5px dashed rgba(229,57,53,0.25)',
                animation: `${fadeIn} 0.3s ease`,
              }}
            >
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ animation: `${fadeIn} 0.5s 0.2s ease both` }}>
              <TextField
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                autoComplete="email"
                autoFocus
                sx={sketchyInputSx}
              />
            </Box>

            {/* Submit button */}
            <Box sx={{ animation: `${fadeIn} 0.5s 0.35s ease both`, position: 'relative' }}>
              <Box
                component="button"
                type="submit"
                disabled={loading}
                sx={{
                  width: '100%',
                  position: 'relative',
                  border: 'none',
                  bgcolor: 'transparent',
                  cursor: loading ? 'wait' : 'pointer',
                  py: 2,
                  px: 3,
                  fontFamily: '"TT Squares", sans-serif',
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: '#FFFFFF',
                  letterSpacing: '0.04em',
                  zIndex: 1,
                  overflow: 'hidden',
                  borderRadius: SHAPE.sm,
                  transition: 'transform 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: loading
                      ? 'linear-gradient(135deg, #81C784, #66BB6A)'
                      : 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 50%, #2E7D32 100%)',
                    borderRadius: SHAPE.sm,
                    zIndex: -1,
                    transformOrigin: 'left center',
                    animation: `${markerSwipe} 0.6s 0.5s ease both`,
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: -1,
                    border: '2px solid rgba(46,125,50,0.3)',
                    borderRadius: SHAPE.sm,
                    transform: 'rotate(-0.3deg)',
                    pointerEvents: 'none',
                  },
                  '&:disabled': {
                    opacity: 0.7,
                  },
                }}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </Box>
            </Box>

            {/* Back to sign in */}
            <Box sx={{ textAlign: 'center', animation: `${fadeIn} 0.5s 0.5s ease both` }}>
              <Box
                component={RouterLink}
                to="/login"
                sx={{
                  color: '#5D4037',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  fontStyle: 'italic',
                  transition: 'color 0.2s ease',
                  '&:hover': { color: '#2E7D32' },
                }}
              >
                &larr; Back to Sign in
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </AuthLayout>
  )
}
