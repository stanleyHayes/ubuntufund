import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { keyframes } from '@mui/system'

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

export default function PermissionDenied() {
  const navigate = useNavigate()

  return (
    <Box
      sx={{
        bgcolor: '#0c0c14',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: `${fadeIn} 0.5s ease both`,
      }}
    >
      <Box sx={{ textAlign: 'center', maxWidth: 420, px: 3 }}>
        {/* Lock icon with pulse */}
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            mb: 3,
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              border: '2px solid rgba(192,107,88,0.25)',
              borderRadius: '50%',
            }}
          />
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'rgba(192,107,88,0.08)',
              border: '1px solid rgba(192,107,88,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 32, color: '#C06B58' }} />
          </Box>
        </Box>

        <Typography
          sx={{
            fontFamily: '"TT Squares", sans-serif',
            fontWeight: 900,
            fontSize: '1.4rem',
            color: 'text.primary',
            mb: 1,
            letterSpacing: '0.02em',
          }}
        >
          Access Denied
        </Typography>

        <Typography
          sx={{
            fontSize: '0.88rem',
            color: 'text.secondary',
            mb: 1,
            lineHeight: 1.6,
          }}
        >
          You don't have permission to view this page.
        </Typography>

        <Typography
          sx={{
            fontSize: '0.78rem',
            color: 'rgba(255,255,255,0.3)',
            mb: 4,
          }}
        >
          Contact your administrator for access.
        </Typography>

        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#5E8F72',
            borderColor: 'rgba(76,175,80,0.3)',
            px: 3,
            py: 1,
            '&:hover': {
              borderColor: '#5E8F72',
              bgcolor: 'rgba(76,175,80,0.08)',
            },
          }}
        >
          Back to Dashboard
        </Button>
      </Box>
    </Box>
  )
}
