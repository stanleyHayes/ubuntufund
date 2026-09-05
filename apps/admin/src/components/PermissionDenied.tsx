import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'

// Shares the branded light treatment of NotFoundPage (parchment ground, warm
// brown ink, kente bottom accent, drop-in animation) so the admin's "this
// doesn't exist" and "you can't see this" states read as one design language.
const keyframes = `
  @keyframes pd-fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pd-drop { 0% { transform: translateY(-60px) rotate(-12deg); opacity: 0; } 40% { transform: translateY(8px) rotate(4deg); opacity: 1; } 60% { transform: translateY(-4px) rotate(-2deg); } 100% { transform: translateY(0) rotate(0deg); opacity: 1; } }
  @keyframes pd-breathe { 0%,100% { transform: scale(1); box-shadow: 0 4px 16px rgba(93,64,55,0.2); } 50% { transform: scale(1.04); box-shadow: 0 6px 28px rgba(93,64,55,0.35); } }
  @keyframes pd-kente { 0% { background-position: 0 0; } 100% { background-position: 64px 0; } }
`

function LockSVG({ size = 104 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="44" stroke="#5D4037" strokeWidth="2.5" fill="none" strokeDasharray="280" strokeDashoffset="280" style={{ animation: 'dash 1.5s ease forwards' }} />
      <circle cx="50" cy="50" r="35" stroke="#C75B39" strokeWidth="1.5" fill="none" opacity="0.4" />
      <circle cx="50" cy="50" r="28" stroke="#C7A24A" strokeWidth="0.8" fill="none" opacity="0.3" strokeDasharray="4 6" />
      {/* Padlock */}
      <rect x="38" y="47" width="24" height="19" rx="3" fill="#5D4037" />
      <path d="M42 47 v-5 a8 8 0 0 1 16 0 v5" stroke="#5D4037" strokeWidth="3" fill="none" />
      <circle cx="50" cy="55" r="2.6" fill="#C7A24A" />
      <rect x="49" y="56" width="2" height="5" rx="1" fill="#C7A24A" />
    </svg>
  )
}

export default function PermissionDenied() {
  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: '#F5F0EB',
        px: 3,
        py: 6,
        overflow: 'hidden',
      }}
    >
      <style>{`@keyframes dash { to { stroke-dashoffset: 0; } }` + keyframes}</style>

      <Box sx={{ mb: 2, opacity: 0, animation: 'pd-drop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
        <LockSVG size={110} />
      </Box>

      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '2.4rem', md: '3.2rem' },
          fontWeight: 900,
          lineHeight: 1.05,
          color: '#5D4037',
          mb: 1.5,
          textAlign: 'center',
          opacity: 0,
          animation: 'pd-fadeIn 0.6s ease 0.3s forwards',
        }}
      >
        Access Denied
      </Typography>

      <Typography
        variant="h6"
        sx={{ fontWeight: 600, color: '#5D4037', mb: 1, textAlign: 'center', opacity: 0, animation: 'pd-fadeIn 0.6s ease 0.5s forwards' }}
      >
        You don&apos;t have permission to view this page
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: '#8D6E63', mb: 4, textAlign: 'center', maxWidth: 380, opacity: 0, animation: 'pd-fadeIn 0.6s ease 0.7s forwards' }}
      >
        Your role doesn&apos;t include access here. Contact a platform administrator if you need it.
      </Typography>

      <Button
        component={RouterLink}
        to="/"
        variant="contained"
        sx={{
          background: '#5D4037',
          color: '#fff',
          fontWeight: 600,
          textTransform: 'none',
          px: 4,
          py: 1.2,
          borderRadius: 2,
          opacity: 0,
          animation: 'pd-fadeIn 0.6s ease 0.9s forwards, pd-breathe 2.5s ease 1.5s infinite',
          '&:hover': { background: '#4E342E' },
        }}
      >
        Back to Dashboard
      </Button>

      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background:
            'repeating-linear-gradient(90deg, #2E3D2F 0px, #2E3D2F 16px, #C7A24A 16px, #C7A24A 32px, #C75B39 32px, #C75B39 48px, #5D4037 48px, #5D4037 64px)',
          animation: 'pd-kente 2s linear infinite',
        }}
      />
    </Box>
  )
}
