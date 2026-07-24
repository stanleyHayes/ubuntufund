import { useState, useEffect } from 'react'
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import ShieldIcon from '@mui/icons-material/Shield'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { keyframes } from '@emotion/react'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`

const typewriter = keyframes`
  from { width: 0; }
  to   { width: 100%; }
`

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
`

// ---------------------------------------------------------------------------
// Live clock
// ---------------------------------------------------------------------------
function LiveClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <Typography
      sx={{
        fontFamily: '"Outfit", monospace',
        fontSize: '0.7rem',
        color: 'rgba(76,175,80,0.5)',
        letterSpacing: '0.15em',
      }}
    >
      {time.toLocaleTimeString('en-GB', { hour12: false })} UTC
    </Typography>
  )
}

// ---------------------------------------------------------------------------
// Input styling
// ---------------------------------------------------------------------------
const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: 'rgba(255,255,255,0.04)',
    transition: 'all 0.25s ease',
    '& fieldset': {
      borderColor: 'rgba(255,255,255,0.06)',
      transition: 'all 0.25s ease',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(76,175,80,0.25)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#5E8F72',
      borderWidth: '1.5px',
    },
    '&.Mui-focused': {
      bgcolor: 'rgba(76,175,80,0.03)',
      boxShadow: '0 0 0 4px rgba(76,175,80,0.06), inset 0 0 20px rgba(76,175,80,0.02)',
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.35)',
    '&.Mui-focused': {
      color: '#5E8F72',
    },
  },
  '& .MuiOutlinedInput-input': {
    color: '#E0E0E8',
    '&::placeholder': { color: 'rgba(255,255,255,0.2)' },
  },
}

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      // ref removed
      sx={{
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#0A0A12',
        cursor: 'default',
      }}
    >
      {/* ====== LEFT PANEL — BRANDING ====== */}
      <Box
        sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          width: '48%',
          px: 8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Top-left system info */}
        <Box sx={{ position: 'absolute', top: 40, left: 48, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#5E8F72',
              boxShadow: '0 0 8px rgba(76,175,80,0.5)',
            }}
          />
          <Typography
            sx={{
              fontFamily: '"Outfit", monospace',
              fontSize: '0.65rem',
              color: 'rgba(76,175,80,0.4)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            System Online
          </Typography>
          <Box sx={{ mx: 1, width: '1px', height: 12, bgcolor: 'rgba(255,255,255,0.06)' }} />
          <LiveClock />
        </Box>

        {/* Main content */}
        <Box sx={{ animation: `${fadeInUp} 0.8s ease both` }}>
          {/* Shield icon */}
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
              mb: 4,
            }}
          >
            <ShieldIcon sx={{ fontSize: 28, color: '#5E8F72' }} />
          </Box>

          {/* Wordmark */}
          <Typography
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 900,
              fontSize: '2.8rem',
              lineHeight: 1.1,
              color: '#E0E0E8',
              mb: 1,
            }}
          >
            Ubuntu
            <Box
              component="span"
              sx={{
                color: '#5E8F72',
              }}
            >
              Fund
            </Box>
          </Typography>

          {/* Typewriter subtitle */}
          <Box sx={{ mb: 4, overflow: 'hidden' }}>
            <Typography
              sx={{
                fontFamily: '"Outfit", monospace',
                fontSize: '0.85rem',
                color: 'rgba(76,175,80,0.6)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                borderRight: '2px solid rgba(76,175,80,0.5)',
                animation: `${typewriter} 2s steps(22) 0.5s both, ${blink} 0.8s 2.5s step-end infinite`,
                width: 'fit-content',
              }}
            >
              Administration Console
            </Typography>
          </Box>

          {/* Description */}
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '0.95rem',
              lineHeight: 1.8,
              maxWidth: 380,
              mb: 5,
            }}
          >
            Manage campaigns, monitor trust scores, resolve disputes, and oversee
            the platform that connects communities across Ghana.
          </Typography>

          {/* Stats row */}
          <Box sx={{ display: 'flex', gap: 4 }}>
            {[
              { value: '99.9%', label: 'Uptime' },
              { value: '2FA', label: 'Secured' },
              { value: '< 50ms', label: 'Latency' },
            ].map((stat) => (
              <Box key={stat.label}>
                <Typography
                  sx={{
                    fontFamily: '"Outfit", monospace',
                    fontWeight: 700,
                    fontSize: '1.15rem',
                    color: '#5E8F72',
                    textShadow: '0 0 20px rgba(76,175,80,0.3)',
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.25)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    mt: 0.25,
                  }}
                >
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Bottom gradient line */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 48,
            right: 48,
            height: '1px',
            background: 'rgba(76,175,80,0.2)',
          }}
        />
      </Box>

      {/* ====== RIGHT PANEL — FORM ====== */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          px: { xs: 3, sm: 6 },
          py: 4,
        }}
      >
        {/* Mobile-only header */}
        <Box
          sx={{
            display: { xs: 'flex', lg: 'none' },
            flexDirection: 'column',
            alignItems: 'center',
            mb: 4,
            animation: `${fadeInUp} 0.6s ease both`,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: 'rgba(76,175,80,0.1)',
              border: '1px solid rgba(76,175,80,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <ShieldIcon sx={{ fontSize: 24, color: '#5E8F72' }} />
          </Box>
          <Typography
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 900,
              fontSize: '1.5rem',
              color: '#E0E0E8',
            }}
          >
            Ubuntu
            <Box
              component="span"
              sx={{
                color: '#5E8F72',
              }}
            >
              Fund
            </Box>
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Outfit", monospace',
              fontSize: '0.65rem',
              color: 'rgba(76,175,80,0.4)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              mt: 0.5,
            }}
          >
            Admin Console
          </Typography>
        </Box>

        {/* Form card — glassmorphic */}
        <Box
          sx={{
            width: '100%',
            maxWidth: 400,
            animation: `${fadeInUp} 0.6s 0.1s ease both`,
          }}
        >
          <Box
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: '16px',
              bgcolor: 'rgba(21,36,31,0.9)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Header */}
            <Box sx={{ mb: 3.5 }}>
              <Typography
                sx={{
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: 900,
                  fontSize: '1.5rem',
                  color: '#E0E0E8',
                  mb: 0.5,
                }}
              >
                Sign in
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
                Enter your credentials to access the dashboard
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
                  '& .MuiAlert-icon': { color: '#C06B58' },
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
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                autoComplete="email"
                autoFocus
                placeholder="admin@ubuntufund.com"
                sx={inputSx}
              />

              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
                autoComplete="current-password"
                sx={inputSx}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                          sx={{ color: 'rgba(255,255,255,0.25)' }}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      sx={{
                        color: 'rgba(255,255,255,0.15)',
                        '&.Mui-checked': { color: '#5E8F72' },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                      Remember me
                    </Typography>
                  }
                />
                <Box
                  component={RouterLink}
                  to="/forgot-password"
                  sx={{
                    fontSize: '0.8rem',
                    color: '#5E8F72',
                    textDecoration: 'none',
                    fontWeight: 500,
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: -1,
                      left: 0,
                      width: '100%',
                      height: '1px',
                      bgcolor: '#5E8F72',
                      transform: 'scaleX(0)',
                      transformOrigin: 'left',
                      transition: 'transform 0.3s ease',
                    },
                    '&:hover::after': { transform: 'scaleX(1)' },
                  }}
                >
                  Forgot password?
                </Box>
              </Box>

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{
                  borderRadius: '10px',
                  py: 1.5,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: '"Outfit", sans-serif',
                  background: loading
                    ? undefined
                    : '#2E3D2F',
                  transition: 'background-color 200ms ease',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    background: loading ? undefined : '#1C261D',
                  },
                  ...(loading && {
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255,255,255,0.05)',
                      opacity: loading ? 1 : 0,
                      transition: 'opacity 0.3s ease',
                    },
                  }),
                }}
              >
                {loading ? 'Authenticating...' : 'Sign in'}
              </Button>
            </Box>
          </Box>

          {/* Footer */}
          <Typography
            sx={{
              textAlign: 'center',
              mt: 4,
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.15)',
              letterSpacing: '0.05em',
            }}
          >
            UbuntuFund &copy; {new Date().getFullYear()} &mdash; Secured Admin Portal
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
