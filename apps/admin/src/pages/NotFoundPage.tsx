import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'

const keyframes = `
  @keyframes spinCompass {
    0% { transform: rotate(0deg); }
    20% { transform: rotate(120deg); }
    40% { transform: rotate(80deg); }
    60% { transform: rotate(200deg); }
    80% { transform: rotate(160deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  @keyframes dash {
    to { stroke-dashoffset: 0; }
  }
  @keyframes subtleBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  @keyframes entranceSlam {
    0% { transform: scale(3) rotate(-15deg); opacity: 0; filter: blur(8px); }
    40% { transform: scale(0.85) rotate(3deg); opacity: 1; filter: blur(0); }
    60% { transform: scale(1.1) rotate(-1deg); }
    80% { transform: scale(0.97) rotate(0.5deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes compassDrop {
    0% { transform: translateY(-60px) rotate(-20deg); opacity: 0; }
    40% { transform: translateY(8px) rotate(5deg); opacity: 1; }
    60% { transform: translateY(-4px) rotate(-2deg); }
    100% { transform: translateY(0) rotate(0deg); opacity: 1; }
  }
  @keyframes kenteSlide {
    0% { background-position: 0 0; }
    100% { background-position: 64px 0; }
  }
  @keyframes breatheButton {
    0%, 100% { transform: scale(1); box-shadow: 0 4px 16px rgba(93,64,55,0.2); }
    50% { transform: scale(1.04); box-shadow: 0 6px 28px rgba(93,64,55,0.35); }
  }
  @keyframes glyphFade {
    0% { stroke-dashoffset: 100; opacity: 0; }
    100% { stroke-dashoffset: 0; opacity: 0.12; }
  }
  @keyframes floatDust {
    0% { transform: translateY(0) scale(1); opacity: 0.4; }
    100% { transform: translateY(-60px) scale(0.2); opacity: 0; }
  }
`

function CompassSVG({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Outer circle */}
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke="#5D4037"
        strokeWidth="2.5"
        fill="none"
        strokeDasharray="280"
        strokeDashoffset="280"
        style={{ animation: 'dash 1.5s ease forwards' }}
      />
      {/* Inner circle */}
      <circle cx="50" cy="50" r="35" stroke="#C75B39" strokeWidth="1.5" fill="none" opacity="0.4" />
      {/* Second inner ring */}
      <circle
        cx="50"
        cy="50"
        r="28"
        stroke="#F9A825"
        strokeWidth="0.8"
        fill="none"
        opacity="0.3"
        strokeDasharray="4 6"
      />
      {/* Cardinal tick marks */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180
        const x1 = 50 + 38 * Math.cos(rad)
        const y1 = 50 + 38 * Math.sin(rad)
        const x2 = 50 + 44 * Math.cos(rad)
        const y2 = 50 + 44 * Math.sin(rad)
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5D4037" strokeWidth="2" />
      })}
      {/* Minor tick marks */}
      {[45, 135, 225, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180
        const x1 = 50 + 40 * Math.cos(rad)
        const y1 = 50 + 40 * Math.sin(rad)
        const x2 = 50 + 44 * Math.cos(rad)
        const y2 = 50 + 44 * Math.sin(rad)
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8D6E63" strokeWidth="1" />
      })}
      {/* Compass needle group - animated */}
      <g style={{ transformOrigin: '50px 50px', animation: 'spinCompass 6s ease-in-out infinite' }}>
        <polygon points="50,15 46,50 54,50" fill="#C75B39" />
        <polygon points="50,85 46,50 54,50" fill="#5D4037" opacity="0.5" />
      </g>
      {/* Center dot */}
      <circle cx="50" cy="50" r="3.5" fill="#F9A825" />
      {/* N label */}
      <text x="50" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#5D4037">
        N
      </text>
    </svg>
  )
}

/** Pattern border with animated draw */
function PatternBorder() {
  return (
    <svg width="240" height="12" viewBox="0 0 240 12" style={{ opacity: 0.35 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <g key={i} transform={`translate(${i * 20}, 0)`}>
          <path d="M0,6 L5,0 L10,6 L5,12Z" fill="#C75B39" opacity={0} style={{ animation: `fadeIn 0.3s ease ${i * 0.05}s forwards` }} />
          <path d="M10,6 L15,0 L20,6 L15,12Z" fill="#2E7D32" opacity={0} style={{ animation: `fadeIn 0.3s ease ${i * 0.05 + 0.1}s forwards` }} />
        </g>
      ))}
    </svg>
  )
}

/** Background glyphs */
function BackgroundGlyphs() {
  return (
    <svg
      style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        d="M50 40 C40 35 30 40 30 50 C30 60 40 65 50 60"
        stroke="#C75B39"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: 'glyphFade 3s ease 0.5s forwards' }}
      />
      <path
        d="M350 240 L350 260 M340 250 L360 250"
        stroke="#F9A825"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: 'glyphFade 3s ease 1s forwards' }}
      />
      <path
        d="M360 50 C350 45 340 50 340 55 C340 65 355 65 360 55"
        stroke="#2E7D32"
        strokeWidth="1"
        fill="none"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: 'glyphFade 3s ease 1.5s forwards' }}
      />
    </svg>
  )
}

/** Floating dust */
function DustMotes() {
  const motes = [
    { x: '15%', y: '70%', delay: 0, dur: 3 },
    { x: '35%', y: '75%', delay: 0.5, dur: 4 },
    { x: '55%', y: '72%', delay: 1, dur: 3.5 },
    { x: '75%', y: '78%', delay: 1.5, dur: 4.2 },
    { x: '90%', y: '68%', delay: 2, dur: 3.2 },
  ]
  return (
    <>
      {motes.map((m, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: m.x,
            top: m.y,
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: ['#C75B39', '#F9A825', '#5D4037', '#2E7D32', '#F9A825'][i],
            animation: `floatDust ${m.dur}s ease ${m.delay}s infinite`,
          }}
        />
      ))}
    </>
  )
}

export default function NotFoundPage() {
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
      <style>{keyframes}</style>

      <BackgroundGlyphs />
      <DustMotes />

      {/* Compass with drop-in animation */}
      <Box sx={{ mb: 2, opacity: 0, animation: 'compassDrop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
        <Box sx={{ animation: 'subtleBob 4s ease-in-out 0.8s infinite' }}>
          <CompassSVG size={110} />
        </Box>
      </Box>

      {/* 404 with slam entrance + pattern overlay */}
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '5rem', md: '7rem' },
          fontWeight: 900,
          lineHeight: 1,
          color: '#5D4037',
          position: 'relative',
          mb: 1,
          opacity: 0,
          animation: 'entranceSlam 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'rgba(249,168,37,0.08)',
            pointerEvents: 'none',
          },
        }}
      >
        404
      </Typography>

      <PatternBorder />

      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          color: '#5D4037',
          mt: 2,
          mb: 1,
          textAlign: 'center',
          opacity: 0,
          animation: 'fadeIn 0.6s ease 0.6s forwards',
        }}
      >
        This admin page doesn&apos;t exist
      </Typography>

      <Typography
        variant="body2"
        sx={{
          color: '#8D6E63',
          mb: 4,
          textAlign: 'center',
          maxWidth: 360,
          opacity: 0,
          animation: 'fadeIn 0.6s ease 0.8s forwards',
        }}
      >
        The page you navigated to could not be found. Check the URL or head back to the dashboard.
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
          animation: 'fadeIn 0.6s ease 1s forwards, breatheButton 2.5s ease 1.6s infinite',
          '&:hover': {
            background: '#4E342E',
          },
        }}
      >
        Back to Dashboard
      </Button>

      {/* Kente animated bottom accent */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background:
            'repeating-linear-gradient(90deg, #2E7D32 0px, #2E7D32 16px, #F9A825 16px, #F9A825 32px, #C75B39 32px, #C75B39 48px, #5D4037 48px, #5D4037 64px)',
          animation: 'kenteSlide 2s linear infinite',
        }}
      />
    </Box>
  )
}
