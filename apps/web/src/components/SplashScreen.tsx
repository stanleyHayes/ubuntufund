import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

const keyframes = `
  @keyframes ripple {
    0% { transform: scale(0.3); opacity: 0.8; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes drawU {
    from { stroke-dashoffset: 60; }
    to { stroke-dashoffset: 0; }
  }
  @keyframes fadeInDot {
    from { opacity: 0; transform: scale(0); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes spinReverse {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }
  @keyframes dotPulse {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1); opacity: 0.25; }
    50% { transform: scale(1.12); opacity: 0.4; }
  }
  @keyframes drumBeat {
    0%, 100% { transform: scale(1); }
    15% { transform: scale(1.15); }
    30% { transform: scale(0.95); }
    45% { transform: scale(1.08); }
    60% { transform: scale(1); }
  }
  @keyframes floatParticle {
    0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.6; }
    50% { transform: translateY(-30px) translateX(10px) scale(0.7); opacity: 0.3; }
    100% { transform: translateY(-60px) translateX(-5px) scale(0.3); opacity: 0; }
  }
  @keyframes kenteSlide {
    0% { background-position: 0 0; }
    100% { background-position: 80px 0; }
  }
  @keyframes glowPulse {
    0%, 100% { filter: drop-shadow(0 0 4px rgba(46, 61, 47,0.3)); }
    50% { filter: drop-shadow(0 0 16px rgba(199, 162, 74,0.6)); }
  }
  @keyframes revealMask {
    0% { clip-path: circle(0% at 50% 50%); }
    100% { clip-path: circle(100% at 50% 50%); }
  }
  @keyframes stampIn {
    0% { transform: scale(2.5) rotate(-15deg); opacity: 0; }
    50% { transform: scale(0.9) rotate(3deg); opacity: 1; }
    70% { transform: scale(1.05) rotate(-1deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
`

function AdinkraRing({
  delay = 0,
  size = 120,
  color = '#2E3D2F',
  reverse = false,
}: {
  delay?: number
  size?: number
  color?: string
  reverse?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -size / 2,
        marginLeft: -size / 2,
        animation: `${reverse ? 'spinReverse' : 'spinSlow'} ${reverse ? '15' : '12'}s linear ${delay}s infinite, breathe 4s ease ${delay}s infinite`,
        opacity: 0.3,
      }}
    >
      {/* Diamond pattern around circle */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const cx = 50 + 42 * Math.cos(rad)
        const cy = 50 + 42 * Math.sin(rad)
        return (
          <path
            key={i}
            d={`M${cx},${cy - 4} L${cx + 3},${cy} L${cx},${cy + 4} L${cx - 3},${cy} Z`}
            fill={color}
          />
        )
      })}
      {/* Connecting arcs */}
      <circle cx="50" cy="50" r="42" stroke={color} strokeWidth="0.5" fill="none" strokeDasharray="4 8" />
    </svg>
  )
}

/** Floating dust particles */
function DustParticles() {
  const particles = [
    { x: '20%', y: '30%', delay: 0, dur: 3, color: '#2E3D2F' },
    { x: '70%', y: '60%', delay: 0.5, dur: 4, color: '#C7A24A' },
    { x: '40%', y: '70%', delay: 1, dur: 3.5, color: '#C75B39' },
    { x: '80%', y: '25%', delay: 1.5, dur: 4.5, color: '#5D4037' },
    { x: '15%', y: '65%', delay: 2, dur: 3, color: '#C7A24A' },
    { x: '60%', y: '40%', delay: 0.8, dur: 3.8, color: '#2E3D2F' },
    { x: '35%', y: '20%', delay: 1.3, dur: 4.2, color: '#C75B39' },
    { x: '85%', y: '50%', delay: 0.3, dur: 3.3, color: '#5D4037' },
  ]
  return (
    <>
      {particles.map((p, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: p.color,
            animation: `floatParticle ${p.dur}s ease ${p.delay}s infinite`,
          }}
        />
      ))}
    </>
  )
}

export function SplashScreen() {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAFAFA',
        zIndex: 9999,
        animation: 'revealMask 1s ease-out forwards',
      }}
    >
      <style>{keyframes}</style>

      <DustParticles />

      {/* Ripple circles */}
      {[0, 0.5, 1, 1.5, 2, 2.5].map((delay, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `2px solid ${['#2E3D2F', '#C7A24A', '#C75B39', '#5D4037', '#2E3D2F', '#C7A24A'][i]}`,
            animation: `ripple 3.2s ease-out ${delay}s infinite`,
          }}
        />
      ))}

      {/* Adinkra ring decorations */}
      <AdinkraRing delay={0} size={160} color="#2E3D2F" />
      <AdinkraRing delay={1} size={200} color="#C7A24A" reverse />
      <AdinkraRing delay={2} size={240} color="#C75B39" />

      {/* Logo: 3 reaching arms with gold dots — draw animation */}
      <svg
        width="80"
        height="80"
        viewBox="0 0 64 64"
        style={{
          marginBottom: 12,
          zIndex: 1,
          animation: 'drumBeat 2s ease 1.5s forwards, glowPulse 3s ease 2s infinite',
        }}
      >
        <circle cx="32" cy="32" r="30" fill="rgba(46, 61, 47,0.3)" />
        <circle cx="32" cy="32" r="20" fill="none" stroke="#5E8F72" strokeWidth="0.8" opacity="0.3" />
        {/* Three arms, each drawn in */}
        {[0, 120, 240].map((angle, i) => (
          <path
            key={angle}
            d="M0,-16 C6,-14 12,-8 12,-1 C12,2 10,4 7,4"
            transform={`translate(32,32) rotate(${angle})`}
            fill="none"
            stroke="white"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="60"
            strokeDashoffset="60"
            style={{ animation: `drawU 1s ease ${0.2 + i * 0.25}s forwards` }}
          />
        ))}
        {/* Gold dots at grip points */}
        <circle cx="39" cy="36" r="2.8" fill="#C7A24A" opacity="0" style={{ animation: 'fadeInDot 0.4s ease 1.1s forwards' }} />
        <circle cx="26.5" cy="24.9" r="2.8" fill="#C7A24A" opacity="0" style={{ animation: 'fadeInDot 0.4s ease 1.3s forwards' }} />
        <circle cx="30.5" cy="39.1" r="2.8" fill="#C7A24A" opacity="0" style={{ animation: 'fadeInDot 0.4s ease 1.5s forwards' }} />
      </svg>

      {/* Logo text with stamp animation */}
      <Typography
        sx={{
          fontSize: '1.6rem',
          fontWeight: 800,
          letterSpacing: '0.04em',
          color: '#2E3D2F',
          zIndex: 1,
          opacity: 0,
          animation: 'stampIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s forwards',
        }}
      >
        UbuntuFund
      </Typography>

      {/* Tagline */}
      <Typography
        sx={{
          fontSize: '0.9rem',
          color: '#795548',
          mt: 1,
          fontStyle: 'italic',
          opacity: 0,
          animation: 'fadeInUp 0.8s ease 1.4s forwards',
          zIndex: 1,
        }}
      >
        Together, We Rise
      </Typography>

      {/* Loading dots with drum beat rhythm */}
      <Box sx={{ display: 'flex', gap: 1, mt: 4, zIndex: 1 }}>
        {[0, 0.15, 0.3].map((delay, i) => (
          <Box
            key={i}
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: ['#2E3D2F', '#C7A24A', '#C75B39'][i],
              animation: `drumBeat 1.2s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </Box>

      {/* Kente-inspired sliding bottom border */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background:
            'repeating-linear-gradient(90deg, #2E3D2F 0px, #2E3D2F 20px, #C7A24A 20px, #C7A24A 40px, #C75B39 40px, #C75B39 60px, #5D4037 60px, #5D4037 80px)',
          animation: 'kenteSlide 2s linear infinite',
        }}
      />
    </Box>
  )
}
