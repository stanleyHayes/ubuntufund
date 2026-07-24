import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { SHAPE } from '@ubuntu-fund/ui'

const keyframes = `
  @keyframes brandReveal {
    0% { transform: scale(0.5); opacity: 0; filter: blur(8px); }
    60% { transform: scale(1.05); opacity: 1; filter: blur(0); }
    100% { transform: scale(1); opacity: 1; filter: blur(0); }
  }
  @keyframes rippleOut {
    0% { transform: scale(0.2); opacity: 0.7; }
    100% { transform: scale(3); opacity: 0; }
  }
  @keyframes drawU {
    from { stroke-dashoffset: 200; }
    to { stroke-dashoffset: 0; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes progressBar {
    0% { width: 0%; }
    100% { width: 100%; }
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
  @keyframes drumBeat {
    0%, 100% { transform: scale(1); }
    15% { transform: scale(1.18); }
    30% { transform: scale(0.93); }
    45% { transform: scale(1.1); }
    60% { transform: scale(1); }
  }
  @keyframes sunRise {
    0% { transform: translateY(40px) scale(0.5); opacity: 0; }
    60% { transform: translateY(-5px) scale(1.05); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  @keyframes kenteSlide {
    0% { background-position: 0 0; }
    100% { background-position: 80px 0; }
  }
  @keyframes floatDust {
    0% { transform: translateY(0) translateX(0); opacity: 0.5; }
    50% { transform: translateY(-25px) translateX(8px); opacity: 0.2; }
    100% { transform: translateY(-50px) translateX(-4px); opacity: 0; }
  }
  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes spinReverse {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }
  @keyframes glowPulse {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(46, 61, 47,0.2)); }
    50% { filter: drop-shadow(0 0 20px rgba(199, 162, 74,0.5)); }
  }
  @keyframes stampIn {
    0% { transform: scale(2.5) rotate(-12deg); opacity: 0; }
    50% { transform: scale(0.9) rotate(3deg); opacity: 1; }
    70% { transform: scale(1.05) rotate(-1deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
`

/** Dust particles */
function DustParticles() {
  const dots = [
    { x: '20%', y: '35%', delay: 0, dur: 3, color: '#2E3D2F' },
    { x: '65%', y: '55%', delay: 0.5, dur: 4, color: '#C7A24A' },
    { x: '40%', y: '70%', delay: 1, dur: 3.5, color: '#C75B39' },
    { x: '80%', y: '30%', delay: 1.5, dur: 4.2, color: '#5D4037' },
    { x: '10%', y: '60%', delay: 2, dur: 3.2, color: '#C7A24A' },
    { x: '55%', y: '25%', delay: 0.8, dur: 3.8, color: '#2E3D2F' },
  ]
  return (
    <>
      {dots.map((p, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: p.color,
            animation: `floatDust ${p.dur}s ease ${p.delay}s infinite`,
          }}
        />
      ))}
    </>
  )
}

export default function SplashScreen() {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #FFF8E1 0%, #FFFFFF 40%, #FFF3E0 100%)',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      <style>{keyframes}</style>

      <DustParticles />

      {/* Adinkra ring */}
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        style={{
          position: 'absolute',
          animation: 'spinSlow 14s linear infinite',
          opacity: 0.1,
        }}
      >
        <circle cx="100" cy="100" r="90" stroke="#2E3D2F" strokeWidth="1" fill="none" strokeDasharray="6 10" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180
          const cx = 100 + 85 * Math.cos(rad)
          const cy = 100 + 85 * Math.sin(rad)
          return (
            <path
              key={angle}
              d={`M${cx},${cy - 5} L${cx + 3},${cy} L${cx},${cy + 5} L${cx - 3},${cy} Z`}
              fill="#2E3D2F"
            />
          )
        })}
      </svg>

      {/* Second ring reverse */}
      <svg
        width="260"
        height="260"
        viewBox="0 0 260 260"
        style={{
          position: 'absolute',
          animation: 'spinReverse 20s linear infinite',
          opacity: 0.06,
        }}
      >
        <circle cx="130" cy="130" r="120" stroke="#C7A24A" strokeWidth="1" fill="none" strokeDasharray="4 12" />
      </svg>

      {/* Ripple circles */}
      {[0, 0.5, 1, 1.5, 2, 2.5].map((delay, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: 60,
            height: 60,
            borderRadius: '50%',
            border: `2px solid ${['#2E3D2F', '#C7A24A', '#C75B39', '#2E3D2F', '#C7A24A', '#C75B39'][i]}`,
            animation: `rippleOut 3.5s ease-out ${delay}s infinite`,
          }}
        />
      ))}

      {/* Main brand reveal with sun-rise effect */}
      <Box
        sx={{
          animation: 'sunRise 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          zIndex: 1,
          textAlign: 'center',
        }}
      >
        {/* U Logo with glow */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          style={{
            marginBottom: 8,
            animation: 'drumBeat 2s ease 1.3s forwards, glowPulse 3s ease 2s infinite',
          }}
        >
          <path
            d="M18,16 L18,46 C18,60 30,68 40,68 C50,68 62,60 62,46 L62,16"
            stroke="#2E3D2F"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="200"
            strokeDashoffset="200"
            style={{ animation: 'drawU 1.5s ease 0.3s forwards' }}
          />
          {/* Inner glow */}
          <path
            d="M18,16 L18,46 C18,60 30,68 40,68 C50,68 62,60 62,46 L62,16"
            stroke="#C7A24A"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="200"
            strokeDashoffset="200"
            opacity="0.4"
            style={{ animation: 'drawU 1.5s ease 0.5s forwards' }}
          />
        </svg>

        <Typography
          sx={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#2E3D2F',
            letterSpacing: '0.02em',
            opacity: 0,
            animation: 'stampIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 1s forwards',
          }}
        >
          UbuntuFund
        </Typography>

        <Typography
          sx={{
            fontSize: '0.95rem',
            color: '#C75B39',
            fontStyle: 'italic',
            mt: 0.5,
            opacity: 0,
            animation: 'fadeInUp 0.7s ease 1.5s forwards',
          }}
        >
          Together, We Rise
        </Typography>
      </Box>

      {/* Progress bar with shimmer */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 60,
          width: '50%',
          maxWidth: 260,
          height: 3,
          borderRadius: SHAPE.bar,
          backgroundColor: 'rgba(46, 61, 47,0.1)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            borderRadius: SHAPE.bar,
            background: 'linear-gradient(90deg, #2E3D2F, #C7A24A, #C75B39)',
            animation: 'progressBar 2.5s ease-in-out infinite',
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
              animation: 'shimmer 1.5s ease infinite',
            },
          }}
        />
      </Box>

      {/* Kente sliding bottom border */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 5,
          background:
            'repeating-linear-gradient(90deg, #2E3D2F 0px, #2E3D2F 20px, #C7A24A 20px, #C7A24A 40px, #C75B39 40px, #C75B39 60px, #5D4037 60px, #5D4037 80px)',
          animation: 'kenteSlide 2s linear infinite',
        }}
      />
    </Box>
  )
}
