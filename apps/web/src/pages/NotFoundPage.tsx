import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE } from '@ubuntu-fund/ui'

const keyframesStyle = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  @keyframes floatSlow {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-8px) rotate(3deg); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
  }
  @keyframes dash {
    to { stroke-dashoffset: 0; }
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  @keyframes waveMove {
    0% { transform: translateX(-20px); }
    100% { transform: translateX(20px); }
  }
  @keyframes drawIn {
    from { stroke-dashoffset: 200; }
    to { stroke-dashoffset: 0; }
  }
  @keyframes drumBounce {
    0%, 100% { transform: scale(1) rotate(0deg); }
    10% { transform: scale(1.15) rotate(-2deg); }
    25% { transform: scale(0.92) rotate(1deg); }
    40% { transform: scale(1.08) rotate(-1deg); }
    55% { transform: scale(0.97); }
    70% { transform: scale(1.03); }
  }
  @keyframes entranceSlam {
    0% { transform: scale(3) rotate(-15deg); opacity: 0; filter: blur(10px); }
    40% { transform: scale(0.85) rotate(3deg); opacity: 1; filter: blur(0); }
    60% { transform: scale(1.1) rotate(-1deg); }
    80% { transform: scale(0.97) rotate(0.5deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes floatParticle {
    0% { transform: translateY(0) scale(1); opacity: 0.6; }
    100% { transform: translateY(-80px) scale(0.2); opacity: 0; }
  }
  @keyframes swirlIn {
    0% { transform: rotate(-180deg) scale(0); opacity: 0; }
    60% { transform: rotate(15deg) scale(1.1); opacity: 1; }
    100% { transform: rotate(0deg) scale(1); opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`

/** Adinkra: Gye Nyame symbol (Supremacy of God) */
function GyeNyame({ size = 60, color = '#C7A24A', style = {} }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={style}>
      <path
        d="M50 10 C30 10 15 25 15 45 C15 55 20 65 30 70 C25 75 20 80 20 85 C20 90 25 95 35 90 C40 87 45 82 50 78 C55 82 60 87 65 90 C75 95 80 90 80 85 C80 80 75 75 70 70 C80 65 85 55 85 45 C85 25 70 10 50 10Z"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray="300"
        strokeDashoffset="300"
        style={{ animation: 'dash 2s ease forwards' }}
      />
      <circle
        cx="50"
        cy="42"
        r="8"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeDasharray="60"
        strokeDashoffset="60"
        style={{ animation: 'dash 1.5s ease 0.5s forwards' }}
      />
    </svg>
  )
}

/** Adinkra: Sankofa bird silhouette */
function SankofaBird({ size = 55, color = '#C75B39', style = {} }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={style}>
      <path
        d="M65 25 C75 20 85 25 85 35 C85 45 75 50 65 45 L60 55 C55 70 45 80 35 85 C30 87 25 85 25 80 C25 75 30 70 40 65 L50 50 C45 40 50 30 65 25Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="250"
        strokeDashoffset="250"
        style={{ animation: 'dash 2.5s ease 0.3s forwards' }}
      />
      <circle cx="75" cy="32" r="3" fill={color} style={{ opacity: 0, animation: 'twinkle 2s ease 1.5s forwards' }} />
    </svg>
  )
}

/** Baobab tree silhouette */
function BaobabTree({ size = 80, color = '#5D4037', style = {} }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={style}>
      <path
        d="M55 95 L55 65 C45 60 30 50 25 40 C20 28 30 15 45 18 C42 12 48 5 58 8 C62 3 72 3 76 8 C86 5 92 12 89 18 C104 15 114 28 109 40 C104 50 89 60 79 65 L79 95"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="350"
        strokeDashoffset="350"
        style={{ animation: 'dash 3s ease 0.2s forwards' }}
      />
      <line x1="55" y1="95" x2="79" y2="95" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/** African mask outline */
function AfricanMask({ size = 50, color = '#C7A24A', style = {} }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 80 104" fill="none" style={style}>
      <path
        d="M40 8 C20 8 10 25 10 45 C10 65 20 80 30 88 C35 92 40 95 40 95 C40 95 45 92 50 88 C60 80 70 65 70 45 C70 25 60 8 40 8Z"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeDasharray="280"
        strokeDashoffset="280"
        style={{ animation: 'dash 2s ease 0.6s forwards' }}
      />
      <ellipse cx="30" cy="42" rx="7" ry="5" stroke={color} strokeWidth="2" fill="none" />
      <ellipse cx="50" cy="42" rx="7" ry="5" stroke={color} strokeWidth="2" fill="none" />
      <path d="M35 60 Q40 67 45 60" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="25" y1="25" x2="35" y2="22" stroke={color} strokeWidth="1.5" />
      <line x1="55" y1="25" x2="45" y2="22" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

/** Small decorative star */
function Star({ x, y, size = 8, color = '#C7A24A', delay = 0 }: { x: number; y: number; size?: number; color?: string; delay?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        animation: `twinkle 2.5s ease ${delay}s infinite`,
      }}
    >
      <path d="M10 2 L12 8 L18 10 L12 12 L10 18 L8 12 L2 10 L8 8Z" fill={color} />
    </svg>
  )
}

/** Zigzag line */
function ZigZag({ x, y, color = '#C75B39', delay = 0 }: { x: number; y: number; color?: string; delay?: number }) {
  return (
    <svg
      width="60"
      height="20"
      viewBox="0 0 60 20"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        opacity: 0.5,
        animation: `floatSlow 4s ease ${delay}s infinite`,
      }}
    >
      <polyline
        points="0,15 10,5 20,15 30,5 40,15 50,5 60,15"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Dot cluster */
function DotCluster({ x, y, color = '#2E3D2F', delay = 0 }: { x: number; y: number; color?: string; delay?: number }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        animation: `floatSlow 5s ease ${delay}s infinite`,
      }}
    >
      <circle cx="8" cy="8" r="3" fill={color} opacity="0.6" />
      <circle cx="22" cy="8" r="2" fill={color} opacity="0.4" />
      <circle cx="15" cy="22" r="3.5" fill={color} opacity="0.5" />
      <circle cx="5" cy="20" r="2" fill={color} opacity="0.3" />
    </svg>
  )
}

/** Floating dust */
function DustParticles() {
  const particles = [
    { x: '12%', y: '80%', delay: 0, dur: 3.5, color: '#2E3D2F' },
    { x: '30%', y: '85%', delay: 0.5, dur: 4, color: '#C7A24A' },
    { x: '50%', y: '82%', delay: 1, dur: 3, color: '#C75B39' },
    { x: '70%', y: '88%', delay: 1.5, dur: 4.5, color: '#5D4037' },
    { x: '88%', y: '83%', delay: 2, dur: 3.8, color: '#C7A24A' },
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
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: p.color,
            animation: `floatParticle ${p.dur}s ease ${p.delay}s infinite`,
          }}
        />
      ))}
    </>
  )
}

export function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: '#FFF8E1',
        px: 2,
        py: 4,
      }}
    >
      <style>{keyframesStyle}</style>

      <DustParticles />

      {/* Scattered decorative elements */}
      <Star x={8} y={12} delay={0} color="#C7A24A" />
      <Star x={85} y={8} delay={0.5} color="#C75B39" size={10} />
      <Star x={15} y={75} delay={1} color="#2E3D2F" size={6} />
      <Star x={90} y={65} delay={1.5} color="#C7A24A" />
      <Star x={5} y={45} delay={0.8} color="#5D4037" size={7} />
      <Star x={75} y={85} delay={2} color="#C75B39" size={9} />
      <Star x={45} y={5} delay={0.3} color="#2E3D2F" size={8} />
      <Star x={60} y={92} delay={1.2} color="#C7A24A" size={6} />
      <ZigZag x={3} y={30} delay={0} />
      <ZigZag x={80} y={40} delay={1} color="#2E3D2F" />
      <ZigZag x={60} y={90} delay={2} color="#C7A24A" />
      <DotCluster x={10} y={55} delay={0.5} />
      <DotCluster x={82} y={20} delay={1.5} color="#C75B39" />
      <DotCluster x={70} y={75} delay={0.3} color="#C7A24A" />

      {/* Main floating doodles with swirl entrance */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: { xs: 2, md: 4 },
          mb: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ animation: 'swirlIn 0.8s ease forwards, float 3s ease-in-out 0.8s infinite', opacity: 0 }}>
          <GyeNyame size={55} />
        </Box>
        <Box sx={{ animation: 'swirlIn 0.8s ease 0.2s forwards, float 3.5s ease-in-out 1s infinite', opacity: 0 }}>
          <SankofaBird size={50} />
        </Box>
        <Box sx={{ animation: 'swirlIn 0.8s ease 0.4s forwards, float 4s ease-in-out 1.2s infinite', opacity: 0 }}>
          <AfricanMask size={45} />
        </Box>
      </Box>

      {/* 404 Number - slam entrance with drum bounce */}
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: '8rem', md: '12rem' },
          fontWeight: 900,
          lineHeight: 1,
          color: '#2E3D2F',
          position: 'relative',
          mb: 1,
          fontFamily: '"Georgia", serif',
          letterSpacing: '-0.04em',
          animation: 'entranceSlam 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          '&::after': {
            content: '"404"',
            position: 'absolute',
            top: 4,
            left: 4,
            zIndex: -1,
            color: 'rgba(93,64,55,0.12)',
          },
        }}
      >
        404
      </Typography>

      {/* Wavy line separator */}
      <svg width="200" height="20" viewBox="0 0 200 20" style={{ marginBottom: 16 }}>
        <path
          d="M0,10 Q25,0 50,10 Q75,20 100,10 Q125,0 150,10 Q175,20 200,10"
          stroke="#C75B39"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="250"
          strokeDashoffset="250"
          style={{ animation: 'dash 1.5s ease 0.5s forwards' }}
        />
      </svg>

      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: '#5D4037',
          mb: 1,
          textAlign: 'center',
          fontSize: { xs: '1.3rem', md: '1.8rem' },
          opacity: 0,
          animation: 'fadeInUp 0.8s ease 0.6s forwards',
        }}
      >
        Oops! This path leads to the savanna...
      </Typography>

      <Typography
        variant="body1"
        sx={{
          color: '#795548',
          mb: 4,
          textAlign: 'center',
          maxWidth: 440,
          fontSize: { xs: '0.95rem', md: '1.05rem' },
          lineHeight: 1.6,
          opacity: 0,
          animation: 'fadeInUp 0.8s ease 0.9s forwards',
        }}
      >
        The page you&apos;re looking for has wandered off. Let&apos;s get you back on track.
      </Typography>

      <Button
        component={RouterLink}
        to="/"
        variant="contained"
        size="large"
        sx={{
          background: 'linear-gradient(135deg, #2E3D2F 0%, #2F6B46 100%)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '1.05rem',
          px: 5,
          py: 1.5,
          borderRadius: SHAPE.sm,
          textTransform: 'none',
          opacity: 0,
          animation: 'fadeInUp 0.6s ease 1.2s forwards',
          transition: 'background 0.2s ease',
          '&:hover': {
            background: 'linear-gradient(135deg, #1C261D 0%, #2E3D2F 100%)',
          },
        }}
      >
        Take Me Home
      </Button>

      {/* Baobab at bottom */}
      <Box
        sx={{
          position: 'absolute',
          bottom: { xs: 10, md: 20 },
          right: { xs: 10, md: 40 },
          opacity: 0,
          animation: 'swirlIn 1s ease 0.8s forwards',
          '& svg': { animation: 'floatSlow 6s ease-in-out infinite' },
        }}
      >
        <BaobabTree size={100} />
      </Box>

      {/* Bottom accent border */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          bgcolor: '#2E3D2F',
        }}
      />
    </Box>
  )
}
