import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

const keyframes = `
  @keyframes drawU {
    from { stroke-dashoffset: 200; }
    to { stroke-dashoffset: 0; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spinPattern {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes spinReverse {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }
  @keyframes dotPulse {
    0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
    40% { transform: scale(1); opacity: 1; }
  }
  @keyframes breatheGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(249,168,37,0.1); }
    50% { box-shadow: 0 0 60px rgba(249,168,37,0.25); }
  }
  @keyframes drumHit {
    0%, 100% { transform: scale(1); }
    15% { transform: scale(1.2); }
    30% { transform: scale(0.92); }
    45% { transform: scale(1.1); }
    60% { transform: scale(1); }
  }
  @keyframes emberFloat {
    0% { transform: translateY(0) scale(1); opacity: 0.8; }
    100% { transform: translateY(-80px) scale(0.2); opacity: 0; }
  }
  @keyframes kenteSlide {
    0% { background-position: 0 0; }
    100% { background-position: 64px 0; }
  }
  @keyframes glyphReveal {
    0% { stroke-dashoffset: 100; opacity: 0; }
    50% { opacity: 0.3; }
    100% { stroke-dashoffset: 0; opacity: 0.15; }
  }
  @keyframes pulseRing {
    0% { transform: scale(0.8); opacity: 0.4; }
    50% { transform: scale(1.05); opacity: 0.2; }
    100% { transform: scale(0.8); opacity: 0.4; }
  }
  @keyframes stampIn {
    0% { transform: scale(2) rotate(-10deg); opacity: 0; }
    50% { transform: scale(0.9) rotate(2deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
`

/** Floating embers */
function Embers() {
  const embers = [
    { x: '25%', delay: 0, dur: 2.5 },
    { x: '45%', delay: 0.4, dur: 3 },
    { x: '65%', delay: 0.8, dur: 2.8 },
    { x: '80%', delay: 1.2, dur: 3.2 },
    { x: '15%', delay: 1.6, dur: 2.6 },
    { x: '55%', delay: 0.6, dur: 3.4 },
    { x: '35%', delay: 1, dur: 2.4 },
    { x: '75%', delay: 1.4, dur: 3 },
    { x: '10%', delay: 0.2, dur: 2.9 },
    { x: '90%', delay: 1.8, dur: 2.7 },
  ]
  return (
    <>
      {embers.map((e, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            bottom: '20%',
            left: e.x,
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: ['#F9A825', '#C75B39', '#FF8F00'][i % 3],
            animation: `emberFloat ${e.dur}s ease ${e.delay}s infinite`,
          }}
        />
      ))}
    </>
  )
}

/** Background Adinkra glyphs */
function BackgroundGlyphs() {
  return (
    <svg
      style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Gye Nyame simplified */}
      <path
        d="M80 60 C65 60 55 70 55 80 C55 88 60 95 68 98"
        stroke="#F9A825"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: 'glyphReveal 3s ease 0.5s forwards' }}
      />
      {/* Sankofa */}
      <path
        d="M320 320 C330 315 340 320 340 330 C340 340 330 345 320 340 L310 350"
        stroke="#C75B39"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: 'glyphReveal 3s ease 1s forwards' }}
      />
      {/* Dwennimmen (rams horns) */}
      <path
        d="M320 70 C310 60 295 60 290 70 C285 80 295 90 305 85"
        stroke="#F9A825"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: 'glyphReveal 3s ease 1.5s forwards' }}
      />
      {/* Cross pattern */}
      <path
        d="M70 320 L70 340 M60 330 L80 330"
        stroke="#C75B39"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="100"
        strokeDashoffset="100"
        style={{ animation: 'glyphReveal 3s ease 2s forwards' }}
      />
    </svg>
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
        background: '#1A1A1A',
        zIndex: 9999,
        animation: 'breatheGlow 4s ease infinite',
        overflow: 'hidden',
      }}
    >
      <style>{keyframes}</style>

      <BackgroundGlyphs />
      <Embers />

      {/* Spinning pattern rings */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        style={{
          position: 'absolute',
          animation: 'spinPattern 10s linear infinite',
          opacity: 0.15,
        }}
      >
        <circle cx="60" cy="60" r="55" stroke="#F9A825" strokeWidth="1.5" fill="none" strokeDasharray="8 6" />
        <circle cx="60" cy="60" r="48" stroke="#C75B39" strokeWidth="1" fill="none" strokeDasharray="4 8" />
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180
          const cx = 60 + 52 * Math.cos(rad)
          const cy = 60 + 52 * Math.sin(rad)
          return (
            <rect
              key={angle}
              x={cx - 2}
              y={cy - 2}
              width="4"
              height="4"
              fill="#F9A825"
              transform={`rotate(${angle}, ${cx}, ${cy})`}
            />
          )
        })}
      </svg>

      {/* Second ring spinning reverse */}
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        style={{
          position: 'absolute',
          animation: 'spinReverse 16s linear infinite, pulseRing 4s ease infinite',
          opacity: 0.08,
        }}
      >
        <circle cx="90" cy="90" r="85" stroke="#F9A825" strokeWidth="1" fill="none" strokeDasharray="3 10" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180
          const cx = 90 + 80 * Math.cos(rad)
          const cy = 90 + 80 * Math.sin(rad)
          return (
            <path
              key={angle}
              d={`M${cx},${cy - 5} L${cx + 3},${cy} L${cx},${cy + 5} L${cx - 3},${cy} Z`}
              fill="#C75B39"
            />
          )
        })}
      </svg>

      {/* U Logo with drum beat */}
      <svg
        width="56"
        height="56"
        viewBox="0 0 70 70"
        style={{
          marginBottom: 10,
          zIndex: 1,
          animation: 'drumHit 2s ease 1.3s forwards',
        }}
      >
        <path
          d="M18,16 L18,42 C18,54 28,62 35,62 C42,62 52,54 52,42 L52,16"
          stroke="#F9A825"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="200"
          strokeDashoffset="200"
          style={{ animation: 'drawU 1.3s ease forwards' }}
        />
        {/* Ghost stroke */}
        <path
          d="M18,16 L18,42 C18,54 28,62 35,62 C42,62 52,54 52,42 L52,16"
          stroke="#C75B39"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="200"
          strokeDashoffset="200"
          opacity="0.4"
          style={{ animation: 'drawU 1.3s ease 0.2s forwards' }}
        />
      </svg>

      <Typography
        sx={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: '#F5F5F5',
          letterSpacing: '0.05em',
          zIndex: 1,
          opacity: 0,
          animation: 'stampIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards',
        }}
      >
        UbuntuFund
      </Typography>

      <Typography
        sx={{
          fontSize: '0.75rem',
          color: '#9E9E9E',
          mt: 0.5,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          zIndex: 1,
          opacity: 0,
          animation: 'fadeIn 0.6s ease 1s forwards',
        }}
      >
        Admin
      </Typography>

      {/* Loading dots with drum rhythm */}
      <Box sx={{ display: 'flex', gap: 0.8, mt: 4, zIndex: 1 }}>
        {[0, 0.12, 0.24].map((delay, i) => (
          <Box
            key={i}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: ['#F9A825', '#C75B39', '#F9A825'][i],
              animation: `drumHit 1.2s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </Box>

      {/* Kente sliding bottom border */}
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
