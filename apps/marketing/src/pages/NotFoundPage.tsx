import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'

const keyframes = `
  @keyframes sunsetShift {
    0%, 100% { filter: hue-rotate(0deg); }
    50% { filter: hue-rotate(8deg); }
  }
  @keyframes floatDigit1 {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-14px) rotate(2deg); }
  }
  @keyframes floatDigit2 {
    0%, 100% { transform: translateY(0) rotate(1deg); }
    50% { transform: translateY(-10px) rotate(-1deg); }
  }
  @keyframes floatDigit3 {
    0%, 100% { transform: translateY(0) rotate(2deg); }
    50% { transform: translateY(-16px) rotate(-2deg); }
  }
  @keyframes flyBird {
    0% { transform: translateX(-60px) translateY(0); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateX(calc(100vw + 60px)) translateY(-30px); opacity: 0; }
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.2; transform: scale(0.7); }
    50% { opacity: 1; transform: scale(1.3); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 4px 20px rgba(199, 162, 74,0.3); }
    50% { transform: scale(1.05); box-shadow: 0 6px 30px rgba(199, 162, 74,0.5); }
  }
  @keyframes sway {
    0%, 100% { transform: rotate(-1deg); }
    50% { transform: rotate(1deg); }
  }
  @keyframes digitSlam {
    0% { transform: translateY(-80px) scale(2) rotate(-20deg); opacity: 0; }
    30% { transform: translateY(10px) scale(0.9) rotate(5deg); opacity: 1; }
    50% { transform: translateY(-5px) scale(1.05) rotate(-2deg); }
    70% { transform: translateY(2px) scale(0.98) rotate(1deg); }
    100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes sunGlow {
    0%, 100% { box-shadow: 0 0 60px rgba(199, 162, 74,0.3); }
    50% { box-shadow: 0 0 120px rgba(199, 162, 74,0.6); }
  }
  @keyframes kenteSlide {
    0% { background-position: 0 0; }
    100% { background-position: 80px 0; }
  }
  @keyframes shootingStar {
    0% { transform: translate(0, 0) rotate(-45deg); opacity: 1; }
    100% { transform: translate(200px, 200px) rotate(-45deg); opacity: 0; }
  }
  @keyframes moonGlow {
    0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 8px rgba(255,248,225,0.4)); }
    50% { opacity: 0.9; filter: drop-shadow(0 0 20px rgba(255,248,225,0.7)); }
  }
`

/** Star twinkle */
function Star({ x, y, size = 3, delay = 0 }: { x: number; y: number; size?: number; delay?: number }) {
  return (
    <circle cx={x} cy={y} r={size} fill="#FFF8E1" style={{ animation: `twinkle ${2 + delay}s ease ${delay}s infinite` }} />
  )
}

/** Flying bird - simple V shape */
function Bird({ y, delay, duration }: { y: number; delay: number; duration: number }) {
  return (
    <g style={{ animation: `flyBird ${duration}s linear ${delay}s infinite` }}>
      <g transform={`translate(0, ${y})`}>
        <path d="M0,0 Q5,-7 10,0 Q15,-7 20,0" stroke="#5D4037" strokeWidth="1.8" fill="none" strokeLinecap="round">
          <animate
            attributeName="d"
            values="M0,0 Q5,-7 10,0 Q15,-7 20,0;M0,0 Q5,2 10,0 Q15,2 20,0;M0,0 Q5,-7 10,0 Q15,-7 20,0"
            dur="0.6s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </g>
  )
}

/** Acacia tree silhouette */
function AcaciaTree({ x, height = 60, canopyWidth = 50 }: { x: number; height?: number; canopyWidth?: number }) {
  const baseY = 100
  const trunkTop = baseY - height
  const canopyY = trunkTop - 5
  return (
    <g style={{ transformOrigin: `${x}px ${baseY}px`, animation: 'sway 5s ease-in-out infinite' }}>
      <line x1={x} y1={baseY} x2={x} y2={trunkTop} stroke="#3E2723" strokeWidth="3" />
      <ellipse cx={x} cy={canopyY} rx={canopyWidth / 2} ry={12} fill="#2E2E2E" />
      <ellipse cx={x} cy={canopyY - 2} rx={canopyWidth / 2 - 4} ry={8} fill="#3E2723" />
    </g>
  )
}

/** Shooting stars */
function ShootingStars() {
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '40%', pointerEvents: 'none', overflow: 'hidden' }}
    >
      {[
        { x: '20%', y: '5%', delay: 2, dur: 1.5 },
        { x: '60%', y: '10%', delay: 7, dur: 1.2 },
        { x: '40%', y: '3%', delay: 12, dur: 1.8 },
      ].map((s, i) => (
        <line
          key={i}
          x1={s.x}
          y1={s.y}
          x2={s.x}
          y2={s.y}
          stroke="#FFF8E1"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            animation: `shootingStar ${s.dur}s ease ${s.delay}s infinite`,
            transformOrigin: `${s.x} ${s.y}`,
          }}
        />
      ))}
    </svg>
  )
}

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(180deg, #1A0A2E 0%, #2D1B4E 15%, #6B2D5B 30%, #C75B39 50%, #C7A24A 70%, #FFD54F 85%, #FFF8E1 100%)',
        animation: 'sunsetShift 10s ease-in-out infinite',
      }}
    >
      <style>{keyframes}</style>

      {/* Moon */}
      <Box
        sx={{
          position: 'absolute',
          top: '8%',
          right: '15%',
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #FFF8E1 0%, #FFD54F 100%)',
          animation: 'moonGlow 4s ease infinite',
          zIndex: 1,
        }}
      />

      <ShootingStars />

      {/* Stars in sky area */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '45%', pointerEvents: 'none' }}
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <Star x={30} y={25} size={2} delay={0} />
        <Star x={80} y={50} size={1.5} delay={0.5} />
        <Star x={150} y={20} size={2.5} delay={1} />
        <Star x={200} y={60} size={1.8} delay={1.5} />
        <Star x={250} y={30} size={2} delay={0.3} />
        <Star x={310} y={45} size={1.5} delay={2} />
        <Star x={350} y={15} size={2.2} delay={0.8} />
        <Star x={370} y={70} size={1.3} delay={1.2} />
        <Star x={120} y={75} size={1.8} delay={1.8} />
        <Star x={60} y={80} size={2} delay={0.6} />
        <Star x={280} y={80} size={1.5} delay={2.2} />
        <Star x={180} y={40} size={2} delay={0.4} />
        <Star x={330} y={55} size={1.6} delay={1.4} />
        <Star x={100} y={30} size={1.2} delay={0.9} />
        <Star x={380} y={40} size={1.8} delay={1.7} />
      </svg>

      {/* Flying birds */}
      <svg
        style={{
          position: 'absolute',
          top: '15%',
          left: 0,
          width: '100%',
          height: '30%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Bird y={20} delay={0} duration={12} />
        <Bird y={35} delay={3} duration={15} />
        <Bird y={15} delay={7} duration={10} />
        <Bird y={45} delay={5} duration={18} />
        <Bird y={28} delay={10} duration={14} />
      </svg>

      {/* 404 with per-digit slam entrance then float */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1, md: 2 },
          mb: 2,
          zIndex: 2,
        }}
      >
        {['4', '0', '4'].map((digit, i) => (
          <Typography
            key={i}
            sx={{
              fontSize: { xs: '6rem', sm: '8rem', md: '11rem' },
              fontWeight: 900,
              lineHeight: 1,
              color: '#FFF8E1',
              textShadow: '0 4px 30px rgba(0,0,0,0.3), 0 0 60px rgba(199, 162, 74,0.2)',
              fontFamily: '"Georgia", serif',
              opacity: 0,
              animation: `digitSlam 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.15}s forwards, ${['floatDigit1', 'floatDigit2', 'floatDigit3'][i]} ${3 + i * 0.3}s ease-in-out ${0.8 + i * 0.15}s infinite`,
            }}
          >
            {digit}
          </Typography>
        ))}
      </Box>

      {/* Sun glow behind text */}
      <Box
        sx={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(199, 162, 74,0.15) 0%, transparent 70%)',
          animation: 'sunGlow 4s ease infinite',
          zIndex: 1,
        }}
      />

      <Typography
        sx={{
          fontSize: { xs: '1.1rem', md: '1.5rem' },
          fontWeight: 600,
          color: '#FFF8E1',
          textShadow: '0 2px 15px rgba(0,0,0,0.3)',
          textAlign: 'center',
          zIndex: 2,
          mb: 1,
          opacity: 0,
          animation: 'fadeInUp 0.8s ease 0.5s forwards',
        }}
      >
        This page is lost in the African sunset
      </Typography>

      <Typography
        sx={{
          fontSize: { xs: '0.85rem', md: '1rem' },
          color: 'rgba(255,248,225,0.8)',
          textAlign: 'center',
          zIndex: 2,
          mb: 4,
          maxWidth: 400,
          opacity: 0,
          animation: 'fadeInUp 0.8s ease 0.8s forwards',
        }}
      >
        The page you were looking for has drifted beyond the horizon. Let us guide you back.
      </Typography>

      <Button
        component={RouterLink}
        to="/"
        variant="contained"
        size="large"
        sx={{
          background: 'linear-gradient(135deg, #C7A24A 0%, #FF8F00 100%)',
          color: '#3E2723',
          fontWeight: 700,
          fontSize: '1.05rem',
          textTransform: 'none',
          px: 5,
          py: 1.5,
          borderRadius: SHAPE.sm,
          zIndex: 2,
          opacity: 0,
          animation: 'fadeInUp 0.6s ease 1.1s forwards, pulse 2.5s ease 1.7s infinite',
          '&:hover': {
            background: 'linear-gradient(135deg, #FFB300 0%, #C7A24A 100%)',
          },
        }}
      >
        Explore UbuntuFund
      </Button>

      {/* African landscape silhouette at bottom */}
      <svg
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '22%',
          minHeight: 120,
          pointerEvents: 'none',
        }}
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
      >
        {/* Hills */}
        <path
          d="M0,200 L0,140 Q100,80 200,120 Q350,60 500,110 Q600,70 700,100 Q850,50 1000,90 Q1100,70 1200,110 L1200,200Z"
          fill="#2E2E2E"
        />
        <path
          d="M0,200 L0,160 Q150,110 300,145 Q500,100 700,135 Q900,95 1100,130 L1200,140 L1200,200Z"
          fill="#1A1A1A"
        />
        {/* Acacia trees */}
        <AcaciaTree x={150} height={55} canopyWidth={48} />
        <AcaciaTree x={450} height={45} canopyWidth={40} />
        <AcaciaTree x={800} height={60} canopyWidth={55} />
        <AcaciaTree x={1050} height={40} canopyWidth={35} />
        <AcaciaTree x={600} height={35} canopyWidth={30} />
      </svg>

      {/* Kente animated bottom accent */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 5,
          background:
            'repeating-linear-gradient(90deg, #2E3D2F 0px, #2E3D2F 20px, #C7A24A 20px, #C7A24A 40px, #C75B39 40px, #C75B39 60px, #5D4037 60px, #5D4037 80px)',
          zIndex: 3,
          animation: 'kenteSlide 2s linear infinite',
        }}
      />
    </Box>
  )
}
